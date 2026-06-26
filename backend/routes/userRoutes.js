const express = require('express');
const router = express.Router();
const { getUsers, getLeaderboard, addFriend, updateTelegramId } = require('../controllers/userController');
const { register, login, getMe } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/telegram', authMiddleware, updateTelegramId);

router.get('/', authMiddleware, getUsers);
router.get('/leaderboard', authMiddleware, getLeaderboard);
router.post('/add-friend', authMiddleware, addFriend);

module.exports = router;
