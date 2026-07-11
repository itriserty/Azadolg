const express = require('express');
const router  = express.Router();
const {
  getUsers, banUser, unbanUser, deleteUser,
  getAllDebts, deleteDebt, cancelTransaction,
  resetUserPassword, getAdminLogs, grantKarma,
  getAchievements, createAchievement, updateAchievement, deleteAchievement,
  distributeKarma
} = require('../controllers/adminController');
const authMiddleware  = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Все admin-роуты защищены: сначала auth, затем admin
router.use(authMiddleware);
router.use(adminMiddleware);

// ── Пользователи ─────────────────────────────────────────────────────────────
router.get('/users',                       getUsers);
router.post('/users/distribute-karma',     distributeKarma);
router.post('/users/:id/ban',              banUser);
router.post('/users/:id/unban',            unbanUser);
router.delete('/users/:id',                deleteUser);
router.post('/users/:id/reset-password',   resetUserPassword);
router.post('/users/:id/grant-karma',      grantKarma);

// ── Долги ─────────────────────────────────────────────────────────────────────
router.get('/debts',               getAllDebts);
router.delete('/debts/:id',        deleteDebt);
router.post('/debts/:id/cancel',   cancelTransaction);

// ── Достижения (Achievements CRUD) ──────────────────────────────────────────
router.get('/achievements',        getAchievements);
router.post('/achievements',       createAchievement);
router.put('/achievements/:id',    updateAchievement);
router.delete('/achievements/:id', deleteAchievement);

// ── Логи ──────────────────────────────────────────────────────────────────────
router.get('/logs',                getAdminLogs);

module.exports = router;
