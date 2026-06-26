const express  = require('express');
const router   = express.Router();
const {
  createDebt, getDebts, confirmDebt, declineDebt,
  witnessDecision, submitPaymentProof, forgiveDebt, transferDebt, payDebt
} = require('../controllers/debtController');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadProofMiddleware } = require('../middlewares/uploadMiddleware');

router.use(authMiddleware);

// Создание долга (с witnessId)
router.post('/create', createDebt);

// Получение долгов пользователя
router.get('/user/:userId', getDebts);

// Решение свидетеля: approve | reject
router.post('/:transactionId/witness', witnessDecision);

// Должник подтверждает или отклоняет долг (после approve свидетелем)
router.post('/:transactionId/confirm', confirmDebt);
router.post('/:transactionId/decline', declineDebt);

// Загрузка пруфа оплаты (частичный или полный платёж) — с multer
router.post('/:transactionId/pay-proof', uploadProofMiddleware, submitPaymentProof);

// Legacy endpoint (возвращает подсказку об использовании pay-proof)
router.post('/:transactionId/pay', payDebt);

// Прощение долга кредитором
router.post('/:transactionId/forgive', forgiveDebt);

// Передача долга другому должнику
router.post('/:transactionId/transfer', transferDebt);

module.exports = router;
