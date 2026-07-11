const Transaction = require('../models/Transaction');
const User        = require('../models/User');
const { getCalculatedAmount } = require('../utils/debtHelper');
const tg = require('../services/telegramService');
const path = require('path');
const mongoose = require('mongoose');

// Вспомогательный хелпер для запуска операций в транзакции с фолбэком
async function runInTransaction(callback) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (error.codeName === 'CommandNotSupported' || error.message.includes('transaction') || error.message.includes('session')) {
      console.warn('[Transaction] Transactions not supported by MongoDB server. Falling back to non-transactional execution...');
      session.endSession();
      return await callback(null);
    }
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}


// ── Анти-фарм: логарифмический ELO-бонус с жёстким капом ─────────────────────
// При amount=500 → ~27 ELO; amount=5000 → ~38 ELO; amount=50000 → ~48 ELO; кап 50
function calcEloBonus(amount) {
  return Math.min(50, Math.round(10 * Math.log10((amount || 0) + 1)));
}

// ELO изменения при закрытии (учитывает просрочку)
function calculateEloChange(transaction, now = new Date()) {
  const startDate  = transaction.incurredAt || transaction.createdAt;
  const diffDays   = Math.floor((now - new Date(startDate)) / (1000 * 60 * 60 * 24));
  const eloBonus   = calcEloBonus(transaction.originalAmount);
  return diffDays <= 7
    ? { debtorElo: eloBonus,     creditorElo: Math.round(eloBonus / 3), karmaReward: 50,  isOverdue: false }
    : { debtorElo: -Math.min(20, eloBonus), creditorElo: Math.round(eloBonus / 5), karmaReward: 10, isOverdue: true };
}

// Логарифмический ELO-бонус за прощение долга (до 150)
function calcForgiveEloBonus(amount) {
  return Math.min(150, Math.round(20 * Math.log10((amount || 0) + 1)));
}

const WITNESS_REQUIRED_THRESHOLD = 10000;

