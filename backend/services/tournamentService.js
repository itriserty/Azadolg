const mongoose = require('mongoose');
const JackpotTournament = require('../models/JackpotTournament');
const User = require('../models/User');
const SystemState = require('../models/SystemState');
const BalanceLog = require('../models/BalanceLog');
const tg = require('./telegramService');

class TournamentService {
  /**
   * Запуск нового 6-игрокового Турнирного Джекпота
   */
  async createTournament(playerIds = null, customPool = null) {
    let participants = [];

    if (playerIds && Array.isArray(playerIds) && playerIds.length === 6) {
      participants = playerIds;
    } else {
      // Автоматический выбор 6 случайных активных незаблокированных пользователей
      const query = { username: { $exists: true, $ne: null }, isBanned: { $ne: true } };
      const users = await User.find(query).select('_id');
      if (users.length < 6) {
        throw new Error(`Для турнира требуется минимум 6 игроков. Найдено в БД: ${users.length}`);
      }
      // Случайное перемешивание
      const shuffled = users.sort(() => 0.5 - Math.random());
      participants = shuffled.slice(0, 6).map(u => u._id);
    }

    // Определяем пул джекпота
    let pool = Number(customPool);
    if (isNaN(pool) || pool <= 0) {
      let state = await SystemState.findOne();
      if (!state) {
        state = new SystemState();
        await state.save();
      }
      pool = state.jackpotPool || 1000;
    }

    // Случайное перемешивание 6 игроков и деление на 2 группы по 3 человека
    const shuffledPlayers = [...participants].sort(() => 0.5 - Math.random());
    const groupA = shuffledPlayers.slice(0, 3);
    const groupB = shuffledPlayers.slice(3, 6);

    // Генерируем 12 групповых дуэлей (6 матчей на группу в 2 круга)
    const matches = [];

    const generateGroupMatches = (groupPlayers, stageName) => {
      const pairs = [
        [groupPlayers[0], groupPlayers[1]],
        [groupPlayers[0], groupPlayers[2]],
        [groupPlayers[1], groupPlayers[2]]
      ];
      // 1-й круг
      pairs.forEach(pair => {
        matches.push({
          stage: stageName,
          round: 1,
          player1: pair[0],
          player2: pair[1],
          status: 'pending'
        });
      });
      // 2-й круг (меняем очередность хозяина/гостя)
      pairs.forEach(pair => {
        matches.push({
          stage: stageName,
          round: 2,
          player1: pair[1],
          player2: pair[0],
          status: 'pending'
        });
      });
    };

    generateGroupMatches(groupA, 'group_A');
    generateGroupMatches(groupB, 'group_B');

    // Инициализация таблицы очков
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

    // Загружаем данные игроков для уведомления
    const loadedUsers = await User.find({ _id: { $in: participants } }).select('name username');
    const userMap = {};
    loadedUsers.forEach(u => { userMap[u._id.toString()] = u.name; });

    const groupANames = groupA.map(id => userMap[id.toString()] || 'Игрок').join(', ');
    const groupBNames = groupB.map(id => userMap[id.toString()] || 'Игрок').join(', ');

    const tgText = `🏆 <b>СТАРТОВАЛ ЕЖЕНЕДЕЛЬНЫЙ ТУРНИР ДЖЕКПОТ!</b> 🏆\n\n` +
      `💰 Призовой фонд: <b>${pool} ✧ Кармы</b>\n\n` +
      `🅰️ <b>Группа A:</b> ${groupANames}\n` +
      `🅱️ <b>Группа B:</b> ${groupBNames}\n\n` +
      `Формат: 2 круга дуэлей в группах. Первые 2 места выходят в Плей-офф! Подтверждайте матчи в приложении! 🚀`;

    tg.sendMessage(tgText);

    return tournament;
  }

  /**
   * Получить активный или последний турнир
   */
  async getActiveTournament() {
    let tournament = await JackpotTournament.findOne({ status: { $ne: 'completed' } })
      .populate('participants', 'name username avatar avatar_url eloRating karma')
      .populate('groups.groupA', 'name username avatar avatar_url eloRating karma')
      .populate('groups.groupB', 'name username avatar avatar_url eloRating karma')
      .populate('matches.player1', 'name username avatar avatar_url')
      .populate('matches.player2', 'name username avatar avatar_url')
      .populate('matches.winner', 'name username')
      .populate('matches.reportedWinner', 'name username')
      .populate('standings.groupA.user', 'name username avatar avatar_url')
      .populate('standings.groupB.user', 'name username avatar avatar_url')
      .populate('finalPlacements.user', 'name username avatar avatar_url');

    if (!tournament) {
      tournament = await JackpotTournament.findOne().sort({ createdAt: -1 })
        .populate('participants', 'name username avatar avatar_url eloRating karma')
        .populate('groups.groupA', 'name username avatar avatar_url eloRating karma')
        .populate('groups.groupB', 'name username avatar avatar_url eloRating karma')
        .populate('matches.player1', 'name username avatar avatar_url')
        .populate('matches.player2', 'name username avatar avatar_url')
        .populate('matches.winner', 'name username')
        .populate('matches.reportedWinner', 'name username')
        .populate('standings.groupA.user', 'name username avatar avatar_url')
        .populate('standings.groupB.user', 'name username avatar avatar_url')
        .populate('finalPlacements.user', 'name username avatar avatar_url');
    }

    return tournament;
  }

