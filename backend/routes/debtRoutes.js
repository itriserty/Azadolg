const express = require('express');
const router = express.Router();
const { createDebt, getDebts, payDebt } = require('../controllers/debtController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Создание долга
router.post('/create', createDebt);

// Получение активных долгов конкретного пользователя
router.get('/user/:userId', getDebts);

// Оплата долга (возврат)
router.post('/:transactionId/pay', payDebt);

module.exports = router;
