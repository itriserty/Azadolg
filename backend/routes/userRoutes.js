const express = require('express');
const router = express.Router();
const { getUsers, getLeaderboard, addFriend, updateTelegramId, updateAvatar } = require('../controllers/userController');
const { register, login, getMe, forgotPassword, resetPassword } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authMiddleware, getMe);
router.put('/telegram', authMiddleware, updateTelegramId);
router.put('/avatar', authMiddleware, updateAvatar);

router.get('/', authMiddleware, getUsers);
router.get('/leaderboard', authMiddleware, getLeaderboard);
router.post('/add-friend', authMiddleware, addFriend);

module.exports = router;
