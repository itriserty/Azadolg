const express = require('express');
const router  = express.Router();
const { spin, getTiers } = require('../controllers/rouletteController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// GET  /api/roulette/tiers  — описание тиров и шансов
router.get('/tiers', getTiers);

// POST /api/roulette/spin   — запустить рулетку
// body: { tier: 100 | 50 | 25 }
router.post('/spin', spin);

module.exports = router;
