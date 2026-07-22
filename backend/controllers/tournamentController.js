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

async function startMatchLeg(req, res) {
  try {
    const { tournamentId, matchId } = req.params;
    const userId = req.user;

    const tournament = await tournamentService.startMatchLeg(tournamentId, matchId, userId);
    res.status(200).json({ message: 'Вызов на дуэль отправлен сопернику!', tournament });
  } catch (error) {
    console.error('[tournamentController/startMatchLeg]', error);
    res.status(500).json({ error: error.message || 'Ошибка старта партии' });
  }
}

async function acceptMatchLeg(req, res) {
  try {
    const { tournamentId, matchId } = req.params;
    const userId = req.user;

    const tournament = await tournamentService.acceptMatchLeg(tournamentId, matchId, userId);
    res.status(200).json({ message: 'Дуэль принята! Результат жребия по ELO успешно рассчитан.', tournament });
  } catch (error) {
    console.error('[tournamentController/acceptMatchLeg]', error);
    res.status(500).json({ error: error.message || 'Ошибка проведения дуэли' });
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

async function cancelTournament(req, res) {
  try {
    const result = await tournamentService.cancelActiveTournament();
    res.status(200).json({ message: `Турнир отменён! ${result.restoredPool} ✧ Кармы возвращено в джекпот-пул.`, result });
  } catch (error) {
    console.error('[tournamentController/cancelTournament]', error);
    res.status(500).json({ error: error.message || 'Ошибка отмены турнира' });
  }
}

module.exports = {
  getActiveTournament,
  startMatchLeg,
  acceptMatchLeg,
  startTournament,
  cancelTournament
};
