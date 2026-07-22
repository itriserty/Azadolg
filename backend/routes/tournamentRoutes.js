const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  getActiveTournament,
  reportMatch,
  confirmMatch,
  startTournament,
  cancelTournament
} = require('../controllers/tournamentController');

router.use(authMiddleware);

router.get('/active', getActiveTournament);
router.post('/:tournamentId/matches/:matchId/report', reportMatch);
router.post('/:tournamentId/matches/:matchId/confirm', confirmMatch);
router.post('/admin/start', adminMiddleware, startTournament);
router.post('/admin/cancel', adminMiddleware, cancelTournament);

module.exports = router;
