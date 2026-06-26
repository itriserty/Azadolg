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
  if (transaction.status !== 'active') {
    return transaction.amount;
  }

  const createdAt = new Date(transaction.createdAt);
  const diffTime = now.getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Если прошло более 7 дней
  if (diffDays > 7) {
    const penalty = transaction.originalAmount * 0.05;
    return Number((transaction.originalAmount + penalty).toFixed(2));
  }

  return transaction.originalAmount;
}

module.exports = {
  getCalculatedAmount
};
