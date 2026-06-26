const express = require('express');
const router = express.Router();
const { pullGacha } = require('../controllers/gachaController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/pull', authMiddleware, pullGacha);

module.exports = router;
