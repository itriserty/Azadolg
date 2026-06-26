const express = require('express');
const router = express.Router();
const { createQuest, takeQuest, completeQuest, verifyQuest, cancelQuest, getQuests } = require('../controllers/questController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/create', authMiddleware, createQuest);
router.post('/take', authMiddleware, takeQuest);
router.post('/complete', authMiddleware, completeQuest);
router.post('/verify', authMiddleware, verifyQuest);
router.post('/cancel', authMiddleware, cancelQuest);
router.get('/', authMiddleware, getQuests);

module.exports = router;
