const mongoose = require('mongoose');
const JackpotTournament = require('../models/JackpotTournament');
const User = require('../models/User');
const SystemState = require('../models/SystemState');
const BalanceLog = require('../models/BalanceLog');
const tg = require('./telegramService');
const { calculateEloWinProbability } = require('../utils/eloHelper');
const { checkAndAward } = require('../utils/achievementHelper');

class TournamentService {
  /**
   * Запуск нового 6-игрокового Турнирного Джекпота
   */
  async createTournament(playerIds = null, customPool = null) {
    let participants = [];

    if (playerIds && Array.isArray(playerIds) && playerIds.length === 6) {
      participants = playerIds;
    } else {
      const allUsers = await User.find({
        username: { $exists: true, $ne: null },
        isBanned: { $ne: true }
      }).select('_id name username role');

      const regularUsers = allUsers.filter(u => 
        u.role !== 'admin' && 
        !u.username?.toLowerCase().includes('admin') &&
        !u.name?.toLowerCase().includes('admin')
      );

      if (regularUsers.length < 6) {
        throw new Error(`Для турнира требуется минимум 6 обычных игроков (без админов). Найдено в БД: ${regularUsers.length}`);
      }
      const shuffled = regularUsers.sort(() => 0.5 - Math.random());
      participants = shuffled.slice(0, 6).map(u => u._id);
    }

    const existingActive = await JackpotTournament.findOne({ status: { $ne: 'completed' } });
    if (existingActive) {
      throw new Error('Уже есть активный турнир! Сначала отмените текущий турнир.');
    }

    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
      await state.save();
    }

    let pool = Number(customPool);
    if (!isNaN(pool) && pool > 0) {
      pool = Math.min(pool, state.jackpotPool > 0 ? state.jackpotPool : pool);
      if (state.jackpotPool >= pool) {
        state.jackpotPool -= pool;
      } else {
        state.jackpotPool = 0;
      }
    } else {
      pool = state.jackpotPool || 1000;
      state.jackpotPool = 0;
    }
    await state.save();

    const shuffledPlayers = [...participants].sort(() => 0.5 - Math.random());
    const groupA = shuffledPlayers.slice(0, 3);
    const groupB = shuffledPlayers.slice(3, 6);

    const matches = [];

    const generateGroupMatches = (groupPlayers, stageName) => {
      const pairs = [
        [groupPlayers[0], groupPlayers[1]],
        [groupPlayers[0], groupPlayers[2]],
        [groupPlayers[1], groupPlayers[2]]
      ];
      // 1-й круг (Bo3: до 2-х побед)
      pairs.forEach(pair => {
        matches.push({
          stage: stageName,
          round: 1,
          player1: pair[0],
          player2: pair[1],
          winsP1: 0,
          winsP2: 0,
          winsRequired: 2,
          status: 'pending',
          currentLegStatus: 'pending'
        });
      });
      // 2-й круг (Bo3: до 2-х побед)
      pairs.forEach(pair => {
        matches.push({
          stage: stageName,
          round: 2,
          player1: pair[1],
          player2: pair[0],
          winsP1: 0,
          winsP2: 0,
          winsRequired: 2,
          status: 'pending',
          currentLegStatus: 'pending'
        });
      });
    };

    generateGroupMatches(groupA, 'group_A');
    generateGroupMatches(groupB, 'group_B');

    const standings = {
      groupA: groupA.map(p => ({ user: p, wins: 0, losses: 0, points: 0 })),
      groupB: groupB.map(p => ({ user: p, wins: 0, losses: 0, points: 0 }))
    };

    const tournament = new JackpotTournament({
      jackpotPool: pool,
      status: 'group_stage',
      participants,
      groups: { groupA, groupB },
      standings,
      matches
    });

    await tournament.save();

    const loadedUsers = await User.find({ _id: { $in: participants } }).select('name username');
    const userMap = {};
    loadedUsers.forEach(u => { userMap[u._id.toString()] = u.name; });

    const groupANames = groupA.map(id => userMap[id.toString()] || 'Игрок').join(', ');
    const groupBNames = groupB.map(id => userMap[id.toString()] || 'Игрок').join(', ');

    const tgText = `🏆 <b>СТАРТОВАЛ ТУРНИРНЫЙ ДЖЕКПОТ!</b> 🏆\n\n` +
      `💰 Выделенный призовой фонд: <b>${pool} ✧ Кармы</b>\n\n` +
      `🅰️ <b>Группа A:</b> ${groupANames}\n` +
      `🅱️ <b>Группа B:</b> ${groupBNames}\n\n` +
      `Формат матчей: <b>до 2-х побед (Bo3)</b>. В Финале — <b>до 3-х побед (Bo5)</b>! 🚀`;

