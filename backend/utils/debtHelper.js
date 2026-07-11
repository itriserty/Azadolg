/**
 * Рассчитывает актуальную сумму транзакции (долга) с учетом штрафа.
 * Если с момента создания транзакции (createdAt) прошло более 7 дней,
 * а долг не закрыт, сумма увеличивается на 5%.
 * 
 * @param {Object} transaction - Документ транзакции из БД
 * @param {Date} [now=new Date()] - Текущая дата
 * @returns {number} Актуальная сумма долга
 */
function getCalculatedAmount(transaction, now = new Date()) {
  if (transaction.status !== 'active' && transaction.status !== 'partially_paid') {
    return transaction.amount;
  }

  const createdAt = new Date(transaction.createdAt);
  const diffTime = now.getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const baseAmount = transaction.promisedReturnAmount || transaction.originalAmount;

  // Если прошло более 7 дней
  if (diffDays > 7) {
    const penalty = baseAmount * 0.05;
    return Number((baseAmount + penalty).toFixed(2));
  }

  return baseAmount;
}

function calculateEloReward(amount) {
  const amt = Math.max(0, Number(amount) || 0);
  let elo = 0;
  if (amt === 0) {
    elo = 0;
  } else if (amt <= 1000) {
    // 0 -> 0, 1000 -> 25
    elo = (amt / 1000) * 25;
  } else if (amt <= 5000) {
    // 1000 -> 25, 5000 -> 100
    elo = 25 + ((amt - 1000) / 4000) * 75;
  } else if (amt <= 10000) {
    // 5000 -> 100, 10000 -> 150
    elo = 100 + ((amt - 5000) / 5000) * 50;
  } else if (amt <= 20000) {
    // 10000 -> 150, 20000 -> 200
    elo = 150 + ((amt - 10000) / 10000) * 50;
  } else {
    // Свыше 20000: прибавлять по 10 Эло за каждые следующие 5000 KZT (linear)
    elo = 200 + ((amt - 20000) / 5000) * 10;
  }
  return Math.round(elo);
}

module.exports = {
  getCalculatedAmount,
  calculateEloReward
};