  /**
   * Подать результат матча игроком
   */
  async reportMatchResult(tournamentId, matchId, reportingUserId, winnerId) {
    const tournament = await JackpotTournament.findById(tournamentId);
    if (!tournament) throw new Error('Турнир не найден');
    if (tournament.status === 'completed') throw new Error('Турнир уже завершён');

    const match = tournament.matches.id(matchId);
    if (!match) throw new Error('Матч не найден');
    if (match.status === 'confirmed') throw new Error('Результат матча уже подтверждён');

    const p1 = match.player1.toString();
    const p2 = match.player2.toString();
    const reporter = reportingUserId.toString();
    const winner = winnerId.toString();

    if (reporter !== p1 && reporter !== p2) {
      throw new Error('Вы не являетесь участником этого матча');
    }
    if (winner !== p1 && winner !== p2) {
      throw new Error('Указанный победитель не участвует в этом матче');
    }

    match.reportedWinner = winnerId;
    match.confirmedBy = [reportingUserId];
    match.status = 'reported';

    await tournament.save();

    const opponentId = reporter === p1 ? p2 : p1;
    const [reporterUser, opponentUser, winnerUser] = await Promise.all([
      User.findById(reportingUserId),
      User.findById(opponentId),
      User.findById(winnerId)
    ]);

    const msg = `⚔️ <b>Результат дуэли заявлен!</b>\n\n` +
      `Игрок <b>${reporterUser.name}</b> указал победителя: <b>${winnerUser.name}</b>.\n` +
      `⚠️ <b>${opponentUser.name}</b>, подтвердите результат матча в приложении!`;

    tg.sendMessage(msg);
    if (opponentUser.telegramId) {
      tg.sendMessage(`⚠️ Пожалуйста, подтвердите результат вашей дуэли против ${reporterUser.name} в Azadolg!`, opponentUser.telegramId);
    }

    return tournament;
  }

