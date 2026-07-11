require('dotenv').config();

// Исправление DNS-резолвинга SRV записей MongoDB Atlas (решает проблему ECONNREFUSED)
try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('[DNS] Не удалось установить публичные DNS-серверы:', err.message);
}

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const userRoutes  = require('./routes/userRoutes');
const debtRoutes  = require('./routes/debtRoutes');
const caseRoutes  = require('./routes/caseRoutes');
const friendRoutes = require('./routes/friendRoutes');
const shopRoutes  = require('./routes/shopRoutes');
const gachaRoutes = require('./routes/gachaRoutes');
const duelRoutes  = require('./routes/duelRoutes');
const betRoutes   = require('./routes/betRoutes');
const fundRoutes  = require('./routes/fundRoutes');
const questRoutes = require('./routes/questRoutes');
const adminRoutes = require('./routes/adminRoutes');
const marketRoutes = require('./routes/marketRoutes');
const postRoutes = require('./routes/postRoutes');
const { startReminderScheduler } = require('./services/reminderService');
const { startCronScheduler } = require('./services/cronService');

const { getLeaderboard } = require('./controllers/userController');
const { openCase }       = require('./controllers/caseController');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ── API-роуты ──────────────────────────────────────────────────────────────────
app.use('/api/users',  userRoutes);
app.use('/api/debts',  debtRoutes);
app.use('/api/cases',  caseRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/gacha', gachaRoutes);
app.use('/api/duel', duelRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/fund', fundRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/posts', postRoutes);

// Статика загруженных пруфов оплаты
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Верхнеуровневые роуты (требуемые по заданию)
const authMiddleware = require('./middlewares/authMiddleware');
app.get('/api/leaderboard', authMiddleware, getLeaderboard);
app.post('/api/open-case',  authMiddleware, openCase);
app.get('/api/system/jackpot', authMiddleware, async (req, res) => {
  try {
    const SystemState = require('./models/SystemState');
    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
      await state.save();
    }
    res.status(200).json({ jackpotPool: state.jackpotPool });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения джекпота' });
  }
});

// ── Раздача собранного React-фронтенда ────────────────────────────────────────
// На Render фронтенд собирается перед стартом (см. render.yaml buildCommand).
// В production backend отдаёт статику из ../frontend/dist
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));

// Все несовпадающие маршруты → index.html (SPA-режим)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'), err => {
    if (err) res.status(200).send('Azadolg API is running ✅');
  });
});

