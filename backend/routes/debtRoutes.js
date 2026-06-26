const express = require('express');
const router = express.Router();
const { createDebt, getDebts, payDebt, confirmDebt, declineDebt } = require('../controllers/debtController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Создание долга
router.post('/create', createDebt);

// Получение активных долгов конкретного пользователя
router.get('/user/:userId', getDebts);

// Оплата долга (возврат)
router.post('/:transactionId/pay', payDebt);

// Подтверждение и отклонение долга
router.post('/:transactionId/confirm', confirmDebt);
router.post('/:transactionId/decline', declineDebt);

module.exports = router;
