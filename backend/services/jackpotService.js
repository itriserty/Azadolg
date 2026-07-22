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
      console.log('[JackpotService] Запуск 6-игрокового Турнирного Джекпота...');
      const tournamentService = require('./tournamentService');
      const tournament = await tournamentService.createTournament();
      return {
        success: true,
        message: 'Турнирный Джекпот успешно запущен!',
        jackpotAmount: tournament.jackpotPool,
        tournament
      };
    } catch (error) {
      console.error('[JackpotService] Ошибка запуска Турнирного джекпота:', error);
      throw error;
    }
  }
}

module.exports = new JackpotService();
