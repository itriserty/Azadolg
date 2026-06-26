const express = require('express');
const router = express.Router();
const { placeBet, getMyBets } = require('../controllers/betController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/create', authMiddleware, placeBet);
router.get('/my', authMiddleware, getMyBets);

module.exports = router;
