const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  // ── Экономика квеста ─────────────────────────────────────────────────────────
  bounty: {
    type: Number,
    required: true,
    min: 10  // минимальная награда — 10 Кармы
  },
  // ── Участники ────────────────────────────────────────────────────────────────
  maxParticipants: {
    type: Number,
    default: 1,
    min: 1,
    max: 20
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // ── Устаревшее поле assignee (оставляем для совместимости) ───────────────────
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // ── Срок выполнения ──────────────────────────────────────────────────────────
  dueDate: {
    type: Date,
    default: null
  },
  // ── Статус ───────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['available', 'in_progress', 'completed', 'verified', 'cancelled'],
    default: 'available'
  },
  // ── Backwards compat ─────────────────────────────────────────────────────────
  karmaReward: {
    type: Number,
    default: 0  // теперь используем bounty, karmaReward оставляем как alias
  }
}, {
  timestamps: true
});

// При получении: bounty или karmaReward
QuestSchema.virtual('reward').get(function () {
  return this.bounty || this.karmaReward || 0;
});

module.exports = mongoose.model('Quest', QuestSchema);
