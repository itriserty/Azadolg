const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getCalculatedAmount } = require('../utils/debtHelper');
const tg = require('../services/telegramService');

/**
 * Пересчёт ELO при закрытии долга.
 *  ≤7 дней → должник +30, кредитор +10, 50 coins
 *  >7 дней → должник -20, кредитор +5, 10 coins
 */
function calculateEloChange(transaction, now = new Date()) {
  const diffDays = Math.floor((now - new Date(transaction.createdAt)) / (1000 * 60 * 60 * 24));
  return diffDays <= 7
    ? { debtorElo: +30, creditorElo: +10, coinsReward: 50,  isOverdue: false }
    : { debtorElo: -20, creditorElo:  +5, coinsReward: 10,  isOverdue: true  };
}

// ── Создание долга ────────────────────────────────────────────────────────────
async function createDebt(req, res) {
  try {
    const { creditor, debtor, amount, description, dueDate, penaltyRate } = req.body;
    const createdBy = req.user;

    if (!creditor || !debtor || !amount || !description || !dueDate)
      return res.status(400).json({ error: 'Заполните обязательные поля: creditor, debtor, amount, description, dueDate' });
    if (amount <= 0)    return res.status(400).json({ error: 'Сумма долга должна быть больше нуля' });
    if (creditor === debtor) return res.status(400).json({ error: 'Нельзя создать долг самому себе' });

    const [creditorUser, debtorUser] = await Promise.all([User.findById(creditor), User.findById(debtor)]);
    if (!creditorUser || !debtorUser)
      return res.status(404).json({ error: 'Кредитор или должник не найден' });

    // Проверка, что пользователи являются друзьями
    if (!creditorUser.friends.includes(debtor) || !debtorUser.friends.includes(creditor)) {
      return res.status(400).json({ error: 'Создавать долги можно только между друзьями' });
    }

    const transaction = new Transaction({
      creditor, debtor,
      amount, originalAmount: amount,
      description,
      dueDate:      new Date(dueDate),
      penaltyRate:  penaltyRate !== undefined ? penaltyRate : 0.01,
      status:       'pending_approval',
      createdBy
    });
    await transaction.save();

    // 📣 Telegram: уведомление о новом долге (требующем одобрения)
    const creatorUser = createdBy.toString() === creditor ? creditorUser : debtorUser;
    const targetUser = createdBy.toString() === creditor ? debtorUser : creditorUser;
    
    const text = `💸 <b>Создан новый долг (ожидает подтверждения)!</b>\n\n` +
      `👤 Заказчик: <b>${creatorUser.name}</b>\n` +
      `👤 Получатель: <b>${targetUser.name}</b>\n` +
      `💰 Сумма: <b>${amount} ₸</b>\n` +
      `📝 Описание: ${description}\n` +
      `📅 Срок: ${new Date(dueDate).toLocaleDateString('ru-RU')}\n\n` +
      `⚠️ Пожалуйста, подтвердите или отклоните этот долг в приложении Azadolg!`;

    if (targetUser.telegramId) {
      tg.sendMessage(text, targetUser.telegramId);
    } else {
      tg.sendMessage(text);
    }

    res.status(201).json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка создания долга' });
  }
}

