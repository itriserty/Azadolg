const express = require('express');
const router = express.Router();
const { openCase } = require('../controllers/caseController');

// Открытие кейса за Coins
router.post('/open', openCase);

module.exports = router;
