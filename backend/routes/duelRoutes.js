const express = require('express');
const router = express.Router();
const { createDuelChallenge, respondToDuel, getMyDuels } = require('../controllers/duelController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/challenge', authMiddleware, createDuelChallenge);
router.post('/respond', authMiddleware, respondToDuel);
router.get('/my', authMiddleware, getMyDuels);

module.exports = router;
