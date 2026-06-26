const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Кто взял поручение
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
  karmaReward: {
    type: Number,
    default: 50
  },
  status: {
    type: String,
    enum: ['available', 'in_progress', 'completed', 'verified'],
    default: 'available'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Quest', QuestSchema);
