const { calculateEloReward } = require('../utils/debtHelper');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

console.log('Testing calculateEloReward...');

// Test cases for calculateEloReward:
// 0 -> 0
// 1000 -> 25
// 5000 -> 100
// 10000 -> 150
// 20000 -> 200
// Above 20000: +10 Elo per 5000 KZT

assert(calculateEloReward(0) === 0, 'calculateEloReward(0) should be 0');
assert(calculateEloReward(500) === 13, 'calculateEloReward(500) should be 13');
assert(calculateEloReward(1000) === 25, 'calculateEloReward(1000) should be 25');
assert(calculateEloReward(3000) === 63, 'calculateEloReward(3000) should be 63 (25 + 2000/4000 * 75 = 62.5 -> 63)');
assert(calculateEloReward(5000) === 100, 'calculateEloReward(5000) should be 100');
assert(calculateEloReward(7500) === 125, 'calculateEloReward(7500) should be 125 (100 + 2500/5000 * 50 = 125)');
assert(calculateEloReward(10000) === 150, 'calculateEloReward(10000) should be 150');
assert(calculateEloReward(15000) === 175, 'calculateEloReward(15000) should be 175 (150 + 5000/10000 * 50 = 175)');
assert(calculateEloReward(20000) === 200, 'calculateEloReward(20000) should be 200');
assert(calculateEloReward(25000) === 210, 'calculateEloReward(25000) should be 210 (200 + 5000/5000 * 10 = 210)');
assert(calculateEloReward(30000) === 220, 'calculateEloReward(30000) should be 220');

console.log('✅ All calculateEloReward tests passed!');

console.log('Testing daily penalty formula calculation...');
// Formula: Penalty = (CurrentElo * 0.01) * (LoanAmount / 5000) * (1 + DaysOverdue * 0.05)
function calcPenalty(currentElo, loanAmount, daysOverdue) {
  const penaltyRaw = (currentElo * 0.01) * (loanAmount / 5000) * (1 + daysOverdue * 0.05);
  return Math.max(1, Math.round(penaltyRaw));
}

assert(calcPenalty(1000, 5000, 1) === 11, 'calcPenalty(1000, 5000, 1) should be 11 (10 * 1 * 1.05 = 10.5 -> 11)');
assert(calcPenalty(500, 10000, 10) === 15, 'calcPenalty(500, 10000, 10) should be 15 (5 * 2 * 1.5 = 15)');
assert(calcPenalty(100, 1000, 1) === 1, 'calcPenalty(100, 1000, 1) should be at least 1');

console.log('✅ All penalty formula tests passed!');
