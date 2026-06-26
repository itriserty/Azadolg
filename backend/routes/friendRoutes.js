const express = require('express');
const router = express.Router();
const {
  addFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  getPendingRequests
} = require('../controllers/friendController');
const authMiddleware = require('../middlewares/authMiddleware');

// Все социальные роуты защищены JWT авторизацией
router.use(authMiddleware);

router.post('/add', addFriend);
router.post('/accept', acceptFriendRequest);
router.post('/reject', rejectFriendRequest);
router.get('/', getFriends);
router.get('/requests', getPendingRequests);

module.exports = router;
