const mongoose = require('mongoose');

const UserAchievementProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achievementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true
  },
  currentValue: {
    type: Number,
    default: 0
  },
  isEarned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Уникальный составной индекс
UserAchievementProgressSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('UserAchievementProgress', UserAchievementProgressSchema, 'user_achievement_progress');
