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
  // ── Роль ─────────────────────────────────────────────────────────────────────
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // ── Бан ──────────────────────────────────────────────────────────────────────
  isBanned: {
    type: Boolean,
    default: false
  },
  bannedReason: {
    type: String,
    default: null
  },
  bannedAt: {
    type: Date,
    default: null
  },
  // ── Telegram ──────────────────────────────────────────────────────────────────
  telegramId: {
    type: String,
    default: null
  },
  // ── Игровые показатели ────────────────────────────────────────────────────────
  eloRating: {
    type: Number,
    default: 1000
  },
  karma: {
    type: Number,
    default: 200
  },
  winStreak: {
    type: Number,
    default: 0
  },
  // ── Расширенная статистика ────────────────────────────────────────────────────
  stats: {
    totalDebtsCreated:        { type: Number, default: 0 },
    totalDebtsPaid:           { type: Number, default: 0 },
    debtsPaidOnTime:          { type: Number, default: 0 },
    totalKarmaEarned:         { type: Number, default: 0 },
    totalDebtsForgivenByMe:   { type: Number, default: 0 }, // сколько простил
    totalKarmaWeeklyReceived: { type: Number, default: 0 }, // итого от еженедельного бонуса
    totalDebtsWitnessed:      { type: Number, default: 0 }  // сколько раз был свидетелем
  },
  // ── Battle Pass ───────────────────────────────────────────────────────────────
  battlePassLevel: { type: Number, default: 1 },
  battlePassXP:    { type: Number, default: 0 },
  // ── Косметика ─────────────────────────────────────────────────────────────────
  activeProfileSkin:  { type: String, default: 'default' },
  activeProfileFrame: { type: String, default: 'none'    },
  avatar:             { type: String, default: null       },
  avatar_url:         { type: String, default: null       },
  // ── Приватность и Витрина ─────────────────────────────────────────────────────
  isPrivateProfile:   { type: Boolean, default: false },
  badges:             [{ type: String }],
  achievements: [{
    achievement: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' },
    earnedAt:    { type: Date, default: Date.now }
  }],
  achievementShowcase: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' }],
  consecutiveDeclines: { type: Number, default: 0 },
  // ── Сброс пароля ──────────────────────────────────────────────────────────────
  resetCode:         { type: String, default: null },
  resetCodeExpires:  { type: Date,   default: null },
  // ── Социальное ────────────────────────────────────────────────────────────────
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // ── Последний логин (для проверки активности) ─────────────────────────────────
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ── Middleware для автоматической проверки негативной кармы ────────────────────
UserSchema.pre('save', function(next) {
  if (this.isModified('karma') && this.karma < 0) {
    this._karmaDroppedNegative = true;
  }
  next();
});

UserSchema.post('save', function(doc) {
  if (doc._karmaDroppedNegative) {
    doc._karmaDroppedNegative = false;
    const achievementService = require('../services/AchievementService');
    achievementService.onKarmaChanged(doc._id).catch(err => {
      console.error('[UserSchema post-save] Ошибка вызова AchievementService:', err);
    });
  }
});

module.exports = mongoose.model('User', UserSchema);
