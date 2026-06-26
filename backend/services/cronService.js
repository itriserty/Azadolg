const cron = require('node-cron');
const User = require('../models/User');
const SystemState = require('../models/SystemState');
const tg = require('./telegramService');

// Розыгрыш еженедельного джекпота
async function drawJackpot() {
  try {
    console.log('[CronService] Запуск розыгрыша еженедельного Джекпота...');
    
    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
      await state.save();
    }

    const jackpotAmount = state.jackpotPool;
    if (jackpotAmount <= 0) {
      console.log('[CronService] Джекпот пуст. Розыгрыш отменен.');
      return;
    }

    // Находим всех зарегистрированных пользователей
    const users = await User.find({ username: { $exists: true, $ne: null } });
    if (users.length === 0) {
      console.log('[CronService] Нет пользователей для розыгрыша.');
      return;
    }

    // Выбираем случайного победителя
    const randomIndex = Math.floor(Math.random() * users.length);
    const winner = users[randomIndex];

    // Начисляем джекпот победителю
    winner.karma += jackpotAmount;
    winner.stats.totalKarmaEarned += jackpotAmount;
    await winner.save();

    // Сбрасываем джекпот
    state.jackpotPool = 0;
    await state.save();

    console.log(`[CronService] Победитель джекпота: ${winner.name} (@${winner.username}), выигрыш: ${jackpotAmount} ₸ Кармы.`);

    // Уведомление в Телеграм
    const text = `🎉 <b>ЕЖЕНЕДЕЛЬНЫЙ ДЖЕКПОТ АZADOLG!</b> 🎉\n\n` +
      `👑 Счастливчик недели: <b>${winner.name}</b> (@${winner.username || 'нет'})\n` +
      `💰 Выигрыш: <b>${jackpotAmount} ₸ Кармы</b>\n\n` +
      `Копите карму, делайте ставки на долги, участвуйте в дуэлях Coinflip и выигрывайте джекпот каждую неделю! 🚀`;

    tg.sendMessage(text);
    if (winner.telegramId) {
      tg.sendMessage(`🎉 Поздравляем! Вы выиграли еженедельный джекпот в размере <b>${jackpotAmount} ₸ Кармы</b>! 💰`, winner.telegramId);
    }
  } catch (error) {
    console.error('[CronService] Ошибка розыгрыша джекпота:', error);
  }
}

// Проверка и смена сезона
async function checkSeasonReset() {
  try {
    console.log('[CronService] Проверка смены сезонов...');
    
    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
      await state.save();
    }

    const now = new Date();
    if (now >= state.seasonEndsAt) {
      const oldSeason = state.currentSeason;
      const newSeason = oldSeason + 1;
      
      // Смена сезона
      state.currentSeason = newSeason;
      const nextEnd = new Date();
      nextEnd.setDate(nextEnd.getDate() + 30);
      state.seasonEndsAt = nextEnd;
      await state.save();

      // Сброс ELO-рейтингов (софт-ресет) для всех пользователей
      const users = await User.find();
      for (const user of users) {
        // Мягкий сброс рейтинга к 1000 ELO (сохраняем половину отклонения от базы)
        user.eloRating = Math.round(1000 + (user.eloRating - 1000) * 0.5);
        user.winStreak = 0;
        
        // Сброс Боевого Пропуска
        user.battlePassLevel = 1;
        user.battlePassXP = 0;
        await user.save();
      }

      console.log(`[CronService] Сезон ${oldSeason} завершен! Новый сезон: ${newSeason}`);

      // Telegram-уведомление
      const text = `🏁 <b>СЕЗОН ${oldSeason} ЗАВЕРШЕН!</b> 🏁\n\n` +
        `⚔️ Начался новый <b>Сезон ${newSeason}</b>!\n` +
        `📈 Все ELO-рейтинги прошли мягкий сброс (софт-ресет).\n` +
        `🎒 Уровни Боевого Пропуска сброшены к 1.\n\n` +
        `Самое время начать восхождение к Global Elite и заработать новые рамки и скины! 🏆`;

      tg.sendMessage(text);
    } else {
      console.log(`[CronService] Текущий сезон ${state.currentSeason} активен до ${state.seasonEndsAt.toLocaleDateString('ru-RU')}`);
    }
  } catch (error) {
    console.error('[CronService] Ошибка смены сезона:', error);
  }
}

// ── Еженедельный базовый доход Кармы ─────────────────────────────────────────
async function distributeWeeklyKarma() {
  try {
    console.log('[CronService] Запуск еженедельного распределения Кармы...');
    const Transaction = require('../models/Transaction');
    const WEEKLY_KARMA = 100;
    const ACTIVITY_DAYS = 30;
    const cutoff = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000);

    // Активные: зашли за последние 30 дней ИЛИ имеют активный долг
    const activeDebtorIds = await Transaction.distinct('debtor',   { status: 'active' });
    const activeCreditorIds = await Transaction.distinct('creditor', { status: 'active' });
    const activeDebtUsers = [...new Set([...activeDebtorIds.map(String), ...activeCreditorIds.map(String)])];

    const users = await User.find({
      isBanned: { $ne: true },
      $or: [
        { lastLoginAt: { $gte: cutoff } },
        { _id: { $in: activeDebtUsers } }
      ]
    });

    let count = 0;
    for (const user of users) {
      user.karma                           += WEEKLY_KARMA;
      user.stats.totalKarmaEarned          += WEEKLY_KARMA;
      user.stats.totalKarmaWeeklyReceived  = (user.stats.totalKarmaWeeklyReceived || 0) + WEEKLY_KARMA;
      await user.save();
      count++;
    }

    console.log(`[CronService] Еженедельная Карма: +${WEEKLY_KARMA} начислено ${count} активным пользователям`);

    tg.sendMessage(
      `📅 <b>Еженедельная Карма распределена!</b>\n\n` +
      `💰 <b>+${WEEKLY_KARMA} ₸ Кармы</b> получили <b>${count}</b> активных пользователей.\n` +
      `Продолжайте пользоваться Azadolg — и карма растёт! 🚀`
    );
  } catch (error) {
    console.error('[CronService] Ошибка распределения Кармы:', error);
  }
}

function startCronScheduler() {
  // Еженедельный базовый доход Кармы: каждый понедельник в 09:00
  cron.schedule('0 9 * * 1', () => {
    distributeWeeklyKarma();
  });

  // Розыгрыш джекпота каждое воскресенье в 23:59
  cron.schedule('59 23 * * 0', () => {
    drawJackpot();
  });

  // Проверка смены сезонов каждый день в 00:00
  cron.schedule('0 0 * * *', () => {
    checkSeasonReset();
  });

  console.log('[CronService] Планировщик cron запущен (Карма: Пн 09:00 | Джекпот: Вс 23:59 | Сезон: ежедневно)');
}

module.exports = {
  drawJackpot,
  checkSeasonReset,
  distributeWeeklyKarma,
  startCronScheduler
};
