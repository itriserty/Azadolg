const mongoose = require('mongoose');
const User = require('../models/User');
const SystemState = require('../models/SystemState');
const tg = require('./telegramService');
const Transaction = require('../models/Transaction');

// Helper for transaction execution with fallback
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

class JackpotService {
  async distributeJackpot() {
    try {
      console.log('[JackpotService] Запуск розыгрыша еженедельного Джекпота...');
      
      const result = await runInTransaction(async (session) => {
        let state = await SystemState.findOne().session(session);
        if (!state) {
          state = new SystemState();
          await state.save({ session });
        }

        const jackpotAmount = state.jackpotPool;
        if (jackpotAmount <= 0) {
          console.log('[JackpotService] Джекпот пуст. Розыгрыш отменен.');
          return { success: false, reason: 'jackpot_empty', jackpotAmount: 0 };
        }

        // Считаем количество подходящих пользователей
        const query = { username: { $exists: true, $ne: null }, isBanned: { $ne: true } };
        const count = await User.countDocuments(query).session(session);
        if (count === 0) {
          console.log('[JackpotService] Нет пользователей для розыгрыша.');
          return { success: false, reason: 'no_users', jackpotAmount };
        }

        // Выбираем случайного победителя с помощью skip()
        const randomIndex = Math.floor(Math.random() * count);
        const winner = await User.findOne(query)
          .skip(randomIndex)
          .session(session);

        if (!winner) throw new Error('Не удалось выбрать победителя джекпота');

        // Начисляем 50% джекпота победителю
        const winnerJackpotAmount = Math.floor(jackpotAmount * 0.5);
        winner.karma += winnerJackpotAmount;
        winner.stats.totalKarmaEarned += winnerJackpotAmount;
        winner._karmaReason = 'jackpot_win';
        await winner.save({ session });

        // Вычисляем долю для остальных активных пользователей
        const activeUsers = await User.find({
          _id: { $ne: winner._id },
          username: { $exists: true, $ne: null },
          isBanned: { $ne: true }
        }).select('_id karma stats').session(session);

        const N = activeUsers.length;
        let splitAmount = 0;
        if (N > 0) {
          splitAmount = Math.floor((jackpotAmount * 0.5) / N);
          if (splitAmount > 0) {
            // Массовое обновление (bulk update) остальных пользователей
            await User.updateMany(
              { _id: { $in: activeUsers.map(u => u._id) } },
              { 
                $inc: { 
                  karma: splitAmount, 
                  'stats.totalKarmaEarned': splitAmount 
                } 
              }
            ).session(session);

            // Создаем записи в истории баланса (BalanceLog) для остальных пользователей
            const BalanceLog = mongoose.model('BalanceLog');
            const logs = activeUsers.map(u => ({
              user_id: u._id,
              currency: 'karma',
              amount: splitAmount,
              reason: 'jackpot_split',
              related_entity_id: null
            }));
            await BalanceLog.insertMany(logs, { session });
          }
        }

        // Находим admin-пользователя для записи лога транзакции
        const admin = await User.findOne({ role: 'admin' }).session(session);
        const adminId = admin ? admin._id : winner._id;

        // Создаём запись в истории транзакций (Transaction) для победителя
        const tx = new Transaction({
          creditor: adminId,
          debtor: winner._id,
          amount: winnerJackpotAmount,
          originalAmount: winnerJackpotAmount,
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

        return { success: true, winner, jackpotAmount, winnerJackpotAmount, splitAmount, splitUsersCount: N };
      });

      if (!result || !result.success) {
        return result || { success: false, reason: 'unknown' };
      }

      const { winner, jackpotAmount, winnerJackpotAmount, splitAmount, splitUsersCount } = result;
      console.log(`[JackpotService] Победитель джекпота: ${winner.name} (@${winner.username}), выигрыш: ${winnerJackpotAmount} ₸ Кармы. Остальные ${splitUsersCount} пользователей получили по ${splitAmount} ₸ Кармы.`);

      try {
        const achievementService = require('./AchievementService');
        await achievementService.trigger('jackpot_won', { winnerId: winner._id });
      } catch (err) {
        console.error('[JackpotService] Ошибка вызова AchievementService для джекпота:', err);
      }

      // Уведомление в Телеграм
      const text = `🎉 <b>ЕЖЕНЕДЕЛЬНЫЙ ДЖЕКПОТ АZADOLG!</b> 🎉\n\n` +
        `👑 Счастливчик недели: <b>${winner.name}</b> (@${winner.username || 'нет'})\n` +
        `💰 Выигрыш: <b>${winnerJackpotAmount} ₸ Кармы</b> (50% от пула)\n` +
        `💸 Остальные 50% пула (${jackpotAmount - winnerJackpotAmount} ✧) разделены поровну между всеми активными игроками (по +${splitAmount} ✧)!\n\n` +
        `Копите карму, делайте ставки на долги, участвуйте в дуэлях Coinflip и выигрывайте джекпот каждую неделю! 🚀`;

      tg.sendMessage(text);
      if (winner.telegramId) {
        tg.sendMessage(`🎉 Поздравляем! Вы выиграли еженедельный джекпот в размере <b>${winnerJackpotAmount} ₸ Кармы</b>! 💰`, winner.telegramId);
      }

      if (splitAmount > 0) {
        const activeUsersWithTg = await User.find({
          _id: { $ne: winner._id },
          username: { $exists: true, $ne: null },
          isBanned: { $ne: true },
          telegramId: { $exists: true, $ne: null }
        }).select('telegramId');

        for (const u of activeUsersWithTg) {
          if (u.telegramId) {
            tg.sendMessage(`💸 Вам начислено <b>+${splitAmount} ✧ Кармы</b> за распределение еженедельного джекпота! 🎰`, u.telegramId);
          }
        }
      }

      return { success: true, winner, jackpotAmount };
    } catch (error) {
      console.error('[JackpotService] Ошибка розыгрыша джекпота:', error);
      throw error;
    }
  }
}

module.exports = new JackpotService();