    tg.sendMessage(tgText);

    return tournament;
  }

  async cancelActiveTournament() {
    const tournament = await JackpotTournament.findOne({ status: { $ne: 'completed' } });
    if (!tournament) {
      throw new Error('Нет активного турнира для отмены');
    }

    const pool = tournament.jackpotPool || 0;

    if (pool > 0) {
      let state = await SystemState.findOne();
      if (!state) {
        state = new SystemState();
      }
      state.jackpotPool = (state.jackpotPool || 0) + pool;
      await state.save();
    }

    tournament.status = 'completed';
    await tournament.save();

    const cancelMsg = `⚠️ <b>АКТИВНЫЙ ТУРНИР ОТМЕНЁН АДМИНИСТРАТОРОМ!</b> ⚠️\n\n` +
      `Призовой фонд <b>${pool} ✧ Кармы</b> возвращён в накопительный джекпот-пул.`;

    tg.sendMessage(cancelMsg);

    return { tournament, restoredPool: pool };
  }

  async getActiveTournament() {
    let tournament = await JackpotTournament.findOne({ status: { $ne: 'completed' } })
      .populate('participants', 'name username avatar avatar_url eloRating karma role')
      .populate('groups.groupA', 'name username avatar avatar_url eloRating karma role')
      .populate('groups.groupB', 'name username avatar avatar_url eloRating karma role')
      .populate('matches.player1', 'name username avatar avatar_url eloRating')
      .populate('matches.player2', 'name username avatar avatar_url eloRating')
      .populate('matches.winner', 'name username')
      .populate('matches.requestedBy', 'name username')
      .populate('matches.reportedWinner', 'name username')
      .populate('standings.groupA.user', 'name username avatar avatar_url eloRating')
      .populate('standings.groupB.user', 'name username avatar avatar_url eloRating')
      .populate('finalPlacements.user', 'name username avatar avatar_url eloRating');

    if (!tournament) {
      tournament = await JackpotTournament.findOne().sort({ createdAt: -1 })
        .populate('participants', 'name username avatar avatar_url eloRating karma role')
        .populate('groups.groupA', 'name username avatar avatar_url eloRating karma role')
        .populate('groups.groupB', 'name username avatar avatar_url eloRating karma role')
        .populate('matches.player1', 'name username avatar avatar_url eloRating')
        .populate('matches.player2', 'name username avatar avatar_url eloRating')
        .populate('matches.winner', 'name username')
        .populate('matches.requestedBy', 'name username')
        .populate('matches.reportedWinner', 'name username')
        .populate('standings.groupA.user', 'name username avatar avatar_url eloRating')
        .populate('standings.groupB.user', 'name username avatar avatar_url eloRating')
        .populate('finalPlacements.user', 'name username avatar avatar_url eloRating');
    }

    return tournament;
  }

  /**
   * Игрок предлагает начать партию матча
   */
  async startMatchLeg(tournamentId, matchId, requestingUserId) {
    const tournament = await JackpotTournament.findById(tournamentId);
    if (!tournament) throw new Error('Турнир не найден');
    if (tournament.status === 'completed') throw new Error('Турнир уже завершён');

    const match = tournament.matches.id(matchId);
    if (!match) throw new Error('Матч не найден');
    if (match.status === 'confirmed') throw new Error('Матч серии уже полностью завершён');

    const p1 = match.player1.toString();
    const p2 = match.player2.toString();
    const requester = requestingUserId.toString();

    if (requester !== p1 && requester !== p2) {
      throw new Error('Вы не являетесь участником этого матча');
    }

    match.currentLegStatus = 'requested';
    match.status = 'requested';
    match.requestedBy = requestingUserId;

    await tournament.save();

    const opponentId = requester === p1 ? p2 : p1;
    const [reqUser, oppUser, user1, user2] = await Promise.all([
      User.findById(requestingUserId),
      User.findById(opponentId),
      User.findById(match.player1),
      User.findById(match.player2)
    ]);

    const probP1 = calculateEloWinProbability(user1.eloRating, user2.eloRating);
    const pctP1 = Math.round(probP1 * 100);
    const pctP2 = 100 - pctP1;

    const msg = `🎲 <b>Запрос на проведение партии!</b>\n\n` +
      `Игрок <b>${reqUser.name}</b> вызывают на партию <b>${oppUser.name}</b>.\n` +
      `Математический шанс (по ELO): <b>${user1.name} (${pctP1}%) vs ${user2.name} (${pctP2}%)</b>.\n` +
      `⚠️ <b>${oppUser.name}</b>, подтвердите проведение дуэли в приложении!`;

    tg.sendMessage(msg);

    return tournament;
  }

  /**
   * Второй игрок подтверждает дуэль -> Автоматический математический ролл победителя по ELO
   */
  async acceptMatchLeg(tournamentId, matchId, acceptingUserId) {
    const tournament = await JackpotTournament.findById(tournamentId);
    if (!tournament) throw new Error('Турнир не найден');
    if (tournament.status === 'completed') throw new Error('Турнир уже завершён');

    const match = tournament.matches.id(matchId);
    if (!match) throw new Error('Матч не найден');

    const p1 = match.player1.toString();
    const p2 = match.player2.toString();
    const accepter = acceptingUserId.toString();

    if (accepter !== p1 && accepter !== p2) {
      throw new Error('Вы не являетесь участником этого матча');
    }

    // Если партию запрашивал тот же самый пользователь
    if (match.requestedBy && match.requestedBy.toString() === accepter) {
      throw new Error('Вы уже отправили вызов. Ожидается подтверждение соперника.');
    }

    const [u1, u2] = await Promise.all([
      User.findById(match.player1),
      User.findById(match.player2)
    ]);

    // Рассчитываем ELO вероятность для Player 1
    const probP1 = calculateEloWinProbability(u1.eloRating, u2.eloRating);
    const roll = Math.random();

    let legWinnerId = null;
    let legWinnerUser = null;
    let legLoserUser = null;

    if (roll < probP1) {
      legWinnerId = p1;
      legWinnerUser = u1;
      legLoserUser = u2;
      match.winsP1 += 1;
    } else {
      legWinnerId = p2;
      legWinnerUser = u2;
      legLoserUser = u1;
      match.winsP2 += 1;
    }

    // Обновляем серии побед и поражений в турнире
    legWinnerUser.tourneyWinStreak = (legWinnerUser.tourneyWinStreak || 0) + 1;
    legWinnerUser.tourneyLossStreak = 0;

    legLoserUser.tourneyLossStreak = (legLoserUser.tourneyLossStreak || 0) + 1;
    legLoserUser.tourneyWinStreak = 0;

    if (typeof legWinnerUser.save === 'function') {
      await Promise.all([
        legWinnerUser.save(),
        legLoserUser.save()
      ]);
    }

    // Проверяем выдачу достижений за серии
    await checkAndAward(legWinnerUser._id, 'tournament_win_streak', legWinnerUser.tourneyWinStreak);
    await checkAndAward(legLoserUser._id, 'tournament_loss_streak', legLoserUser.tourneyLossStreak);

    const targetWins = match.winsRequired || 2;
    const isSeriesFinished = match.winsP1 >= targetWins || match.winsP2 >= targetWins;

    let finishMsg = '';

    if (isSeriesFinished) {
      match.status = 'confirmed';
      match.currentLegStatus = 'pending';
      match.requestedBy = null;
      match.winner = match.winsP1 >= targetWins ? match.player1 : match.player2;

      const loserId = match.winner.toString() === p1 ? p2 : p1;

      if (['group_A', 'group_B'].includes(match.stage)) {
        const groupKey = match.stage === 'group_A' ? 'groupA' : 'groupB';
        const standingsList = tournament.standings[groupKey];

        const winnerItem = standingsList.find(s => s.user.toString() === match.winner.toString());
        const loserItem = standingsList.find(s => s.user.toString() === loserId);

        if (winnerItem) { winnerItem.wins += 1; winnerItem.points += 3; }
        if (loserItem)  { loserItem.losses += 1; }
      }

      finishMsg = `🏆 <b>СЕРИЯ ЗАВЕРШЕНА!</b>\n\n` +
        `🎲 Автоматический жребий выявил победителя партии: <b>${legWinnerUser.name}</b>!\n` +
        `⚔️ <b>${legWinnerUser.name}</b> выиграл всю серию у <b>${legLoserUser.name}</b> со счётом <b>${match.winsP1} : ${match.winsP2}</b>!\n` +
        `Этап: <i>${match.stage.replace('_', ' ').toUpperCase()}</i>`;
    } else {
      match.status = 'pending';
      match.currentLegStatus = 'pending';
      match.requestedBy = null;

      finishMsg = `✅ <b>ПАРТИЯ СЫГРАНА!</b>\n\n` +
        `🎲 Математический жребий присудил победу в партии: <b>${legWinnerUser.name}</b>!\n` +
        `Текущий счёт в серии между <b>${u1.name}</b> и <b>${u2.name}</b>: <b>${match.winsP1} : ${match.winsP2}</b> (серия до ${targetWins} побед).`;
    }

    await tournament.save();
    tg.sendMessage(finishMsg);

    if (tournament.status === 'group_stage') {
      const groupMatches = tournament.matches.filter(m => ['group_A', 'group_B'].includes(m.stage));
      const allGroupDone = groupMatches.every(m => m.status === 'confirmed');
      if (allGroupDone) {
        await this.advanceToPlayoffs(tournament);
      }
    } else if (tournament.status === 'playoffs') {
      const sfMatches = tournament.matches.filter(m => ['semi_final_1', 'semi_final_2'].includes(m.stage));
      const allSfDone = sfMatches.every(m => m.status === 'confirmed');

      const playoffFinalsExist = tournament.matches.some(m => ['final', 'third_place'].includes(m.stage));

      if (allSfDone && !playoffFinalsExist) {
        await this.generatePlayoffFinals(tournament);
      } else if (playoffFinalsExist) {
        const finalMatches = tournament.matches.filter(m => ['final', 'third_place'].includes(m.stage));
        const allFinalsDone = finalMatches.every(m => m.status === 'confirmed');
        if (allFinalsDone) {
          await this.finalizeTournament(tournament);
        }
      }
    }

    return tournament;
  }

  async advanceToPlayoffs(tournament) {
    const sortStandings = (list) => {
      return [...list].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
      });
    };

    const groupAStandings = sortStandings(tournament.standings.groupA);
    const groupBStandings = sortStandings(tournament.standings.groupB);

    const a1 = groupAStandings[0].user;
    const a2 = groupAStandings[1].user;
    const b1 = groupBStandings[0].user;
    const b2 = groupBStandings[1].user;

    tournament.matches.push({
      stage: 'semi_final_1',
      round: 3,
      player1: a1,
      player2: b2,
      winsP1: 0,
      winsP2: 0,
      winsRequired: 2,
      status: 'pending',
      currentLegStatus: 'pending'
    });

    tournament.matches.push({
      stage: 'semi_final_2',
      round: 3,
      player1: b1,
      player2: a2,
      winsP1: 0,
      winsP2: 0,
      winsRequired: 2,
      status: 'pending',
      currentLegStatus: 'pending'
    });

    tournament.status = 'playoffs';
    await tournament.save();

    const [uA1, uA2, uB1, uB2] = await Promise.all([
      User.findById(a1), User.findById(a2),
      User.findById(b1), User.findById(b2)
    ]);

    const playoffMsg = `🔥 <b>ГРУППОВОЙ ЭТАП ЗАВЕРШЁН! СТАРТ ПЛЕЙ-ОФФ (Bo3)!</b> 🔥\n\n` +
      `⚔️ <b>Полуфинал 1:</b> ${uA1.name} (1A) vs ${uB2.name} (2B)\n` +
      `⚔️ <b>Полуфинал 2:</b> ${uB1.name} (1B) vs ${uA2.name} (2A)\n\n` +
      `Матчи проходят до 2-х побед! 🚀`;

    tg.sendMessage(playoffMsg);
  }

  async generatePlayoffFinals(tournament) {
    const sf1 = tournament.matches.find(m => m.stage === 'semi_final_1');
    const sf2 = tournament.matches.find(m => m.stage === 'semi_final_2');

    const sf1Winner = sf1.winner;
    const sf1Loser  = sf1.winner.toString() === sf1.player1.toString() ? sf1.player2 : sf1.player1;

    const sf2Winner = sf2.winner;
    const sf2Loser  = sf2.winner.toString() === sf2.player1.toString() ? sf2.player2 : sf2.player1;

    tournament.matches.push({
      stage: 'third_place',
      round: 4,
      player1: sf1Loser,
      player2: sf2Loser,
      winsP1: 0,
      winsP2: 0,
      winsRequired: 2,
      status: 'pending',
      currentLegStatus: 'pending'
    });

    tournament.matches.push({
      stage: 'final',
      round: 4,
      player1: sf1Winner,
      player2: sf2Winner,
      winsP1: 0,
      winsP2: 0,
      winsRequired: 3,
      status: 'pending',
      currentLegStatus: 'pending'
    });

    await tournament.save();

    const [w1, w2, l1, l2] = await Promise.all([
      User.findById(sf1Winner), User.findById(sf2Winner),
      User.findById(sf1Loser),  User.findById(sf2Loser)
    ]);

    const finalsMsg = `👑 <b>ПОЛУФИНАЛЫ СЫГРАНЫ! ФИНАЛ И МАТЧ ЗА 3-Е МЕСТО!</b> 👑\n\n` +
      `🥇 <b>ФИНАЛ (до 3-х побед, Bo5):</b> ${w1.name} vs ${w2.name}\n` +
      `🥉 <b>Матч за 3-е место (до 2-х побед, Bo3):</b> ${l1.name} vs ${l2.name}\n\n` +
      `Удачи финалистам! 🔥`;

    tg.sendMessage(finalsMsg);
  }

  async finalizeTournament(tournament) {
    const finalMatch = tournament.matches.find(m => m.stage === 'final');
    const thirdMatch = tournament.matches.find(m => m.stage === 'third_place');

    const p1st = finalMatch.winner;
    const p2nd = finalMatch.winner.toString() === finalMatch.player1.toString() ? finalMatch.player2 : finalMatch.player1;

    const p3rd = thirdMatch.winner;
    const p4th = thirdMatch.winner.toString() === thirdMatch.player1.toString() ? thirdMatch.player2 : thirdMatch.player1;

    const sortStandings = (list) => [...list].sort((a, b) => b.points - a.points || b.wins - a.wins);
    const gA = sortStandings(tournament.standings.groupA);
    const gB = sortStandings(tournament.standings.groupB);

    const p5th = gA[2].user;
    const p6th = gB[2].user;

    const pool = tournament.jackpotPool;

    const prizes = [
      { rank: 1, user: p1st, prize: Math.round(pool * 0.40) },
      { rank: 2, user: p2nd, prize: Math.round(pool * 0.25) },
      { rank: 3, user: p3rd, prize: Math.round(pool * 0.10) },
      { rank: 4, user: p4th, prize: Math.round(pool * 0.10) },
      { rank: 5, user: p5th, prize: Math.round(pool * 0.075) },
      { rank: 6, user: p6th, prize: Math.round(pool * 0.075) }
    ];

    tournament.finalPlacements = prizes;
    tournament.status = 'completed';
    await tournament.save();

    for (const item of prizes) {
      if (item.prize > 0) {
        await User.findByIdAndUpdate(item.user, {
          $inc: { karma: item.prize, 'stats.totalKarmaEarned': item.prize }
        });
        await BalanceLog.create({
          user_id: item.user,
          currency: 'karma',
          amount: item.prize,
          reason: 'jackpot_tournament_prize',
          related_entity_id: tournament._id
        });
      }
    }

    const users = await User.find({ _id: { $in: prizes.map(p => p.user) } }).select('name username telegramId');
    const uMap = {};
    users.forEach(u => { uMap[u._id.toString()] = u; });

    const announceText = `🎉 <b>ИТОГИ ЕЖЕНЕДЕЛЬНОГО ТУРНИРА ДЖЕКПОТ!</b> 🎉\n\n` +
      `🥇 1 место (40%): <b>${uMap[p1st.toString()]?.name}</b> — +${prizes[0].prize} ✧\n` +
      `🥈 2 место (25%): <b>${uMap[p2nd.toString()]?.name}</b> — +${prizes[1].prize} ✧\n` +
      `🥉 3 место (10%): <b>${uMap[p3rd.toString()]?.name}</b> — +${prizes[2].prize} ✧\n` +
      `🏅 4 место (10%): <b>${uMap[p4th.toString()]?.name}</b> — +${prizes[3].prize} ✧\n` +
      `🎗 5 место (7.5%): <b>${uMap[p5th.toString()]?.name}</b> — +${prizes[4].prize} ✧\n` +
      `🎗 6 место (7.5%): <b>${uMap[p6th.toString()]?.name}</b> — +${prizes[5].prize} ✧\n\n` +
      `Поздравляем участников! Призы зачислены на балансы Кармы! 🚀`;

    tg.sendMessage(announceText);

    for (const item of prizes) {
      const u = uMap[item.user.toString()];
      if (u && u.telegramId && item.prize > 0) {
        tg.sendMessage(`🏆 Поздравляем! Вы заняли ${item.rank}-е место в Турнирном Джекпоте и получили <b>+${item.prize} ✧ Кармы</b>!`, u.telegramId);
      }
    }

    return tournament;
  }
}

module.exports = new TournamentService();
