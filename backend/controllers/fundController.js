const User = require('../models/User');
const Fund = require('../models/Fund');
const tg = require('../services/telegramService');

// Создать сбор (краудфандинг)
async function createFund(req, res) {
  try {
    const { title, targetAmount } = req.body;
    const creatorId = req.user;

    if (!title || !targetAmount || targetAmount <= 0) {
      return res.status(400).json({ error: 'Необходимо указать название и сумму сбора больше 0' });
    }

    const fund = new Fund({
      creator: creatorId,
      title,
      targetAmount,
      currentAmount: 0,
      contributions: [],
      status: 'active'
    });

    await fund.save();

    const creator = await User.findById(creatorId);

    // 📣 Telegram-уведомление о создании сбора
    tg.sendMessage(
      `📢 <b>Новый краудфандинг!</b>\n\n` +
      `👤 Организатор: <b>${creator.name}</b>\n` +
      `🎯 Цель: <b>"${title}"</b>\n` +
      `💰 Необходимая сумма: <b>${targetAmount} ₸ Кармы</b>\n` +
      `🤝 Поддержите сбор в приложении Azadolg!`
    );

    res.status(201).json({ message: 'Сбор успешно создан!', fund });
  } catch (error) {
    console.error('Ошибка создания сбора:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании сбора' });
  }
}

// Сделать взнос в сбор
async function contributeToFund(req, res) {
  try {
    const { fundId, amount } = req.body;
    const userId = req.user;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Сумма взноса должна быть больше нуля' });
    }

    const [user, fund] = await Promise.all([
      User.findById(userId),
      Fund.findById(fundId)
    ]);

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (!fund) return res.status(404).json({ error: 'Сбор не найден' });

    if (fund.status !== 'active') {
      return res.status(400).json({ error: 'Этот сбор уже завершен' });
    }

    if (user.karma < amount) {
      return res.status(400).json({ error: `Недостаточно Кармы. Требуется: ${amount} ₸, у вас: ${user.karma} ₸.` });
    }

    // Списываем карму у пользователя
    user.karma -= amount;
    await user.save();

    // Добавляем взнос
    fund.currentAmount += amount;
    fund.contributions.push({ contributor: userId, amount });

    // Проверяем достижение цели
    if (fund.currentAmount >= fund.targetAmount) {
      fund.status = 'completed';
    }

    await fund.save();

    // 📣 Telegram-уведомление о взносе
    tg.sendMessage(
      `💸 <b>Взнос в краудфандинг!</b>\n\n` +
      `👤 <b>${user.name}</b> внёс <b>${amount} ₸ Кармы</b> в сбор <b>"${fund.title}"</b>.\n` +
      `📊 Собрано: <b>${fund.currentAmount} / ${fund.targetAmount} ₸ Кармы</b>` +
      (fund.status === 'completed' ? `\n\n🎉 <b>Цель успешно достигнута! Всем спасибо за участие!</b>` : '')
    );

    res.status(200).json({
      message: 'Взнос успешно засчитан!',
      fund,
      userKarma: user.karma
    });
  } catch (error) {
    console.error('Ошибка взноса в краудфандинг:', error);
    res.status(500).json({ error: 'Ошибка сервера при совершении взноса' });
  }
}

// Получить список всех сборов
async function getFunds(req, res) {
  try {
    const funds = await Fund.find()
      .populate('creator', 'name username eloRating avatar')
      .populate('contributions.contributor', 'name username eloRating avatar')
      .sort({ createdAt: -1 });

    res.status(200).json(funds);
  } catch (error) {
    console.error('Ошибка получения сборов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  createFund,
  contributeToFund,
  getFunds
};