// ── Автозаполнение БД (только при пустой коллекции) ───────────────────────────
// ВАЖНО: данные НЕ сбрасываются при перезапуске на Render —
// seed срабатывает только если User.countDocuments() === 0.
// Данные хранятся в MongoDB Atlas (MONGO_URI в .env → Render Environment Variables).
async function seedDatabase() {
  const User        = require('./models/User');
  const Transaction = require('./models/Transaction');
  const Achievement = require('./models/Achievement');
  const bcrypt      = require('bcryptjs');

  // Семена достижений
  const achCount = await Achievement.countDocuments();
  if (achCount === 0) {
    console.log('[SEED] Создаём стандартные достижения Azadolg...');
    await Achievement.insertMany([
      {
        slug: 'declined_loan_streak',
        title: 'ПИДАРАС НЕ ДАЮЩИЙ',
        description: 'Отклонил 4 входящих запроса в долг подряд.',
        emoji: '🤬',
        rarity: 'rare',
        trigger: 'declined_loan_streak',
        threshold: 4,
        isActive: true
      },
      {
        slug: 'overdue_365',
        title: 'Еблан года',
        description: 'Имеет активный долг с просрочкой более 365 дней.',
        emoji: '💩',
        rarity: 'legendary',
        trigger: 'overdue_365',
        threshold: 1,
        isActive: true
      },
      {
        slug: 'active_debts_count',
        title: 'Мамкин инвестор',
        description: 'Набрал 5 и более активных долгов одновременно.',
        emoji: '🤑',
        rarity: 'rare',
        trigger: 'active_debts_count',
        threshold: 5,
        isActive: true
      },
      {
        slug: 'debts_paid_count',
        title: 'Честный должник',
        description: 'Успешно закрыл 10 долгов.',
        emoji: '🤝',
        rarity: 'common',
        trigger: 'debts_paid_count',
        threshold: 10,
        isActive: true
      },
      {
        slug: 'forgiven_count',
        title: 'Добряк',
        description: 'Простил долг другому пользователю 5 раз.',
        emoji: '💖',
        rarity: 'rare',
        trigger: 'forgiven_count',
        threshold: 5,
        isActive: true
      },
      {
        slug: 'witnesses_count',
        title: 'Честный свидетель',
        description: 'Выступил свидетелем и подтвердил долг 5 раз.',
        emoji: '⚖️',
        rarity: 'common',
        trigger: 'witnesses_count',
        threshold: 5,
        isActive: true
      }
    ]);
  }

  // Семена магазина
  try {
    const { seedShop } = require('./scripts/seedShop');
    await seedShop();
  } catch (err) {
    console.error('[app.js] Ошибка импорта/запуска сидирования магазина:', err);
  }

  // Очистка БД от устаревших учетных записей (без логина/пароля), чтобы не засорять ленту
  const deletedLegacy = await User.deleteMany({
    $or: [
      { username: { $exists: false } },
      { username: null },
      { password: { $exists: false } },
      { password: null }
    ]
  });
  if (deletedLegacy.deletedCount > 0) {
    console.log(`[SEED] Удалено ${deletedLegacy.deletedCount} устаревших аккаунтов без логина/пароля.`);
  }

  const count = await User.countDocuments();
  if (count > 0) {
    console.log(`[SEED] БД уже содержит ${count} пользователей. Пропускаем seed.`);
    return;
  }

  console.log('[SEED] База данных пуста. Создаём тестовые данные...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const alice   = new User({ name: 'Алиса',  username: 'alice',   password: hashedPassword, email: 'alice@example.com',   eloRating: 1050, karma: 250 });
  const bob     = new User({ name: 'Боб',    username: 'bob',     password: hashedPassword, email: 'bob@example.com',     eloRating: 980,  karma: 80  });
  const charlie = new User({ name: 'Чарли',  username: 'charlie', password: hashedPassword, email: 'charlie@example.com', eloRating: 1000, karma: 400 });
  await Promise.all([alice.save(), bob.save(), charlie.save()]);

  alice.friends   = [bob._id, charlie._id];
  bob.friends     = [alice._id, charlie._id];
  charlie.friends = [alice._id, bob._id];
  await Promise.all([alice.save(), bob.save(), charlie.save()]);

  // Активный долг (срок через 3 дня)
  const futureDue = new Date(); futureDue.setDate(futureDue.getDate() + 3);
  await new Transaction({
    creditor: alice._id, debtor: bob._id,
    amount: 500, originalAmount: 500,
    description: 'Скинулись на пиццу 🍕',
    dueDate: futureDue, penaltyRate: 0.01, status: 'active'
  }).save();

  // Просроченный долг — создан 8 дней назад → штраф 5% виден сразу
  const oldDate = new Date(); oldDate.setDate(oldDate.getDate() - 8);
  const overdueTx = new Transaction({
    creditor: bob._id, debtor: charlie._id,
    amount: 800, originalAmount: 800,
    description: 'Такси из клуба 🚖',
    dueDate: oldDate, penaltyRate: 0.02, status: 'active'
  });
  overdueTx.createdAt = oldDate;
  await overdueTx.save();

  console.log('[SEED] Готово: 3 пользователя, 2 долга (один просроченный → +5% штраф).');
}

// ── Подключение к MongoDB и запуск сервера ────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
const PORT      = process.env.PORT || 5000;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI не задан! Укажите его в .env или в переменных окружения Render.');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    console.log('✅ MongoDB Atlas: подключено.');
    await seedDatabase();
    startReminderScheduler();
    startCronScheduler();
    app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB: ошибка подключения:', err.message);
    process.exit(1);
  });
