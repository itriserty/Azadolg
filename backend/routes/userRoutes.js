const express = require('express');
const router = express.Router();
const {
  getUsers, getLeaderboard, addFriend, updateTelegramId, updateAvatar,
  getUserProfile, toggleProfilePrivacy, updateShowcase, addProfileComment, deleteProfileComment,
  transferKarma
} = require('../controllers/userController');
const { register, login, getMe, forgotPassword, resetPassword } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadAvatarMiddleware } = require('../middlewares/uploadMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authMiddleware, getMe);
router.put('/telegram', authMiddleware, updateTelegramId);
router.put('/avatar', authMiddleware, uploadAvatarMiddleware, updateAvatar);

router.get('/', authMiddleware, getUsers);
router.get('/leaderboard', authMiddleware, getLeaderboard);
router.post('/add-friend', authMiddleware, addFriend);
router.post('/transfer', authMiddleware, transferKarma);

// ── Профили, Приватность, Комментарии и Витрина ─────────────────────────────
router.get('/:id/profile', authMiddleware, getUserProfile);
router.post('/profile/privacy', authMiddleware, toggleProfilePrivacy);
router.post('/profile/showcase', authMiddleware, updateShowcase);
router.post('/:id/comments', authMiddleware, addProfileComment);
router.delete('/:id/comments/:commentId', authMiddleware, deleteProfileComment);

module.exports = router;
