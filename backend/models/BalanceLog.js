const mongoose = require('mongoose');

const BalanceLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currency: {
    type: String,
    enum: ['elo', 'karma'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  related_entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

module.exports = mongoose.model('BalanceLog', BalanceLogSchema, 'balance_logs');
