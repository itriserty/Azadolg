const express = require('express');
const router = express.Router();
const { getShopItems, buyShopItem, getUserInventory, activateCosmetic } = require('../controllers/shopController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/items', authMiddleware, getShopItems);
router.post('/buy', authMiddleware, buyShopItem);
router.get('/inventory', authMiddleware, getUserInventory);
router.post('/activate', authMiddleware, activateCosmetic);

module.exports = router;
