const express = require('express');
const router = express.Router();
const { getFeed } = require('../controllers/feedController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, getFeed);

module.exports = router;
