try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('[DNS] Не удалось установить публичные DNS-серверы:', err.message);
}

require('dotenv').config();
const mongoose = require('mongoose');
const SystemState = require('../models/SystemState');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log('Подключение к MongoDB...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('Подключено успешно. Сброс джекпота...');
    
    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
    }
    const oldJackpot = state.jackpotPool;
    state.jackpotPool = 0;
    await state.save();
    
    console.log(`Джекпот успешно сброшен! Прежнее значение: ${oldJackpot}, Новое значение: ${state.jackpotPool}`);
  } catch (err) {
    console.error('Ошибка при выполнении скрипта сброса джекпота:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Подключение закрыто.');
  }
}

run();
