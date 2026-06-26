const express = require('express');
const router = express.Router();
const { createFund, contributeToFund, getFunds } = require('../controllers/fundController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/create', authMiddleware, createFund);
router.post('/contribute', authMiddleware, contributeToFund);
router.post('/:id/contribute', authMiddleware, (req, res, next) => {
  req.body.fundId = req.params.id;
  next();
}, contributeToFund);
router.get('/', authMiddleware, getFunds);

module.exports = router;
