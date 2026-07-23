const express = require('express');
const router = express.Router();
const {
  createDuelChallenge,
  respondToDuel,
  createBotTwentyOneDuel,
  playTwentyOneAction,
  getMyDuels,
  getHeadToHeadStats
} = require('../controllers/duelController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/challenge', authMiddleware, createDuelChallenge);
router.post('/respond', authMiddleware, respondToDuel);
router.post('/twenty-one/bot', authMiddleware, createBotTwentyOneDuel);
router.post('/twenty-one/action', authMiddleware, playTwentyOneAction);
router.get('/my', authMiddleware, getMyDuels);
router.get('/h2h/:opponentId', authMiddleware, getHeadToHeadStats);

module.exports = router;
