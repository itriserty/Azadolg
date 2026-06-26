const LotteryPool = require('../models/LotteryPool');
const User = require('../models/User');

/**
 * Получает строковое представление следующего месяца в формате "YYYY-MM"
 * @param {string} currentMonthStr - Текущий месяц в формате "YYYY-MM"
 * @returns {string}
 */
function getNextMonthString(currentMonthStr) {
  const [year, month] = currentMonthStr.split('-').map(Number);
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Проверяет состояние активного пула лотереи и проводит розыгрыш, если сумма достигла лимита.
 * Вызывается после каждой покупки на Маркете.
 */
async function checkLotteryAndProcess() {
  try {
    // Ищем активный пул лотереи
    let activePool = await LotteryPool.findOne({ isActive: true });
    
    // Если активного пула почему-то нет, создаем для текущего месяца
    if (!activePool) {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      activePool = new LotteryPool({
        poolAmount: 0,
        tickets: [],
        month: currentMonthStr,
        isActive: true
      });
      await activePool.save();
    }

    // Если пул накопил 10 000 или более
    if (activePool.poolAmount >= 10000) {
      console.log(`[LOTTERY] Pool amount reached ${activePool.poolAmount}. Starting lottery draw...`);
      
      let winnerId = null;
      let winnerName = 'Никто (билеты отсутствуют)';

      // Выбираем победителя только если есть билеты
      if (activePool.tickets && activePool.tickets.length > 0) {
        const randomIndex = Math.floor(Math.random() * activePool.tickets.length);
        winnerId = activePool.tickets[randomIndex];
        
        // Начисляем победителю карму, равную сумме пула
        const winner = await User.findByIdAndUpdate(
          winnerId, 
          { $inc: { karma: activePool.poolAmount } },
          { new: true }
        );
        if (winner) {
          winnerName = winner.name;
          console.log(`[LOTTERY] Winner selected: ${winnerName} (${winnerId}). Karma awarded: ${activePool.poolAmount}`);
        }
      } else {
        console.log('[LOTTERY] Draw completed without winner. No tickets were in the pool.');
      }

      // Закрываем текущий пул
      activePool.isActive = false;
      await activePool.save();

      // Создаем новый пул для следующего месяца
      const nextMonthStr = getNextMonthString(activePool.month);
      const nextPool = new LotteryPool({
        poolAmount: 0,
        tickets: [],
        month: nextMonthStr,
        isActive: true
      });
      await nextPool.save();
      
      console.log(`[LOTTERY] Created new active pool for month ${nextMonthStr}`);
      
      return {
        drawExecuted: true,
        winnerId,
        winnerName,
        reward: activePool.poolAmount,
        nextMonth: nextMonthStr
      };
    }

    return {
      drawExecuted: false,
      currentPoolAmount: activePool.poolAmount
    };
  } catch (error) {
    console.error('[LOTTERY ERROR] Error in checkLotteryAndProcess:', error);
    throw error;
  }
}

module.exports = {
  checkLotteryAndProcess
};
