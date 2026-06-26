const Debt = require('../models/Debt');
const User = require('../models/User');
const { calculateCurrentDebt } = require('../services/debtService');

/**
 * Создание нового долга (в статусе ожидания подтверждения)
 * POST /debts/create
 */
async function createDebt(req, res) {
  try {
    const { creditor, debtor, amount, penaltyRate, dueDate } = req.body;
    
    // Базовая валидация
    if (!creditor || !debtor || !amount || !dueDate) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены: creditor, debtor, amount, dueDate' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Сумма долга должна быть больше нуля' });
    }

    // Проверяем существование кредитора и должника
    const creditorUser = await User.findById(creditor);
    const debtorUser = await User.findById(debtor);
    
    if (!creditorUser || !debtorUser) {
      return res.status(404).json({ error: 'Кредитор или должник не найден' });
    }

    if (creditor === debtor) {
      return res.status(400).json({ error: 'Нельзя создать долг самому себе' });
    }

    // Создаем долг в статусе 'pending_confirmation'
    const newDebt = new Debt({
      creditor,
      debtor,
      amount,
      penaltyRate: penaltyRate !== undefined ? penaltyRate : 0.01,
      dueDate: new Date(dueDate),
      status: 'pending_confirmation'
    });

    await newDebt.save();

    res.status(201).json({
      message: 'Запрос на создание долга успешно отправлен. Ожидается подтверждение должником.',
      debt: newDebt
    });
  } catch (error) {
    console.error('Ошибка в createDebt:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

/**
 * Подтверждение долга второй стороной (должником)
 * POST /debts/:id/confirm
 */
async function confirmDebt(req, res) {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id']; // Симулируем ID текущего авторизованного пользователя

    if (!userId) {
      return res.status(401).json({ error: 'Требуется авторизация (заголовок x-user-id)' });
    }

    const debt = await Debt.findById(id);
    if (!debt) {
      return res.status(404).json({ error: 'Долг не найден' });
    }

    // Долг должен подтверждать именно должник
    if (debt.debtor.toString() !== userId) {
      return res.status(403).json({ error: 'Только должник может подтвердить этот долг' });
    }

    if (debt.status !== 'pending_confirmation') {
      return res.status(400).json({ error: `Этот долг нельзя подтвердить, так как он в статусе: ${debt.status}` });
    }

    debt.status = 'active';
    await debt.save();

    res.status(200).json({
      message: 'Долг успешно подтвержден и переведен в статус active.',
      debt
    });
  } catch (error) {
    console.error('Ошибка в confirmDebt:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

/**
 * Получение долга с расчетом актуальной суммы (с учетом пени)
 * GET /debts/:id
 */
async function getDebt(req, res) {
  try {
    const { id } = req.params;
    const debt = await Debt.findById(id).populate('creditor debtor', 'name email');
    
    if (!debt) {
      return res.status(404).json({ error: 'Долг не найден' });
    }

    const currentAmount = calculateCurrentDebt(debt);

    res.status(200).json({
      debt,
      originalAmount: debt.amount,
      currentAmount
    });
  } catch (error) {
    console.error('Ошибка в getDebt:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

module.exports = {
  createDebt,
  confirmDebt,
  getDebt
};
