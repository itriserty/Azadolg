/**
 * eloHelper.js
 * Вспомогательные функции математики ELO и расчета шансов на победу.
 */

/**
 * Расчет математической вероятности победы Игрока 1 против Игрока 2 на основе рейтинга ELO.
 * Сигмоидальная логистическая формула ELO:
 * P(A) = 1 / (1 + 10^((ELO_B - ELO_A) / 2000))
 *
 * Точные примеры:
 * - 1000 vs 1000 => 50% / 50%
 * - 1500 vs 1000 => 64.0% (~62%) / 36.0%
 * - 2000 vs 1000 => 76.0% (~75%) / 24.0%
 */
function calculateEloWinProbability(elo1 = 1000, elo2 = 1000) {
  const e1 = Number(elo1) || 1000;
  const e2 = Number(elo2) || 1000;
  const exponent = (e2 - e1) / 2000;
  const prob = 1 / (1 + Math.pow(10, exponent));
  return Math.max(0.05, Math.min(0.95, prob));
}

module.exports = {
  calculateEloWinProbability
};
