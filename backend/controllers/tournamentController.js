const tournamentService = require('../services/tournamentService');

async function getActiveTournament(req, res) {
  try {
    const tournament = await tournamentService.getActiveTournament();
    res.status(200).json(tournament);
  } catch (error) {
    console.error('[tournamentController/getActiveTournament]', error);
    res.status(500).json({ error: error.message || 'Ошибка получения турнира' });
  }
}

async function reportMatch(req, res) {
  try {
    const { tournamentId, matchId } = req.params;
    const { winnerId } = req.body;
    const userId = req.user;

    if (!winnerId) {
      return res.status(400).json({ error: 'Укажите ID победителя' });
    }

    const tournament = await tournamentService.reportMatchResult(tournamentId, matchId, userId, winnerId);
    res.status(200).json({ message: 'Результат матча отправлен на подтверждение', tournament });
  } catch (error) {
    console.error('[tournamentController/reportMatch]', error);
    res.status(500).json({ error: error.message || 'Ошибка отправки результата матча' });
  }
}

async function confirmMatch(req, res) {
  try {
    const { tournamentId, matchId } = req.params;
    const userId = req.user;

    const tournament = await tournamentService.confirmMatchResult(tournamentId, matchId, userId);
    res.status(200).json({ message: 'Результат матча подтвержден!', tournament });
  } catch (error) {
    console.error('[tournamentController/confirmMatch]', error);
    res.status(500).json({ error: error.message || 'Ошибка подтверждения результата матча' });
  }
}

async function startTournament(req, res) {
  try {
    const { playerIds, customPool } = req.body;
    const tournament = await tournamentService.createTournament(playerIds, customPool);
    res.status(201).json({ message: 'Турнирный джекпот успешно запущен!', tournament });
  } catch (error) {
    console.error('[tournamentController/startTournament]', error);
    res.status(500).json({ error: error.message || 'Ошибка запуска турнира' });
  }
}

module.exports = {
  getActiveTournament,
  reportMatch,
  confirmMatch,
  startTournament
};
