const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  getActiveTournament,
  startMatchLeg,
  acceptMatchLeg,
  startTournament,
  cancelTournament
} = require('../controllers/tournamentController');

router.use(authMiddleware);

router.get('/active', getActiveTournament);
router.post('/:tournamentId/matches/:matchId/start', startMatchLeg);
router.post('/:tournamentId/matches/:matchId/accept', acceptMatchLeg);

// Alias routes for backward compatibility
router.post('/:tournamentId/matches/:matchId/report', startMatchLeg);
router.post('/:tournamentId/matches/:matchId/confirm', acceptMatchLeg);

router.post('/admin/start', adminMiddleware, startTournament);
router.post('/admin/cancel', adminMiddleware, cancelTournament);

module.exports = router;
