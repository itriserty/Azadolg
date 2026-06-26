const mongoose = require('mongoose');

const SystemStateSchema = new mongoose.Schema({
  jackpotPool: {
    type: Number,
    default: 0
  },
  currentSeason: {
    type: Number,
    default: 1
  },
  seasonEndsAt: {
    type: Date,
    default: () => {
      const date = new Date();
      date.setDate(date.getDate() + 30); // 30 дней на сезон по умолчанию
      return date;
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemState', SystemStateSchema);
