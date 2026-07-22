const tournamentService = require('../services/tournamentService');
const mongoose = require('mongoose');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

async function runTournamentTest() {
  console.log('🧪 Starting 6-Player Jackpot Tournament Simulation Test (Unit Mode)...');

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
  User.findById = (id) => Promise.resolve({ _id: id, name: `Player_${id.toString().slice(-4)}` });
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

  // 2. Play Group Stage matches
  console.log('2. Playing Group Stage matches (12 matches)...');
  const groupMatches = tournament.matches.filter(m => ['group_A', 'group_B'].includes(m.stage));

  for (let i = 0; i < groupMatches.length; i++) {
    const m = groupMatches[i];
    await tournamentService.reportMatchResult(tournament._id, m._id, m.player1, m.player1);
    await tournamentService.confirmMatchResult(tournament._id, m._id, m.player2);
  }

  const updatedTourney = await tournamentService.getActiveTournament();
  assert(updatedTourney.status === 'playoffs', 'Tournament should advance to playoffs stage');
  console.log('  ✅ Group stage completed & advanced to Playoffs!');

  // 3. Play Semi-Finals
  console.log('3. Playing Semi-Finals...');
  const sf1 = updatedTourney.matches.find(m => m.stage === 'semi_final_1');
  const sf2 = updatedTourney.matches.find(m => m.stage === 'semi_final_2');

  assert(sf1 && sf2, 'Semi-finals should exist');

  await tournamentService.reportMatchResult(updatedTourney._id, sf1._id, sf1.player1, sf1.player1);
  await tournamentService.confirmMatchResult(updatedTourney._id, sf1._id, sf1.player2);

  await tournamentService.reportMatchResult(updatedTourney._id, sf2._id, sf2.player1, sf2.player1);
  await tournamentService.confirmMatchResult(updatedTourney._id, sf2._id, sf2.player2);

  const playoffTourney = await tournamentService.getActiveTournament();
  const finalMatch = playoffTourney.matches.find(m => m.stage === 'final');
  const thirdMatch = playoffTourney.matches.find(m => m.stage === 'third_place');

  assert(finalMatch && thirdMatch, 'Final and 3rd place match should exist');
  console.log('  ✅ Semi-Finals completed & Finals generated!');

  // 4. Play Finals
  console.log('4. Playing Final and 3rd Place match...');
  await tournamentService.reportMatchResult(playoffTourney._id, thirdMatch._id, thirdMatch.player1, thirdMatch.player1);
  await tournamentService.confirmMatchResult(playoffTourney._id, thirdMatch._id, thirdMatch.player2);

  await tournamentService.reportMatchResult(playoffTourney._id, finalMatch._id, finalMatch.player1, finalMatch.player1);
  await tournamentService.confirmMatchResult(playoffTourney._id, finalMatch._id, finalMatch.player2);

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

  console.log('  ✅ Final placements and 100% prize pool distribution (40%, 25%, 10%, 10%, 7.5%, 7.5%) verified!');
  console.log('🎉 ALL TOURNAMENT LOGIC TESTS PASSED SUCCESSFULLY!');
}

runTournamentTest().catch(err => {
  console.error('❌ Tournament test error:', err);
  process.exit(1);
});