// ── Получение долгов с расчётом пени ─────────────────────────────────────────
async function getDebts(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'Не указан ID пользователя' });

    const transactions = await Transaction.find({
      $or: [{ creditor: userId }, { debtor: userId }],
      status: { $in: ['active', 'pending_approval'] }
    }).populate('creditor debtor', 'name email username eloRating telegramId');

    const now = new Date();
    const result = await Promise.all(transactions.map(async t => {
      if (t.status === 'pending_approval') {
        return {
          ...t.toObject(),
          amount: t.originalAmount,
          penaltyAccrued: 0,
          isOverdue: false,
          daysSinceCreation: 0
        };
      }

      const currentAmount = getCalculatedAmount(t, now); // 5% если > 7 дней
      const penaltyAccrued = Number((currentAmount - t.originalAmount).toFixed(2));
      const diffDays = Math.floor((now - new Date(t.createdAt)) / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays > 7;

      // 📣 Telegram: уведомление о штрафе (только если только что применился, то есть exactly 7 дней)
      if (diffDays === 8 && penaltyAccrued > 0 && t.debtor._id.toString() === userId) {
        tg.notifyPenaltyApplied({
          debtorName:     t.debtor.name,
          creditorName:   t.creditor.name,
          originalAmount: t.originalAmount,
          newAmount:      currentAmount,
          debtorTelegramId: t.debtor.telegramId
        });
      }

      return {
        ...t.toObject(),
        amount: currentAmount,
        penaltyAccrued,
        isOverdue,
        daysSinceCreation: diffDays
      };
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка получения списка долгов' });
  }
}

// ── Оплата долга ──────────────────────────────────────────────────────────────
async function payDebt(req, res) {
  try {
    const { transactionId } = req.params;
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) return res.status(404).json({ error: 'Транзакция не найдена' });
    if (transaction.status !== 'active')
      return res.status(400).json({ error: `Долг уже ${transaction.status === 'paid' ? 'оплачен' : 'отклонён'}` });

    const now = new Date();
    const { debtorElo, creditorElo, coinsReward, isOverdue } = calculateEloChange(transaction, now);
    const finalAmount = getCalculatedAmount(transaction, now);

    let finalDebtorElo = debtorElo;
    let finalCreditorElo = creditorElo;
    let finalCoinsReward = coinsReward;
    let note = '';
    let isFarm = false;

    // Ограничение 1: Минимальная сумма долга 500 ₸
    if (transaction.originalAmount < 500) {
      finalDebtorElo = 0;
      finalCreditorElo = 0;
      finalCoinsReward = 0;
      note = 'Сумма долга менее 500 ₸ (защита от накрутки рейтинга). ELO и Карма не изменены.';
      isFarm = true;
    }

    // Ограничение 2: Лимит транзакций между друзьями (не более 1 за 24 часа для получения ELO/Кармы)
    if (!isFarm) {
      const startOfToday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentClosedCount = await Transaction.countDocuments({
        status: 'paid',
        resolvedAt: { $gte: startOfToday },
        $or: [
          { debtor: transaction.debtor, creditor: transaction.creditor },
          { debtor: transaction.creditor, creditor: transaction.debtor }
        ]
      });

      if (recentClosedCount > 0) {
        finalDebtorElo = 0;
        finalCreditorElo = 0;
        finalCoinsReward = 0;
        note = 'Превышен лимит (макс. 1 возврат в 24 часа между этими друзьями для ELO/Кармы).';
      }
    }

    transaction.status     = 'paid';
    transaction.amount     = finalAmount;
    transaction.resolvedAt = now;
    await transaction.save();

    // Разрешаем ставки на тотализаторе, если они были
    try {
      const { resolveBetsForDebt } = require('./betController');
      await resolveBetsForDebt(transactionId, isOverdue);
    } catch (err) {
      console.error('Ошибка расчета ставок тотализатора:', err);
    }

    const debtor = await User.findById(transaction.debtor);
    const creditor = await User.findById(transaction.creditor);

    if (debtor) {
      debtor.eloRating += finalDebtorElo;
      if (debtor.eloRating < 100) debtor.eloRating = 100;
      debtor.coins += finalCoinsReward;
      debtor.karma += finalCoinsReward;
      
      // Начисление XP Боевого Пропуска
      const { addXP } = require('../utils/battlePassHelper');
      const xpReward = isOverdue ? 10 : 25;
      await addXP(debtor, xpReward);
    }

    if (creditor) {
      creditor.eloRating += finalCreditorElo;
      await creditor.save();
    }

    // 📣 Telegram: уведомление о закрытии долга
    tg.notifyDebtPaid({
      debtorName:     debtor?.name   || 'Неизвестно',
      creditorName:   creditor?.name || 'Неизвестно',
      amount:         finalAmount,
      eloChangeDebtor: finalDebtorElo,
      coinsEarned:    finalCoinsReward,
      isOverdue,
      debtorTelegramId: debtor?.telegramId,
      note
    });

    res.status(200).json({
      message: 'Долг успешно оплачен!',
      note,
      transaction,
      rewards: {
        debtor:   { name: debtor?.name,   eloChange: finalDebtorElo,  newElo: debtor?.eloRating,   coinsEarned: finalCoinsReward },
        creditor: { name: creditor?.name, eloChange: finalCreditorElo, newElo: creditor?.eloRating }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка оплаты долга' });
  }
}

// ── Подтверждение долга ────────────────────────────────────────────────────────
async function confirmDebt(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user;

    const transaction = await Transaction.findById(transactionId).populate('creditor debtor');
    if (!transaction) return res.status(404).json({ error: 'Долг не найден' });

    if (transaction.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Этот долг уже подтвержден или отклонен' });
    }

    const isParticipant = transaction.debtor._id.toString() === userId.toString() || transaction.creditor._id.toString() === userId.toString();
    if (!isParticipant) {
      return res.status(403).json({ error: 'Вы не являетесь участником этого долга' });
    }

    transaction.status = 'active';
    await transaction.save();

    // 📣 Telegram: уведомление о подтверждении
    const text = `✅ <b>Долг подтвержден!</b>\n\n` +
      `👤 Кредитор: <b>${transaction.creditor.name}</b>\n` +
      `👤 Должник: <b>${transaction.debtor.name}</b>\n` +
      `💰 Сумма: <b>${transaction.amount} ₸</b>\n` +
      `📝 Описание: ${transaction.description}\n\n` +
      `Долг теперь официально АКТИВЕН и участвует в ELO-системе.`;

    tg.sendMessage(text);
    if (transaction.debtor.telegramId) tg.sendMessage(text, transaction.debtor.telegramId);
    if (transaction.creditor.telegramId) tg.sendMessage(text, transaction.creditor.telegramId);

    res.status(200).json({ message: 'Долг успешно подтвержден!', transaction });
  } catch (error) {
    console.error('Ошибка подтверждения долга:', error);
    res.status(500).json({ error: 'Ошибка сервера при подтверждении долга' });
  }
}

// ── Отклонение долга ───────────────────────────────────────────────────────────
async function declineDebt(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user;

    const transaction = await Transaction.findById(transactionId).populate('creditor debtor');
    if (!transaction) return res.status(404).json({ error: 'Долг не найден' });

    if (transaction.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Этот долг уже подтвержден или отклонен' });
    }

    const isParticipant = transaction.debtor._id.toString() === userId.toString() || transaction.creditor._id.toString() === userId.toString();
    if (!isParticipant) {
      return res.status(403).json({ error: 'Вы не являетесь участником этого долга' });
    }

    transaction.status = 'declined';
    await transaction.save();

    // 📣 Telegram: уведомление об отклонении
    const text = `❌ <b>Долг отклонен!</b>\n\n` +
      `👤 Кредитор: <b>${transaction.creditor.name}</b>\n` +
      `👤 Должник: <b>${transaction.debtor.name}</b>\n` +
      `💰 Сумма: <b>${transaction.amount} ₸</b>\n` +
      `📝 Описание: ${transaction.description}\n\n` +
      `Этот долг был отклонен одной из сторон и аннулирован.`;

    tg.sendMessage(text);
    if (transaction.debtor.telegramId) tg.sendMessage(text, transaction.debtor.telegramId);
    if (transaction.creditor.telegramId) tg.sendMessage(text, transaction.creditor.telegramId);

    res.status(200).json({ message: 'Долг успешно отклонен', transaction });
  } catch (error) {
    console.error('Ошибка отклонения долга:', error);
    res.status(500).json({ error: 'Ошибка сервера при отклонении долга' });
  }
}

module.exports = { createDebt, getDebts, payDebt, confirmDebt, declineDebt };
