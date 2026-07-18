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
  },
  // ── Уровень и EXP игрока ──────────────────────────────────────────────────────
  level: {
    type: Number,
    default: 1
  },
  exp: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ── Метод для унифицированного изменения баланса ──────────────────────────────
UserSchema.methods.replenishBalance = function(currency, amount, reason, relatedEntityId = null) {
  if (currency === 'elo') {
    this.eloRating = (this.eloRating || 1000) + amount;
    if (this.eloRating < 100) this.eloRating = 100;
    this._eloReason = reason;
    this._eloRelatedEntityId = relatedEntityId;
    if (!this._balanceLogs) this._balanceLogs = [];
    this._balanceLogs.push({
      currency: 'elo',
      amount,
      reason,
      related_entity_id: relatedEntityId
    });
  } else if (currency === 'karma') {
    this.karma = (this.karma || 0) + amount;
    this._karmaReason = reason;
    this._karmaRelatedEntityId = relatedEntityId;
    if (!this._balanceLogs) this._balanceLogs = [];
    this._balanceLogs.push({
      currency: 'karma',
      amount,
      reason,
      related_entity_id: relatedEntityId
    });
  }
};

// Сохраняем исходные значения при инициализации документа из базы данных
UserSchema.post('init', function(doc) {
  doc._originalElo = doc.eloRating;
  doc._originalKarma = doc.karma;
});

// ── Middleware для автоматической проверки негативной кармы и изменений баланса ────────────────────
UserSchema.pre('save', function(next) {
  if (this.isModified('karma') && this.karma < 0) {
    this._karmaDroppedNegative = true;
  }

  if (!this._balanceLogs) {
    this._balanceLogs = [];
  }

  const originalElo = this._originalElo !== undefined ? this._originalElo : 1000;
  const originalKarma = this._originalKarma !== undefined ? this._originalKarma : 200;

  if (this.isModified('eloRating')) {
    const diff = this.eloRating - originalElo;
    if (diff !== 0) {
      const sumLogged = this._balanceLogs
        .filter(log => log.currency === 'elo')
        .reduce((sum, log) => sum + log.amount, 0);
      if (sumLogged !== diff) {
        this._balanceLogs.push({
          currency: 'elo',
          amount: diff - sumLogged,
          reason: this._eloReason || 'other',
          related_entity_id: this._eloRelatedEntityId || null
        });
      }
    }
  }

  if (this.isModified('karma')) {
    const diff = this.karma - originalKarma;
    if (diff !== 0) {
      const sumLogged = this._balanceLogs
        .filter(log => log.currency === 'karma')
        .reduce((sum, log) => sum + log.amount, 0);
      if (sumLogged !== diff) {
        this._balanceLogs.push({
          currency: 'karma',
          amount: diff - sumLogged,
          reason: this._karmaReason || 'other',
          related_entity_id: this._karmaRelatedEntityId || null
        });
      }
    }
  }

  // Обновляем оригинальные значения
  this._originalElo = this.eloRating;
  this._originalKarma = this.karma;

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

  if (doc._balanceLogs && doc._balanceLogs.length > 0) {
    const BalanceLog = mongoose.model('BalanceLog');
    const logs = doc._balanceLogs.map(log => ({
      user_id: doc._id,
      currency: log.currency,
      amount: log.amount,
      reason: log.reason,
      related_entity_id: log.related_entity_id
    }));

    // Очищаем локальный список изменений
    doc._balanceLogs = [];

    BalanceLog.insertMany(logs).catch(err => {
      console.error('[UserSchema post-save] Ошибка сохранения balance_logs:', err);
    });
  }
});

module.exports = mongoose.model('User', UserSchema);

