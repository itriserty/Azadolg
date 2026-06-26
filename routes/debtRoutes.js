const express = require('express');
const router = express.Router();
const { createDebt, confirmDebt, getDebt } = require('../controllers/debtController');

// Создание долга (ожидает подтверждения)
router.post('/create', createDebt);

// Подтверждение долга должником
router.post('/:id/confirm', confirmDebt);

// Получение информации о долге с расчетом пени
router.get('/:id', getDebt);

module.exports = router;