  /**
   * Подтвердить результат матча соперником
   */
  async confirmMatchResult(tournamentId, matchId, confirmingUserId) {
    const tournament = await JackpotTournament.findById(tournamentId);
    if (!tournament) throw new Error('Турнир не найден');
    if (tournament.status === 'completed') throw new Error('Турнир уже завершён');

    const match = tournament.matches.id(matchId);
    if (!match) throw new Error('Матч не найден');
    if (match.status !== 'reported') throw new Error('Матч не ожидает подтверждения');

    const p1 = match.player1.toString();
    const p2 = match.player2.toString();
    const confirmer = confirmingUserId.toString();

    if (confirmer !== p1 && confirmer !== p2) {
      throw new Error('Вы не являетесь участником этого матча');
    }
    if (match.confirmedBy.map(c => c.toString()).includes(confirmer)) {
      throw new Error('Вы уже подтвердили этот результат');
    }

    match.confirmedBy.push(confirmingUserId);
    match.status = 'confirmed';
    match.winner = match.reportedWinner;

    const loserId = match.winner.toString() === p1 ? p2 : p1;

    // Обновляем очки в группе если это групповой этап
    if (['group_A', 'group_B'].includes(match.stage)) {
      const groupKey = match.stage === 'group_A' ? 'groupA' : 'groupB';
      const standingsList = tournament.standings[groupKey];

      const winnerItem = standingsList.find(s => s.user.toString() === match.winner.toString());
      const loserItem = standingsList.find(s => s.user.toString() === loserId);

      if (winnerItem) { winnerItem.wins += 1; winnerItem.points += 3; }
      if (loserItem)  { loserItem.losses += 1; }
    }

    await tournament.save();

    const [winnerUser, loserUser] = await Promise.all([
      User.findById(match.winner),
      User.findById(loserId)
    ]);

    const finishMsg = `✅ <b>МАТЧ ПОДТВЕРЖДЁН!</b>\n\n` +
      `⚔️ <b>${winnerUser.name}</b> одержал победу над <b>${loserUser.name}</b>!\n` +
      `Этап: <i>${match.stage.replace('_', ' ').toUpperCase()}</i>`;

    tg.sendMessage(finishMsg);

    // Проверяем прогресс этапов
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

  /**
   * Переход из группового этапа в Полуфиналы (Плей-офф)
   */
  async advanceToPlayoffs(tournament) {
    // Сортируем участников группы A и B по очкам/победам
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
    const a3 = groupAStandings[2].user; // 5-е / 6-е место

    const b1 = groupBStandings[0].user;
    const b2 = groupBStandings[1].user;
    const b3 = groupBStandings[2].user; // 5-е / 6-е место

    // Полуфинал 1: 1A vs 2B
    tournament.matches.push({
      stage: 'semi_final_1',
      round: 3,
      player1: a1,
      player2: b2,
      status: 'pending'
    });

    // Полуфинал 2: 1B vs 2A
    tournament.matches.push({
      stage: 'semi_final_2',
      round: 3,
      player1: b1,
      player2: a2,
      status: 'pending'
    });

    tournament.status = 'playoffs';
    await tournament.save();

    const [uA1, uA2, uB1, uB2] = await Promise.all([
      User.findById(a1), User.findById(a2),
      User.findById(b1), User.findById(b2)
    ]);

    const playoffMsg = `🔥 <b>ГРУППОВОЙ ЭТАП ЗАВЕРШЁН! СТАРТ ПЛЕЙ-ОФФ!</b> 🔥\n\n` +
      `⚔️ <b>Полуфинал 1:</b> ${uA1.name} (1A) vs ${uB2.name} (2B)\n` +
      `⚔️ <b>Полуфинал 2:</b> ${uB1.name} (1B) vs ${uA2.name} (2A)\n\n` +
      `Матчи созданы в приложении. Победители выходят в ФИНАЛ! 🏆`;

    tg.sendMessage(playoffMsg);
  }

  /**
   * Генерация финала и матча за 3-е место
   */
  async generatePlayoffFinals(tournament) {
    const sf1 = tournament.matches.find(m => m.stage === 'semi_final_1');
    const sf2 = tournament.matches.find(m => m.stage === 'semi_final_2');

    const sf1Winner = sf1.winner;
    const sf1Loser  = sf1.winner.toString() === sf1.player1.toString() ? sf1.player2 : sf1.player1;

    const sf2Winner = sf2.winner;
    const sf2Loser  = sf2.winner.toString() === sf2.player1.toString() ? sf2.player2 : sf2.player1;

    // Матч за 3-е место
    tournament.matches.push({
      stage: 'third_place',
      round: 4,
      player1: sf1Loser,
      player2: sf2Loser,
      status: 'pending'
    });

    // Финал
    tournament.matches.push({
      stage: 'final',
      round: 4,
      player1: sf1Winner,
      player2: sf2Winner,
      status: 'pending'
    });

    await tournament.save();

    const [w1, w2, l1, l2] = await Promise.all([
      User.findById(sf1Winner), User.findById(sf2Winner),
      User.findById(sf1Loser),  User.findById(sf2Loser)
    ]);

    const finalsMsg = `👑 <b>ПОЛУФИНАЛЫ СЫГРАНЫ! ФИНАЛ И МАТЧ ЗА 3-Е МЕСТО!</b> 👑\n\n` +
      `🥇 <b>ФИНАЛ:</b> ${w1.name} vs ${w2.name}\n` +
      `🥉 <b>Матч за 3-е место:</b> ${l1.name} vs ${l2.name}\n\n` +
      `Проведите финальные дуэли и подтвердите результат! 🔥`;

    tg.sendMessage(finalsMsg);
  }

  /**
   * Подведение итогов турнира и распределение призового фонда
   */
  async finalizeTournament(tournament) {
    const finalMatch = tournament.matches.find(m => m.stage === 'final');
    const thirdMatch = tournament.matches.find(m => m.stage === 'third_place');

    const p1st = finalMatch.winner;
    const p2nd = finalMatch.winner.toString() === finalMatch.player1.toString() ? finalMatch.player2 : finalMatch.player1;

    const p3rd = thirdMatch.winner;
    const p4th = thirdMatch.winner.toString() === thirdMatch.player1.toString() ? thirdMatch.player2 : thirdMatch.player1;

    // 5-е и 6-е места — третьи места группового этапа
    const sortStandings = (list) => [...list].sort((a, b) => b.points - a.points || b.wins - a.wins);
    const gA = sortStandings(tournament.standings.groupA);
    const gB = sortStandings(tournament.standings.groupB);

    const p5th = gA[2].user;
    const p6th = gB[2].user;

    const pool = tournament.jackpotPool;

    // Проценты выплат: 40%, 25%, 10%, 10%, 7.5%, 7.5%
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

    // Зачисляем Карму победителям
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

    // Сбрасываем пул джекпота в SystemState
    const state = await SystemState.findOne();
    if (state) {
      state.jackpotPool = 0;
      await state.save();
    }

    // Уведомление в Телеграм
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

    // Персональные сообщения
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
