const express = require('express');
const router  = express.Router();
const {
  createQuest, joinQuest, takeQuest,
  completeQuest, verifyQuest, cancelQuest, getQuests
} = require('../controllers/questController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Получить все квесты
router.get('/',  getQuests);

// Создать квест (bounty уходит в эскроу)
router.post('/create',   createQuest);

// Откликнуться на квест (multi-participant)
router.post('/join',     joinQuest);

// Legacy: взять квест (один участник)
router.post('/take',     takeQuest);

// Участник отмечает выполненным
router.post('/complete', completeQuest);

// Заказчик подтверждает или отклоняет
router.post('/verify',   verifyQuest);

// Заказчик отменяет квест (bounty возвращается)
router.post('/cancel',   cancelQuest);

module.exports = router;
