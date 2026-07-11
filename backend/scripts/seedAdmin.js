/**
 * seedAdmin.js — скрипт генерации хардкодного admin-аккаунта.
 * Запускать: node backend/scripts/seedAdmin.js
 *
 * Логин:  admin (из .env ADMIN_USERNAME или дефолт)
 * Пароль: из .env ADMIN_PASSWORD (обязательно!)
 */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@azadolg.kz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD не задан в .env! Добавьте переменную и повторите.');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ MongoDB подключена');

  const existing = await User.findOne({ username: ADMIN_USERNAME });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`⚡ Существующий пользователь "${ADMIN_USERNAME}" повышен до admin.`);
    } else {
      console.log(`ℹ️  Администратор "${ADMIN_USERNAME}" уже существует.`);
    }
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin  = new User({
    name:      'Администратор',
    username:  ADMIN_USERNAME,
    email:     ADMIN_EMAIL,
    password:  hashed,
    role:      'admin',
    eloRating: 9999,
    karma:     99999
  });
  await admin.save();

  console.log(`✅ Администратор создан:`);
  console.log(`   Username: ${ADMIN_USERNAME}`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
