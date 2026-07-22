/**
 * eloHelper.js
 * Вспомогательные функции математики ELO и расчета шансов на победу.
 */

/**
 * Расчет математической вероятности победы Игрока 1 против Игрока 2 на основе рейтинга ELO.
 * Формула: P_1 = 0.5 + (ELO_1 - ELO_2) / 4000
 * Диапазон: от 10% (0.10) до 90% (0.90).
 *
 * Примеры:
 * - 1000 vs 1000 => 50% / 50%
 * - 1500 vs 1000 => 62.5% / 37.5%
 * - 2000 vs 1000 => 75.0% / 25.0%
 */
function calculateEloWinProbability(elo1 = 1000, elo2 = 1000) {
  const e1 = Number(elo1) || 1000;
  const e2 = Number(elo2) || 1000;
  const diff = e1 - e2;
  const rawProb = 0.5 + (diff / 4000);
  // Ограничиваем от 10% до 90%
  return Math.max(0.10, Math.min(0.90, rawProb));
}

module.exports = {
  calculateEloWinProbability
};
