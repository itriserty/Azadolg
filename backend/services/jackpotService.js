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
        const count = await User.countDocuments({ username: { $exists: true, $ne: null } }).session(session);
        if (count === 0) {
          console.log('[JackpotService] Нет пользователей для розыгрыша.');
          return { success: false, reason: 'no_users', jackpotAmount };
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
        winner._karmaReason = 'jackpot_win';
        await winner.save({ session });

        // Находим admin-пользователя для записи лога транзакции
        const admin = await User.findOne({ role: 'admin' }).session(session);
        const adminId = admin ? admin._id : winner._id;

        // Создаём запись в истории транзакций (Transaction)
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

        return { success: true, winner, jackpotAmount };
      });

      if (!result || !result.success) {
        return result || { success: false, reason: 'unknown' };
      }

      const { winner, jackpotAmount } = result;
      console.log(`[JackpotService] Победитель джекпота: ${winner.name} (@${winner.username}), выигрыш: ${jackpotAmount} ₸ Кармы.`);

      try {
        const achievementService = require('./AchievementService');
        await achievementService.trigger('jackpot_won', { winnerId: winner._id });
      } catch (err) {
        console.error('[JackpotService] Ошибка вызова AchievementService для джекпота:', err);
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

      return { success: true, winner, jackpotAmount };
    } catch (error) {
      console.error('[JackpotService] Ошибка розыгрыша джекпота:', error);
      throw error;
    }
  }
}

module.exports = new JackpotService();
