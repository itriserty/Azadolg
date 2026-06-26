const express = require('express');
const router = express.Router();
const { openCase } = require('../controllers/caseController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Открытие кейса за Coins
router.post('/open', openCase);

module.exports = router;
