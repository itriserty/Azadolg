const express = require('express');
const router = express.Router();
const { getUsers, getLeaderboard, createUser, addFriend } = require('../controllers/userController');

router.get('/', getUsers);
router.get('/leaderboard', getLeaderboard);  // GET /api/users/leaderboard
router.post('/register', createUser);
router.post('/add-friend', addFriend);

module.exports = router;
