const tournamentService = require('../services/tournamentService');
const mongoose = require('mongoose');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

async function runTournamentTest() {
  console.log('🧪 Starting 6-Player Jackpot Tournament Simulation Test (Unit Mode: Bo3 / Bo5)...');

  // Mock player IDs
  const mockPlayers = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId()
  ];

  // Disable telegram notifications
  const tg = require('../services/telegramService');
  tg.sendMessage = () => {};

  // Mock User
  const User = require('../models/User');
  User.find = () => {
    const list = mockPlayers.map((id, index) => ({ _id: id, name: `Player ${index + 1}` }));
    return {
      select: () => Promise.resolve(list),
      then: (resolve) => resolve(list)
    };
  };
  User.findById = (id) => Promise.resolve({ _id: id, name: `Player_${id.toString().slice(-4)}`, achievements: [], replenishBalance: () => {}, save: () => Promise.resolve() });
  User.findByIdAndUpdate = () => Promise.resolve();

  const SystemState = require('../models/SystemState');
  SystemState.findOne = () => Promise.resolve({ jackpotPool: 10000, save: () => Promise.resolve() });

  const BalanceLog = require('../models/BalanceLog');
  BalanceLog.create = () => Promise.resolve();

  const JackpotTournament = require('../models/JackpotTournament');
  let currentDoc = null;

  JackpotTournament.prototype.save = function() {
    currentDoc = this;
    return Promise.resolve(this);
  };

  const createPopulateChain = () => {
    const chain = {
      populate: () => chain,
      sort: () => chain,
      then: (resolve) => resolve(currentDoc),
      catch: () => {}
    };
    return chain;
  };

  JackpotTournament.findById = () => Promise.resolve(currentDoc);
  JackpotTournament.findOne = () => createPopulateChain();

  // Helper to play a series until match completes
  const playSeries = async (tourneyId, match) => {
    while (match.status !== 'confirmed') {
      await tournamentService.startMatchLeg(tourneyId, match._id, match.player1);
      await tournamentService.acceptMatchLeg(tourneyId, match._id, match.player2);
    }
  };

  // 1. Create Tournament
  console.log('1. Creating tournament...');
  const pool = 10000;
  const tournament = await tournamentService.createTournament(mockPlayers, pool);

  assert(tournament.participants.length === 6, 'Should have 6 participants');
  assert(tournament.groups.groupA.length === 3, 'Group A should have 3 players');
  assert(tournament.groups.groupB.length === 3, 'Group B should have 3 players');
  assert(tournament.matches.length === 12, 'Should have 12 group stage matches');
  assert(tournament.status === 'group_stage', 'Status should be group_stage');
  console.log('  ✅ Group stage setup verified!');

  // 2. Play Group Stage matches and any Tie-Breakers
  console.log('2. Playing Group Stage matches and Tie-Breakers...');
  let currentTourney = await tournamentService.getActiveTournament();

  while (currentTourney.status === 'group_stage') {
    const pendingGroupMatches = currentTourney.matches.filter(m => 
      ['group_A', 'group_B', 'group_A_tiebreak', 'group_B_tiebreak'].includes(m.stage) && m.status !== 'confirmed'
    );
    if (pendingGroupMatches.length === 0) break;
    for (const m of pendingGroupMatches) {
      await playSeries(currentTourney._id, m);
    }
    currentTourney = await tournamentService.getActiveTournament();
  }

  const updatedTourney = currentTourney;
  assert(updatedTourney.status === 'playoffs', 'Tournament should advance to playoffs stage');
  console.log('  ✅ Group stage & Tie-Breaker series completed & advanced to Playoffs!');

  // 3. Play Semi-Finals (Bo3: 2 wins each)
  console.log('3. Playing Semi-Finals (Bo3)...');
  const sf1 = updatedTourney.matches.find(m => m.stage === 'semi_final_1');
  const sf2 = updatedTourney.matches.find(m => m.stage === 'semi_final_2');

  assert(sf1 && sf2, 'Semi-finals should exist');
  assert(sf1.winsRequired === 2, 'Semi-finals should be Bo3 (winsRequired = 2)');

  await playSeries(updatedTourney._id, sf1);
  await playSeries(updatedTourney._id, sf2);

  const playoffTourney = await tournamentService.getActiveTournament();
  const finalMatch = playoffTourney.matches.find(m => m.stage === 'final');
  const thirdMatch = playoffTourney.matches.find(m => m.stage === 'third_place');

  assert(finalMatch && thirdMatch, 'Final and 3rd place match should exist');
  assert(finalMatch.winsRequired === 3, 'Final match MUST be Bo5 (winsRequired = 3)');
  assert(thirdMatch.winsRequired === 2, '3rd place match should be Bo3 (winsRequired = 2)');

  console.log('  ✅ Semi-Finals Bo3 completed & Final Bo5 generated!');

  // 4. Play Finals (Final is Bo5: 3 wins required)
  console.log('4. Playing 3rd Place match (Bo3) and Final (Bo5)...');
  await playSeries(playoffTourney._id, thirdMatch); // 2 wins
  await playSeries(playoffTourney._id, finalMatch); // 3 wins

  const completedTourney = await tournamentService.getActiveTournament();
  assert(completedTourney.status === 'completed', 'Status should be completed');
  assert(completedTourney.finalPlacements.length === 6, 'Should have 6 final placements');

  // Verify Prize Pool distribution
  const p = completedTourney.finalPlacements;
  assert(p[0].prize === 4000, `1st place prize should be 4000 (40%), got ${p[0].prize}`);
  assert(p[1].prize === 2500, `2nd place prize should be 2500 (25%), got ${p[1].prize}`);
  assert(p[2].prize === 1000, `3rd place prize should be 1000 (10%), got ${p[2].prize}`);
  assert(p[3].prize === 1000, `4th place prize should be 1000 (10%), got ${p[3].prize}`);
  assert(p[4].prize === 750,  `5th place prize should be 750 (7.5%), got ${p[4].prize}`);
  assert(p[5].prize === 750,  `6th place prize should be 750 (7.5%), got ${p[5].prize}`);

  const totalDistributed = p.reduce((sum, item) => sum + item.prize, 0);
  assert(totalDistributed === pool, `Total distributed (${totalDistributed}) should match pool (${pool})`);

  console.log('  ✅ Final placements, Bo3/Bo5 series win conditions, and 100% prize pool distribution verified!');
  console.log('🎉 ALL TOURNAMENT LOGIC TESTS PASSED SUCCESSFULLY!');
}

runTournamentTest().catch(err => {
  console.error('❌ Tournament test error:', err);
  process.exit(1);
});
