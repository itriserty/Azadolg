const Duel = require('../models/Duel');
const User = require('../models/User');

const mongoose = require('mongoose');

/**
 * Расчет H2H (Head-to-Head) личных встреч между двумя игроками.
 */
async function calculateH2H(userAId, userBId) {
  if (!userAId || !userBId) return null;
  if (mongoose.connection.readyState !== 1) return null;

  const idA = userAId.toString();
  const idB = userBId.toString();

  const getUser = async (id) => {
    const query = User.findById(id);
    if (query && typeof query.select === 'function') {
      return await query.select('name username avatar avatar_url eloRating');
    }
    return await query;
  };

  const [userA, userB] = await Promise.all([
    getUser(userAId),
    getUser(userBId)
  ]);

  if (!userA || !userB) return null;

  // Обычные дуэли из коллекции Duel
  const duels = await Duel.find({
    $or: [
      { challenger: userAId, opponent: userBId },
      { challenger: userBId, opponent: userAId }
    ],
    status: { $in: ['accepted', 'finished'] },
    winner: { $ne: null }
  });

  // Импортируем JackpotTournament динамически во избежание круговых зависимостей
  const JackpotTournament = require('../models/JackpotTournament');
  const tournaments = await JackpotTournament.find({
    participants: { $all: [userAId, userBId] }
  });

  let winsA = 0;
  let winsB = 0;
  let history = [];

  // Подсчёт дуэлей
  for (const d of duels) {
    if (!d.winner) continue;
    const wId = d.winner.toString();
    if (wId === idA) winsA++;
    else if (wId === idB) winsB++;

    history.push({
      id: d._id,
      type: 'duel',
      date: d.createdAt,
      winnerId: wId,
      winnerName: wId === idA ? userA.name : userB.name,
      wager: d.wager || 0
    });
  }

  // Подсчёт турнирных матчей
  for (const t of tournaments) {
    if (!t.matches) continue;
    for (const m of t.matches) {
      if (m.status !== 'confirmed' || !m.winner) continue;
      const p1 = m.player1.toString();
      const p2 = m.player2.toString();

      if ((p1 === idA && p2 === idB) || (p1 === idB && p2 === idA)) {
        const wId = m.winner.toString();
        if (wId === idA) winsA++;
        else if (wId === idB) winsB++;

        history.push({
          id: m._id,
          type: 'tournament',
          date: m.updatedAt || m.createdAt,
          winnerId: wId,
          winnerName: wId === idA ? userA.name : userB.name,
          score: `${m.winsP1} : ${m.winsP2}`,
          stage: m.stage
        });
      }
    }
  }

  const totalMatches = winsA + winsB;
  const winrateA = totalMatches > 0 ? Math.round((winsA / totalMatches) * 100) : 50;
  const winrateB = totalMatches > 0 ? Math.round((winsB / totalMatches) * 100) : 50;

  return {
    userA: { id: userA._id, name: userA.name, username: userA.username, wins: winsA, winrate: winrateA, elo: userA.eloRating },
    userB: { id: userB._id, name: userB.name, username: userB.username, wins: winsB, winrate: winrateB, elo: userB.eloRating },
    totalMatches,
    winsP1: winsA,
    winsP2: winsB,
    winrateP1: winrateA,
    winrateP2: winrateB,
    history: history.sort((a, b) => new Date(b.date) - new Date(a.date))
  };
}

module.exports = {
  calculateH2H
};
