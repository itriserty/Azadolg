const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  telegramId: {
    type: String,
    default: null
  },
  eloRating: { 
    type: Number, 
    default: 1000 // Стартовый ELO-рейтинг (Карма)
  },
  coins: { 
    type: Number, 
    default: 200 // Стартовое количество монет
  },
  karma: {
    type: Number,
    default: 200 // Игровая Карма (основная валюта магазина)
  },
  winStreak: {
    type: Number,
    default: 0 // Серия закрытия долгов вовремя
  },
  stats: {
    totalDebtsCreated: { type: Number, default: 0 },
    totalDebtsPaid: { type: Number, default: 0 },
    debtsPaidOnTime: { type: Number, default: 0 },
    totalKarmaEarned: { type: Number, default: 0 }
  },
  battlePassLevel: {
    type: Number,
    default: 1
  },
  battlePassXP: {
    type: Number,
    default: 0 // 100 XP на уровень
  },
  activeProfileSkin: {
    type: String,
    default: 'default' // Косметический скин профиля
  },
  activeProfileFrame: {
    type: String,
    default: 'none' // Рамка профиля
  },
  avatar: {
    type: String,
    default: null // URL или Base64 строка фотографии профиля
  },
  resetCode: {
    type: String,
    default: null
  },
  resetCodeExpires: {
    type: Date,
    default: null
  },
  friends: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { 
  timestamps: true 
});

module.exports = mongoose.model('User', UserSchema);