// ── Создание долга (свидетель обязателен только при сумме ≥ 10 000) ───────────
async function createDebt(req, res) {
  try {
    const { creditor, debtor, witnessId, amount, description, dueDate, penaltyRate, incurredAt, promisedReturnAmount } = req.body;
    const createdBy = req.user;

    const cleanWitnessId = (witnessId && witnessId !== 'null' && witnessId !== 'undefined' && witnessId !== '') ? witnessId : null;

    if (!creditor || !debtor || !amount || !description || !dueDate)
      return res.status(400).json({ error: 'Обязательные поля: creditor, debtor, amount, description, dueDate' });
    if (Number(amount) <= 0)
      return res.status(400).json({ error: 'Сумма долга должна быть больше нуля' });
    if (promisedReturnAmount && Number(promisedReturnAmount) < Number(amount))
      return res.status(400).json({ error: 'Обещанная сумма возврата не может быть меньше суммы займа' });
    if (cleanWitnessId && (cleanWitnessId === creditor || cleanWitnessId === debtor))
      return res.status(400).json({ error: 'Свидетель не может быть кредитором или должником' });
    if (Number(amount) >= WITNESS_REQUIRED_THRESHOLD && !cleanWitnessId)
      return res.status(400).json({ error: `При сумме от ${WITNESS_REQUIRED_THRESHOLD.toLocaleString('ru')} ₸ необходим свидетель` });

    const result = await runInTransaction(async (session) => {
      const lookups = [
        User.findById(creditor).session(session),
        User.findById(debtor).session(session)
      ];
      if (cleanWitnessId) lookups.push(User.findById(cleanWitnessId).session(session));
      const [creditorUser, debtorUser, witnessUser] = await Promise.all(lookups);

      if (!creditorUser || !debtorUser)
        throw new Error('Кредитор или должник не найден');
      if (cleanWitnessId && !witnessUser)
        throw new Error('Свидетель не найден');

      // Дружба между участниками (если creditor !== debtor)
      if (creditor !== debtor) {
        if (!creditorUser.friends.map(f => f.toString()).includes(debtor) ||
            !debtorUser.friends.map(f => f.toString()).includes(creditor))
          throw new Error('Создавать долги можно только между друзьями');
      }

      // Свидетель должен быть другом хотя бы одной из сторон
      if (cleanWitnessId && witnessUser) {
        const witnessFriendOfCreditor = creditorUser.friends.map(f => f.toString()).includes(cleanWitnessId);
        const witnessFriendOfDebtor   = debtorUser.friends.map(f => f.toString()).includes(cleanWitnessId);
        if (!witnessFriendOfCreditor && !witnessFriendOfDebtor)
          throw new Error('Свидетель должен быть другом кредитора или должника');
      }

      // Ретроактивность: если incurredAt в прошлом — применяем пеню сразу при создании
      const actualStartDate = incurredAt ? new Date(incurredAt) : new Date();
      const now             = new Date();
      const diffDaysRetro   = Math.floor((now - actualStartDate) / (1000 * 60 * 60 * 24));
      const rate            = penaltyRate !== undefined ? Number(penaltyRate) : 0.01;
      let startingAmount    = promisedReturnAmount ? Number(promisedReturnAmount) : Number(amount);

      if (diffDaysRetro > 7 && incurredAt) {
        const overdueDays  = diffDaysRetro - 7;
        const penaltyMult  = 1 + rate * overdueDays;
        startingAmount     = Math.round(startingAmount * penaltyMult * 100) / 100;
      }

      const transaction = new Transaction({
        creditor, debtor,
        amount:        startingAmount,
        originalAmount: Number(amount),
        promisedReturnAmount: promisedReturnAmount ? Number(promisedReturnAmount) : null,
        paidAmount:    0,
        description,
        dueDate:       new Date(dueDate),
        incurredAt:    actualStartDate,
        penaltyRate:   rate,
        witness:       cleanWitnessId || null,
        witnessStatus: cleanWitnessId ? 'pending' : 'none',
        status:        cleanWitnessId ? 'pending_witness' : 'pending_approval',
        createdBy
      });
      await transaction.save({ session });

      return { transaction, creditorUser, debtorUser, witnessUser };
    });

    const { transaction, creditorUser, debtorUser, witnessUser } = result;

    // 📣 Telegram: уведомить участников
    if (cleanWitnessId && witnessUser) {
      tg.notifyWitnessRequest({
        creditorName: creditorUser.name,
        debtorName: debtorUser.name,
        amount: Number(amount),
        promisedReturnAmount: promisedReturnAmount ? Number(promisedReturnAmount) : null,
        description,
        dueDate,
        witnessTelegramId: witnessUser.telegramId,
        debtorTelegramId: debtorUser.telegramId,
        creditorTelegramId: creditorUser.telegramId
      });
    } else {
      // Без свидетеля — уведомить только должника и кредитора
      tg.notifyDebtCreated({
        creditorName: creditorUser.name,
        debtorName: debtorUser.name,
        amount: Number(amount),
        description,
        dueDate,
        debtorTelegramId: debtorUser.telegramId
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    console.error('[createDebt]', error);
    res.status(500).json({ error: error.message || 'Ошибка создания долга' });
  }
}

// ── Подтверждение/отклонение свидетелем ──────────────────────────────────────
async function witnessDecision(req, res) {
  try {
    const { transactionId } = req.params;
    const { action }        = req.body; // 'approve' | 'reject'
    const userId            = req.user;

    const result = await runInTransaction(async (session) => {
      const tx = await Transaction.findById(transactionId)
        .populate('creditor debtor witness')
        .session(session);
      if (!tx) throw new Error('Долг не найден');

      if (tx.witness?._id.toString() !== userId.toString())
        throw new Error('Вы не являетесь свидетелем этого долга');
      if (tx.status !== 'pending_witness')
        throw new Error('Долг уже обработан свидетелем');

      if (action === 'approve') {
        tx.witnessStatus = 'approved';
        tx.status        = 'pending_approval'; // теперь должник подтверждает
        await tx.save({ session });

        // Обновляем статистику свидетеля и проверяем достижения
        const witnessUser = await User.findById(userId).session(session);
        if (witnessUser) {
          witnessUser.stats.totalDebtsWitnessed = (witnessUser.stats.totalDebtsWitnessed || 0) + 1;
          await witnessUser.save({ session });
          const { checkAndAward } = require('../utils/achievementHelper');
          await checkAndAward(userId, 'witnesses_count');
        }
      } else if (action === 'reject') {
        tx.witnessStatus = 'rejected';
        tx.status        = 'declined';
        await tx.save({ session });
      } else {
        throw new Error('Неверное действие. Ожидается: approve | reject');
      }
      return tx;
    });

    const notifyText = action === 'approve'
      ? `✅ <b>Свидетель подтвердил долг!</b>\n\n` +
        `👤 Кредитор: <b>${result.creditor.name}</b>\n` +
        `👤 Должник: <b>${result.debtor.name}</b>\n` +
        `💰 ${result.originalAmount} ₸\n\n` +
        `⚠️ Должник должен подтвердить долг в приложении Azadolg!`
      : `❌ <b>Свидетель отклонил долг!</b>\n\n` +
        `👤 Кредитор: <b>${result.creditor.name}</b>\n` +
        `👤 Должник: <b>${result.debtor.name}</b>\n` +
        `💰 ${result.originalAmount} ₸\n\n` +
        `Долг аннулирован.`;

    if (result.debtor.telegramId)   tg.sendMessage(notifyText, result.debtor.telegramId);
    if (result.creditor.telegramId) tg.sendMessage(notifyText, result.creditor.telegramId);
    if (result.witness?.telegramId)  tg.sendMessage(notifyText, result.witness.telegramId);
    tg.sendMessage(notifyText);

    res.status(200).json({ message: `Решение свидетеля: ${action}`, transaction: result });
  } catch (error) {
    console.error('[witnessDecision]', error);
    res.status(500).json({ error: error.message || 'Ошибка при обработке решения свидетеля' });
  }
}

// ── Получение долгов с расчётом пени ─────────────────────────────────────────
async function getDebts(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'Не указан ID пользователя' });

    const transactions = await Transaction.find({
      $or: [
        { creditor: userId },
        { debtor: userId },
        { witness: userId }
      ],
      status: { $in: ['active', 'partially_paid', 'pending_approval', 'pending_witness'] }
    }).populate('creditor debtor witness', 'name email username eloRating telegramId avatar');

    const now    = new Date();
    const result = await Promise.all(transactions.map(async t => {
      if (t.status === 'pending_approval' || t.status === 'pending_witness') {
        return { ...t.toObject(), amount: t.originalAmount, penaltyAccrued: 0, isOverdue: false, daysSinceCreation: 0 };
      }

      const currentAmount  = getCalculatedAmount(t, now);
      const penaltyAccrued = Number((currentAmount - t.originalAmount).toFixed(2));
      const startDate      = t.incurredAt || t.createdAt;
      const diffDays       = Math.floor((now - new Date(startDate)) / (1000 * 60 * 60 * 24));
      const isOverdue      = diffDays > 7;
      const remaining      = Math.max(0, currentAmount - (t.paidAmount || 0));

      if (diffDays === 8 && penaltyAccrued > 0 && t.debtor._id.toString() === userId) {
        tg.notifyPenaltyApplied({
          debtorName: t.debtor.name, creditorName: t.creditor.name,
          originalAmount: t.originalAmount, newAmount: currentAmount,
          debtorTelegramId: t.debtor.telegramId
        });
      }

      return { ...t.toObject(), amount: currentAmount, penaltyAccrued, isOverdue, daysSinceCreation: diffDays, remaining };
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error('[getDebts]', error);
    res.status(500).json({ error: 'Ошибка получения списка долгов' });
  }
}

// ── Загрузка пруфа оплаты + частичный платёж ─────────────────────────────────
async function submitPaymentProof(req, res) {
  try {
    const { transactionId } = req.params;
    const { partialAmount } = req.body;  // опционально: частичная сумма
    const userId            = req.user;

    if (!req.file)
      return res.status(400).json({ error: 'Необходимо прикрепить пруф оплаты (изображение)' });

    const result = await runInTransaction(async (session) => {
      const tx = await Transaction.findById(transactionId).populate('creditor debtor').session(session);
      if (!tx) throw new Error('Долг не найден');
      if (tx.status !== 'active' && tx.status !== 'partially_paid')
        throw new Error(`Долг имеет статус "${tx.status}" и не может быть оплачен`);

      // Только должник или третье лицо может вносить платёж
      const isDebtor       = tx.debtor._id.toString() === userId.toString();
      const isCreditor     = tx.creditor._id.toString() === userId.toString();
      if (isCreditor && !isDebtor)
        throw new Error('Кредитор не может сам закрыть этот долг. Используйте "Простить долг".');

      const now          = new Date();
      const currentAmount = getCalculatedAmount(tx, now);
      const remaining    = Math.max(0, currentAmount - (tx.paidAmount || 0));

      // Определяем сумму платежа
      const payAmt = partialAmount
        ? Math.min(Number(partialAmount), remaining)
        : remaining;

      if (payAmt <= 0)
        throw new Error('Долг уже полностью оплачен');

      const proofPath = `/uploads/proofs/${req.file.filename}`;

      // Добавляем запись платежа
      tx.payments.push({
        amount:     payAmt,
        paidAt:     now,
        proofImage: proofPath,
        paidBy:     userId
      });
      tx.paidAmount = (tx.paidAmount || 0) + payAmt;

      // Если не должник платит — фиксируем paidByThirdParty
      if (!isDebtor) tx.paidByThirdParty = userId;

      const isFullyPaid = tx.paidAmount >= currentAmount;

      let debtor = null;
      let creditor = null;

      if (tx.debtor._id.toString() === tx.creditor._id.toString()) {
        debtor = await User.findById(tx.debtor._id).session(session);
        creditor = debtor;
      } else {
        debtor = await User.findById(tx.debtor._id).session(session);
        creditor = await User.findById(tx.creditor._id).session(session);
      }

      // Обновление баланса Karma
      if (debtor) {
        debtor.karma -= payAmt;
      }
      if (creditor && creditor !== debtor) {
        creditor.karma += payAmt;
      }

      let note = '';
      let applyRewards = true;
      let debtorElo = 0, creditorElo = 0, karmaReward = 0, isOverdue = false;

      if (isFullyPaid) {
        // ── Полное закрытие ────────────────────────────────────────────────────
        tx.status      = 'paid';
        tx.proofImage  = proofPath;
        tx.resolvedAt  = now;
        await tx.save({ session });

        // Пересчёт ELO с антифарм-капом
        const eloObj = calculateEloChange(tx, now);
        debtorElo = eloObj.debtorElo;
        creditorElo = eloObj.creditorElo;
        karmaReward = eloObj.karmaReward;
        isOverdue = eloObj.isOverdue;

        // Лимит 1 транзакция/24ч между этими двумя пользователями
        if (tx.originalAmount < 500) {
          applyRewards = false;
          note = 'Сумма < 500 ₸: ELO и Карма не начислены (защита от накрутки)';
        } else {
          const startOfDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const recentCount = await Transaction.countDocuments({
            status: 'paid', resolvedAt: { $gte: startOfDay },
            $or: [
              { debtor: tx.debtor._id, creditor: tx.creditor._id },
              { debtor: tx.creditor._id, creditor: tx.debtor._id }
            ]
          }).session(session);
          if (recentCount > 1) {
            applyRewards = false;
            note = 'Превышен лимит возвратов (1 за 24ч между этими пользователями). ELO/Карма не начислены.';
          }
        }

        if (applyRewards) {
          if (debtor) {
            debtor.eloRating = Math.max(100, debtor.eloRating + debtorElo);
            debtor.karma     += karmaReward;
            if (!isOverdue) { debtor.winStreak++; debtor.stats.debtsPaidOnTime++; }
            else              debtor.winStreak = 0;
            debtor.stats.totalDebtsPaid++;
            debtor.stats.totalKarmaEarned += karmaReward;
            const { addXP } = require('../utils/battlePassHelper');
            await addXP(debtor, isOverdue ? 10 : 25);
          }
          if (creditor) {
            let finalCreditorElo = creditorElo;
            let creditorKarma = 0;
            if (tx.promisedReturnAmount && tx.promisedReturnAmount > tx.originalAmount) {
              const bonusElo = Math.max(10, Math.round(creditorElo * 0.5));
              finalCreditorElo += bonusElo;
              creditorKarma = Math.round((tx.promisedReturnAmount - tx.originalAmount) * 0.1);
              note += (note ? '. ' : '') + `Кредитору начислен бонус за риск: +${bonusElo} ELO и +${creditorKarma} ₸ Кармы`;
            }
            if (creditor === debtor) {
              debtor.eloRating = Math.max(100, debtor.eloRating + finalCreditorElo);
              if (creditorKarma > 0) {
                debtor.karma += creditorKarma;
                debtor.stats.totalKarmaEarned += creditorKarma;
              }
            } else {
              creditor.eloRating = Math.max(100, creditor.eloRating + finalCreditorElo);
              if (creditorKarma > 0) {
                creditor.karma += creditorKarma;
                creditor.stats.totalKarmaEarned += creditorKarma;
              }
            }
          }
        } else {
          if (debtor) {
            debtor.stats.totalDebtsPaid++;
          }
        }

        if (debtor) await debtor.save({ session });
        if (creditor && creditor !== debtor) await creditor.save({ session });

        if (debtor) {
          const { checkAndAward } = require('../utils/achievementHelper');
          await checkAndAward(debtor._id, 'debts_paid_count');
        }

        // Расчёт ставок тотализатора
        try {
          const { resolveBetsForDebt } = require('./betController');
          await resolveBetsForDebt(transactionId, isOverdue, session);
        } catch (e) { console.error('Ошибка тотализатора:', e); }

      } else {
        // ── Частичный платёж ───────────────────────────────────────────────────
        tx.status = 'partially_paid';
        await tx.save({ session });

        if (debtor) await debtor.save({ session });
        if (creditor && creditor !== debtor) await creditor.save({ session });
      }

      return {
        tx,
        isFullyPaid,
        payAmt,
        currentAmount,
        debtorElo,
        karmaReward,
        isOverdue,
        note,
        debtorName: debtor?.name,
        debtorTelegramId: debtor?.telegramId,
        creditorName: creditor?.name,
        creditorTelegramId: creditor?.telegramId
      };
    });

    if (result.isFullyPaid) {
      tg.notifyDebtPaid({
        debtorName:   result.debtorName   || 'Неизвестно',
        creditorName: result.creditorName || 'Неизвестно',
        amount:       result.currentAmount,
        eloChangeDebtor: result.note.includes('не начислены') ? 0 : result.debtorElo,
        karmaEarned:     result.note.includes('не начислены') ? 0 : result.karmaReward,
        isOverdue:    result.isOverdue,
        debtorTelegramId: result.debtorTelegramId,
        creditorTelegramId: result.creditorTelegramId,
        note: result.note
      });

      return res.status(200).json({
        message:   'Долг полностью оплачен! 🎉',
        fullyPaid: true, note: result.note, transaction: result.tx
      });
    } else {
      const remainingAfter = Math.max(0, result.currentAmount - result.tx.paidAmount);
      const notifyText = `💳 <b>Частичный платёж по долгу!</b>\n\n` +
        `👤 Кредитор: <b>${result.creditorName}</b>\n` +
        `👤 Должник: <b>${result.debtorName}</b>\n` +
        `✅ Внесено: <b>${result.payAmt} ₸</b>\n` +
        `💰 Остаток: <b>${remainingAfter} ₸</b> из ${result.currentAmount} ₸\n\n` +
        `Пруф прикреплён. Кредитор может просмотреть.`;

      if (result.creditorTelegramId) tg.sendMessage(notifyText, result.creditorTelegramId);

      return res.status(200).json({
        message:    `Частичный платёж на ${result.payAmt} ₸ принят`,
        fullyPaid:  false,
        paidAmount: result.tx.paidAmount,
        remaining:  remainingAfter,
        transaction: result.tx
      });
    }
  } catch (error) {
    console.error('[submitPaymentProof]', error);
    res.status(500).json({ error: error.message || 'Ошибка при обработке оплаты' });
  }
}

// ── Прощение долга кредитором ─────────────────────────────────────────────────
async function forgiveDebt(req, res) {
  try {
    const { transactionId } = req.params;
    const userId            = req.user;

    const result = await runInTransaction(async (session) => {
      const tx = await Transaction.findById(transactionId).populate('creditor debtor').session(session);
      if (!tx) throw new Error('Долг не найден');
      if (tx.creditor._id.toString() !== userId.toString())
        throw new Error('Только кредитор может простить долг');
      if (!['active', 'pending_approval'].includes(tx.status))
        throw new Error(`Нельзя простить долг со статусом "${tx.status}"`);

      const now      = new Date();
      tx.status      = 'forgiven';
      tx.forgiven    = true;
      tx.forgivenAt  = now;
      tx.resolvedAt  = now;
      await tx.save({ session });

      // ELO кредитора: логарифмический бонус за благородство
      const eloBonus = calcForgiveEloBonus(tx.originalAmount);
      const creditor = await User.findById(tx.creditor._id).session(session);
      if (creditor) {
        creditor.eloRating += eloBonus;
        creditor.stats.totalDebtsForgivenByMe = (creditor.stats.totalDebtsForgivenByMe || 0) + 1;
        await creditor.save({ session });
      }
      return { tx, eloBonus };
    });

    const { tx, eloBonus } = result;

    const { checkAndAward } = require('../utils/achievementHelper');
    await checkAndAward(tx.creditor._id, 'forgiven_count');

    const notifyText = `💝 <b>Долг прощён!</b>\n\n` +
      `👤 Кредитор <b>${tx.creditor.name}</b> простил долг <b>${tx.debtor.name}</b>!\n` +
      `💰 Сумма прощения: <b>${tx.originalAmount} ₸</b>\n` +
      `🏆 За благородство: <b>+${eloBonus} ELO</b>`;

    if (tx.debtor.telegramId)   tg.sendMessage(notifyText, tx.debtor.telegramId);
    if (tx.creditor.telegramId) tg.sendMessage(notifyText, tx.creditor.telegramId);
    tg.sendMessage(notifyText);

    res.status(200).json({
      message:   `Долг прощён! Вы получили +${eloBonus} ELO за благородство`,
      eloBonus, transaction: tx
    });
  } catch (error) {
    console.error('[forgiveDebt]', error);
    res.status(500).json({ error: error.message || 'Ошибка при прощении долга' });
  }
}

// ── Передача долга другому должнику ──────────────────────────────────────────
async function transferDebt(req, res) {
  try {
    const { transactionId }  = req.params;
    const { newDebtorId }    = req.body;
    const userId             = req.user;

    const result = await runInTransaction(async (session) => {
      const tx = await Transaction.findById(transactionId).populate('creditor debtor').session(session);
      if (!tx) throw new Error('Долг не найден');
      if (tx.debtor._id.toString() !== userId.toString())
        throw new Error('Только должник может передать долг');
      if (tx.status !== 'active')
        throw new Error('Передача возможна только для активного долга');

      const [newDebtor, creditor] = await Promise.all([
        User.findById(newDebtorId).session(session),
        User.findById(tx.creditor._id).session(session)
      ]);
      if (!newDebtor)
        throw new Error('Новый должник не найден');

      // Новый должник должен быть другом кредитора
      if (!creditor.friends.map(f => f.toString()).includes(newDebtorId))
        throw new Error('Передать долг можно только другу кредитора');

      tx.transferredTo = tx.debtor._id;
      tx.debtor        = newDebtorId;
      tx.status        = 'pending_approval'; // новый должник должен подтвердить
      await tx.save({ session });

      return { tx, newDebtor, creditor };
    });

    const notifyText = `🔄 <b>Долг передан!</b>\n\n` +
      `💰 ${result.tx.originalAmount} ₸ передан новому должнику: <b>${result.newDebtor.name}</b>\n` +
      `Кредитор: <b>${result.creditor.name}</b>\n\n` +
      `⚠️ ${result.newDebtor.name}, подтвердите принятие долга в приложении!`;

    if (result.newDebtor.telegramId) tg.sendMessage(notifyText, result.newDebtor.telegramId);
    if (result.creditor.telegramId)  tg.sendMessage(notifyText, result.creditor.telegramId);

    res.status(200).json({ message: `Долг передан пользователю ${result.newDebtor.name}`, transaction: result.tx });
  } catch (error) {
    console.error('[transferDebt]', error);
    res.status(500).json({ error: error.message || 'Ошибка при передаче долга' });
  }
}

// ── Оплата за друга (третье лицо вносит пруф) ────────────────────────────────
// Используем тот же submitPaymentProof — третье лицо просто делает запрос
// и paidByThirdParty фиксируется автоматически

// ── Подтверждение долга (должник) ────────────────────────────────────────────
async function confirmDebt(req, res) {
  try {
    const { transactionId } = req.params;
    const userId            = req.user;

    const result = await runInTransaction(async (session) => {
      const tx = await Transaction.findById(transactionId).populate('creditor debtor').session(session);
      if (!tx) throw new Error('Долг не найден');
      if (tx.status !== 'pending_approval')
        throw new Error('Долг не ожидает подтверждения должником');

      const isParticipant = [tx.debtor._id.toString(), tx.creditor._id.toString()].includes(userId.toString());
      if (!isParticipant)
        throw new Error('Вы не являетесь участником этого долга');

      tx.status = 'active';
      await tx.save({ session });

      // Сбрасываем подряд идущие отклонения, если подтвердили запрос
      if (tx.createdBy.toString() !== userId.toString()) {
        const user = await User.findById(userId).session(session);
        if (user) {
          user.consecutiveDeclines = 0;
          await user.save({ session });
        }
      }
      return tx;
    });

    // Проверяем достижение "Мамкин инвестор" для должника
    const { checkAndAward } = require('../utils/achievementHelper');
    await checkAndAward(result.debtor._id, 'active_debts_count');

    const text = `✅ <b>Долг подтверждён!</b>\n\n` +
      `👤 Кредитор: <b>${result.creditor.name}</b>\n` +
      `👤 Должник: <b>${result.debtor.name}</b>\n` +
      `💰 Сумма: <b>${result.originalAmount} ₸</b>\n\n` +
      `Долг теперь АКТИВЕН в ELO-системе.`;

    tg.sendMessage(text);
    if (result.debtor.telegramId)   tg.sendMessage(text, result.debtor.telegramId);
    if (result.creditor.telegramId) tg.sendMessage(text, result.creditor.telegramId);

    res.status(200).json({ message: 'Долг успешно подтверждён!', transaction: result });
  } catch (error) {
    console.error('[confirmDebt]', error);
    res.status(500).json({ error: error.message || 'Ошибка подтверждения долга' });
  }
}

// ── Отклонение долга ──────────────────────────────────────────────────────────
async function declineDebt(req, res) {
  try {
    const { transactionId } = req.params;
    const userId            = req.user;

    const result = await runInTransaction(async (session) => {
      const tx = await Transaction.findById(transactionId).populate('creditor debtor').session(session);
      if (!tx) throw new Error('Долг не найден');
      if (!['pending_approval', 'pending_witness'].includes(tx.status))
        throw new Error('Долг не может быть отклонён в текущем статусе');

      const isParticipant = [tx.debtor._id.toString(), tx.creditor._id.toString()].includes(userId.toString());
      if (!isParticipant)
        throw new Error('Вы не являетесь участником этого долга');

      tx.status = 'declined';
      await tx.save({ session });

      // Проверяем, было ли это отклонение входящего запроса
      if (tx.createdBy.toString() !== userId.toString()) {
        const user = await User.findById(userId).session(session);
        if (user) {
          user.consecutiveDeclines = (user.consecutiveDeclines || 0) + 1;
          await user.save({ session });
        }
      }
      return tx;
    });

    const { checkAndAward } = require('../utils/achievementHelper');
    await checkAndAward(userId, 'declined_loan_streak');

    const text = `❌ <b>Долг отклонён!</b>\n\n` +
      `👤 Кредитор: <b>${result.creditor.name}</b>\n` +
      `👤 Должник: <b>${result.debtor.name}</b>\n` +
      `💰 ${result.originalAmount} ₸\n\nДолг аннулирован.`;

    tg.sendMessage(text);
    if (result.debtor.telegramId)   tg.sendMessage(text, result.debtor.telegramId);
    if (result.creditor.telegramId) tg.sendMessage(text, result.creditor.telegramId);

    res.status(200).json({ message: 'Долг успешно отклонён', transaction: result });
  } catch (error) {
    console.error('[declineDebt]', error);
    res.status(500).json({ error: error.message || 'Ошибка отклонения долга' });
  }
}

// ── Legacy payDebt (для обратной совместимости — переадресует в submitPaymentProof) ──
async function payDebt(req, res) {
  // Эмулируем: нет файла — возвращаем понятную ошибку
  return res.status(400).json({
    error: 'Для оплаты долга теперь требуется прикрепить пруф оплаты. Используйте эндпоинт POST /:id/pay-proof'
  });
}

module.exports = {
  createDebt,
  witnessDecision,
  getDebts,
  submitPaymentProof,
  forgiveDebt,
  transferDebt,
  confirmDebt,
  declineDebt,
  payDebt
};
