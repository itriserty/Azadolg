/**
 * Рассчитывает актуальную сумму долга с учетом набежавших процентов (пени) за просрочку.
 * 
 * @param {Object} debt - Объект долга из БД Mongoose
 * @param {Date} [currentDate=new Date()] - Текущая дата (для тестов можно передавать кастомную)
 * @returns {number} Актуальная сумма долга
 */
function calculateCurrentDebt(debt, currentDate = new Date()) {
  if (!debt) return 0;
  
  const dueDate = new Date(debt.dueDate);
  
  // Если долг не подтвержден или уже оплачен, или срок еще не наступил
  if (debt.status !== 'active' || currentDate <= dueDate) {
    return debt.amount;
  }
  
  // Вычисляем разницу в днях
  const diffTime = currentDate.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return debt.amount;
  }
  
  // Простая процентная ставка за каждый день просрочки
  const penalty = debt.amount * (debt.penaltyRate || 0.01) * diffDays;
  
  return Number((debt.amount + penalty).toFixed(2));
}

module.exports = {
  calculateCurrentDebt
};
