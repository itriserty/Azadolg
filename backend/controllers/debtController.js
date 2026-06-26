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

    if (!creditor || !debtor || !amount || !description || !dueDate)
      return res.status(400).json({ error: 'Заполните обязательные поля: creditor, debtor, amount, description, dueDate' });
    if (amount <= 0)    return res.status(400).json({ error: 'Сумма долга должна быть больше нуля' });
    if (creditor === debtor) return res.status(400).json({ error: 'Нельзя создать долг самому себе' });

    const [creditorUser, debtorUser] = await Promise.all([User.findById(creditor), User.findById(debtor)]);
    if (!creditorUser || !debtorUser)
      return res.status(404).json({ error: 'Кредитор или должник не найден' });

    const transaction = new Transaction({
      creditor, debtor,
      amount, originalAmount: amount,
      description,
      dueDate:      new Date(dueDate),
      penaltyRate:  penaltyRate !== undefined ? penaltyRate : 0.01,
      status:       'active'
    });
    await transaction.save();

    // 📣 Telegram: уведомление о новом долге
    tg.notifyDebtCreated({
      creditorName: creditorUser.name,
      debtorName:   debtorUser.name,
      amount, description, dueDate
    });

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
      status: 'active'
    }).populate('creditor debtor', 'name email eloRating');

    const now = new Date();
    const result = await Promise.all(transactions.map(async t => {
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
          newAmount:      currentAmount
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

    transaction.status     = 'paid';
    transaction.amount     = finalAmount;
    transaction.resolvedAt = now;
    await transaction.save();

    const [debtor, creditor] = await Promise.all([
      User.findByIdAndUpdate(transaction.debtor,   { $inc: { eloRating: debtorElo,  coins: coinsReward } }, { new: true }),
      User.findByIdAndUpdate(transaction.creditor, { $inc: { eloRating: creditorElo } }, { new: true })
    ]);

    // ELO не ниже 100
    if (debtor && debtor.eloRating < 100)
      await User.findByIdAndUpdate(transaction.debtor, { eloRating: 100 });

    // 📣 Telegram: уведомление о закрытии долга
    tg.notifyDebtPaid({
      debtorName:     debtor?.name   || 'Неизвестно',
      creditorName:   creditor?.name || 'Неизвестно',
      amount:         finalAmount,
      eloChangeDebtor: debtorElo,
      coinsEarned:    coinsReward,
      isOverdue
    });

    res.status(200).json({
      message: 'Долг успешно оплачен!',
      transaction,
      rewards: {
        debtor:   { name: debtor?.name,   eloChange: debtorElo,  newElo: debtor?.eloRating,   coinsEarned: coinsReward },
        creditor: { name: creditor?.name, eloChange: creditorElo, newElo: creditor?.eloRating }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка оплаты долга' });
  }
}

module.exports = { createDebt, getDebts, payDebt };
