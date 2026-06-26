const express = require('express');
const router = express.Router();
const { buyMarketItem, createMarketItem } = require('../controllers/marketController');

// Покупка товара на маркете
router.post('/buy', buyMarketItem);

// Создание товара на маркете (вспомогательный эндпоинт)
router.post('/create', createMarketItem);

module.exports = router;
