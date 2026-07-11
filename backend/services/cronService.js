const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const SystemState = require('../models/SystemState');
const tg = require('./telegramService');

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

// Розыгрыш еженедельного джекпота
async function drawJackpot() {
  try {
    console.log('[CronService] Запуск розыгрыша еженедельного Джекпота...');
    
    const result = await runInTransaction(async (session) => {
      let state = await SystemState.findOne().session(session);
      if (!state) {
        state = new SystemState();
        await state.save({ session });
      }

      const jackpotAmount = state.jackpotPool;
      if (jackpotAmount <= 0) {
        console.log('[CronService] Джекпот пуст. Розыгрыш отменен.');
        return null;
      }

      // Считаем количество подходящих пользователей
      const count = await User.countDocuments({ username: { $exists: true, $ne: null } }).session(session);
      if (count === 0) {
        console.log('[CronService] Нет пользователей для розыгрыша.');
        return null;
      }

      // Выбираем случайного победителя с помощью skip()
      const randomIndex = Math.floor(Math.random() * count);
      const winner = await User.findOne({ username: { $exists: true, $ne: null } })
        .skip(randomIndex)
        .session(session);

      if (!winner) throw new Error('Не удалось выбрать победителя джекпота');

      // Начисляем джекпот победителю
      winner.karma += jackpotAmount;
      winner.stats.totalKarmaEarned += jackpotAmount;
      await winner.save({ session });

      // Находим admin-пользователя для записи лога транзакции
      const admin = await User.findOne({ role: 'admin' }).session(session);
      const adminId = admin ? admin._id : winner._id;

      // Создаём запись в истории транзакций (Transaction)
      const Transaction = require('../models/Transaction');
      const tx = new Transaction({
        creditor: adminId,
        debtor: winner._id,
        amount: jackpotAmount,
        originalAmount: jackpotAmount,
        description: '🎰 Выигрыш в еженедельном джекпоте Azadolg!',
        dueDate: new Date(),
        status: 'paid',
        resolvedAt: new Date(),
        createdBy: adminId
      });
      await tx.save({ session });

      // Сбрасываем джекпот
      state.jackpotPool = 0;
      await state.save({ session });

      return { winner, jackpotAmount };
    });

    if (!result) return;

    const { winner, jackpotAmount } = result;
    console.log(`[CronService] Победитель джекпота: ${winner.name} (@${winner.username}), выигрыш: ${jackpotAmount} ₸ Кармы.`);

    try {
      const achievementService = require('./AchievementService');
      await achievementService.trigger('jackpot_won', { winnerId: winner._id });
    } catch (err) {
      console.error('[CronService] Ошибка вызова AchievementService для джекпота:', err);
    }

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

// Проверка и смена сезона (запускается 1-го числа каждого месяца в 00:00)
async function checkSeasonReset() {
  try {
    console.log('[CronService] Запуск ежемесячного сброса Сезона...');
    
    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
      await state.save();
    }

    const oldSeason = state.currentSeason;
    const newSeason = oldSeason + 1;
    
    // Смена сезона
    state.currentSeason = newSeason;
    const nextEnd = new Date();
    nextEnd.setMonth(nextEnd.getMonth() + 1);
    nextEnd.setDate(1);
    nextEnd.setHours(0, 0, 0, 0);
    state.seasonEndsAt = nextEnd;
    await state.save();

    // Находим победителей прошлого сезона (топ-3) по ELO
    const topUsers = await User.find({ role: 'user', isBanned: { $ne: true } })
      .sort({ eloRating: -1 })
      .limit(3);

    const badges = [
      `season_${oldSeason}_gold`,
      `season_${oldSeason}_silver`,
      `season_${oldSeason}_bronze`
    ];

    for (let i = 0; i < topUsers.length; i++) {
      const winner = topUsers[i];
      winner.badges = winner.badges || [];
      winner.badges.push(badges[i]);
      await winner.save();
      console.log(`[CronService] Выдан значок ${badges[i]} пользователю ${winner.name}`);
    }

    // Сброс ELO-рейтингов (жесткий ресет до 1000 ELO) для всех пользователей
    await User.updateMany(
      {},
      {
        $set: {
          eloRating: 1000,
          winStreak: 0,
          battlePassLevel: 1,
          battlePassXP: 0
        }
      }
    );

    console.log(`[CronService] Сезон ${oldSeason} завершен! Новый сезон: ${newSeason}`);

    // Telegram-уведомление с перечислением топ-3
    let winnersText = '';
    if (topUsers[0]) winnersText += `🥇 1-е место: <b>${topUsers[0].name}</b> (@${topUsers[0].username || 'нет'}) - ELO: ${topUsers[0].eloRating}\n`;
    if (topUsers[1]) winnersText += `🥈 2-е место: <b>${topUsers[1].name}</b> (@${topUsers[1].username || 'нет'}) - ELO: ${topUsers[1].eloRating}\n`;
    if (topUsers[2]) winnersText += `🥉 3-е место: <b>${topUsers[2].name}</b> (@${topUsers[2].username || 'нет'}) - ELO: ${topUsers[2].eloRating}\n`;

    const text = `🏁 <b>СЕЗОН ${oldSeason} ЗАВЕРШЕН!</b> 🏁\n\n` +
      `🏆 <b>Победители прошлого сезона:</b>\n${winnersText || 'Нет победителей'}\n` +
      `Победители получили уникальные памятные значки в профиль! 🎖️\n\n` +
      `⚔️ Начался новый <b>Сезон ${newSeason}</b>!\n` +
      `📈 Все ELO-рейтинги сброшены до базовых <b>1000 ELO</b>.\n` +
      `🎒 Уровни Боевого Пропуска сброшены к 1.\n\n` +
      `Самое время начать новое восхождение с чистого листа! 🏆`;

    tg.sendMessage(text);
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

    const result = await User.updateMany(
      {
        isBanned: { $ne: true },
        $or: [
          { lastLoginAt: { $gte: cutoff } },
          { _id: { $in: activeDebtUsers } }
        ]
      },
      {
        $inc: {
          karma: WEEKLY_KARMA,
          "stats.totalKarmaEarned": WEEKLY_KARMA,
          "stats.totalKarmaWeeklyReceived": WEEKLY_KARMA
        }
      }
    );

    console.log(`[CronService] Еженедельная Карма: +${WEEKLY_KARMA} начислено ${result.modifiedCount} активным пользователям`);

    tg.sendMessage(
      `📅 <b>Еженедельная Карма распределена!</b>\n\n` +
      `💰 <b>+${WEEKLY_KARMA} ₸ Кармы</b> получили <b>${result.modifiedCount}</b> активных пользователей.\n` +
      `Продолжайте пользоваться Azadolg — и карма растёт! 🚀`
    );
  } catch (error) {
    console.error('[CronService] Ошибка распределения Кармы:', error);
  }
}

// ── Еженедельное списание (падение) Кармы ─────────────────────────────────────
async function deductWeeklyKarma() {
  try {
    console.log('[CronService] Запуск еженедельного списания Кармы...');
    const Transaction = require('../models/Transaction');
    const DECAY_KARMA = 50; // значение списания
    const ACTIVITY_DAYS = 30;
    const cutoff = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000);

    // Активные: зашли за последние 30 дней ИЛИ имеют активный долг
    const activeDebtorIds = await Transaction.distinct('debtor',   { status: 'active' });
    const activeCreditorIds = await Transaction.distinct('creditor', { status: 'active' });
    const activeDebtUsers = [...new Set([...activeDebtorIds.map(String), ...activeCreditorIds.map(String)])];

    // Находим неактивных пользователей (не заходили 30 дней и нет активных долгов)
    // Списываем у них карму (не уменьшая ниже 0)
    const result = await User.updateMany(
      {
        isBanned: { $ne: true },
        $or: [
          { lastLoginAt: { $lt: cutoff } },
          { lastLoginAt: null },
          { lastLoginAt: { $exists: false } }
        ],
        _id: { $not: { $in: activeDebtUsers } },
        karma: { $gt: 0 }
      },
      [
        {
          $set: {
            karma: {
              $max: [0, { $subtract: ["$karma", DECAY_KARMA] }]
            }
          }
        }
      ]
    );

    // Также списываем карму у пользователей с просроченными долгами (dueDate < now)
    const now = new Date();
    const overdueDebts = await Transaction.find({
      status: 'active',
      dueDate: { $lt: now }
    }).distinct('debtor');

    let overdueCount = 0;
    if (overdueDebts.length > 0) {
      const overdueResult = await User.updateMany(
        {
          _id: { $in: overdueDebts },
          karma: { $gt: 0 }
        },
        [
          {
            $set: {
              karma: {
                $max: [0, { $subtract: ["$karma", DECAY_KARMA] }]
              }
            }
          }
        ]
      );
      overdueCount = overdueResult.modifiedCount;
    }

    console.log(`[CronService] Еженедельное списание кармы: списано у ${result.modifiedCount} неактивных пользователей и ${overdueCount} должников с просрочкой.`);
  } catch (error) {
    console.error('[CronService] Ошибка еженедельного списания Кармы:', error);
  }
}

