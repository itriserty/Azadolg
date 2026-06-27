const express = require('express');
const router = express.Router();
const { listMarketItems, sellMarketItem, buyMarketItem, cancelMarketItem } = require('../controllers/marketController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/list', listMarketItems);
router.post('/sell', sellMarketItem);
router.post('/buy/:id', buyMarketItem);
router.post('/cancel/:id', cancelMarketItem);

module.exports = router;
