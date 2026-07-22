const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  getActiveTournament,
  reportMatch,
  confirmMatch,
  startTournament
} = require('../controllers/tournamentController');

router.use(authMiddleware);

router.get('/active', getActiveTournament);
router.post('/:tournamentId/matches/:matchId/report', reportMatch);
router.post('/:tournamentId/matches/:matchId/confirm', confirmMatch);
router.post('/admin/start', adminMiddleware, startTournament);

module.exports = router;