function startCronScheduler() {
  // Еженедельный базовый доход и падение Кармы: каждый понедельник в 09:00
  cron.schedule('0 9 * * 1', async () => {
    await distributeWeeklyKarma();
    await deductWeeklyKarma();
  });

  // Розыгрыш джекпота каждое воскресенье в 23:59
  cron.schedule('59 23 * * 0', () => {
    drawJackpot();
  });

  // Проверка смены сезонов 1-го числа каждого месяца в 00:00
  cron.schedule('0 0 1 * *', () => {
    checkSeasonReset();
  });

  // Проверка и очистка неактивных сборов краудфандинга каждые 6 часов
  cron.schedule('0 */6 * * *', () => {
    cleanExpiredCrowdfunds();
  });

  console.log('[CronService] Планировщик cron запущен (Карма: Пн 09:00 | Джекпот: Вс 23:59 | Сезон: 1-е число месяца | Сборы: каждые 6ч)');
}

async function cleanExpiredCrowdfunds() {
  try {
    const Fund = require('../models/Fund');
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 72);

    const result = await Fund.deleteMany({
      status: 'active',
      currentAmount: 0,
      createdAt: { $lt: cutoff }
    });

    if (result.deletedCount > 0) {
      console.log(`[CronService] Очищено ${result.deletedCount} сборов краудфандинга без взносов (старше 72 часов).`);
    }
  } catch (error) {
    console.error('[CronService] Ошибка очистки просроченных сборов:', error);
  }
}

module.exports = {
  drawJackpot,
  checkSeasonReset,
  distributeWeeklyKarma,
  deductWeeklyKarma,
  startCronScheduler,
  cleanExpiredCrowdfunds
};
