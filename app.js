require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Импорт роутов
const debtRoutes = require('./routes/debtRoutes');
const marketRoutes = require('./routes/marketRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Middleware для обработки JSON
app.use(express.json());

// Логгирование запросов (простой логгер)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Регистрация API-роутов
app.use('/debts', debtRoutes);
app.use('/market', marketRoutes);
app.use('/user', userRoutes);

// Проверка статуса сервера
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Подключение к MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gamified-debt-tracker';
const PORT = process.env.PORT || 3000;

console.log('Подключение к MongoDB...');
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Успешное подключение к MongoDB.');
    // Запуск сервера только после успешного подключения к БД
    app.listen(PORT, () => {
      console.log(`Сервер запущен и слушает порт ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app; // Экспортируем для тестирования
