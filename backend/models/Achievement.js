const mongoose = require('mongoose');

const AchievementSchema = new mongoose.Schema({
  // Уникальный slug — используется как идентификатор в коде
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  emoji: {
    type: String,
    default: '🏆'
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary', 'seasonal'],
    default: 'common'
  },
  // Тип тригера (для автоматической выдачи)
  trigger: {
    type: String,
    enum: [
      'declined_loan_streak',   // отклонял долги подряд
      'overdue_365',            // просрочка > 365 дней
      'active_debts_count',     // много активных долгов одновременно
      'debts_paid_count',       // закрыл N долгов
      'forgiven_count',         // простил N долгов
      'witnesses_count',        // был свидетелем N раз
      'marketplace_sales',      // продал N предметов
      'season_champion',        // топ-3 по итогам сезона
      'empty_promises',         // просрочил N долгов
      'jackpot_winner',         // выиграл джекпот
      'self_borrow',            // занял у себя
      'negative_karma',         // карма опустилась ниже 0
      'karma_transferred',      // перевел суммарно N Кармы
      'blind_kitten',           // выдал долг без свидетеля на сумму больше X
      'witness_decline',        // отказался быть свидетелем N раз
      'avatar_set',             // установил аватарку
      'custom'                  // выдаётся вручную администратором
    ],
    default: 'custom'
  },
  // Порог срабатывания (например: 4 для declined_loan_streak)
  threshold: {
    type: Number,
    default: 1
  },
  isSecret: {
    type: Boolean,
    default: false  // скрытые ачивки не видны до получения
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Может ли выдаваться несколько раз (для seasonal)
  isRepeatable: {
    type: Boolean,
    default: false
  },
  createdByAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Achievement', AchievementSchema);
