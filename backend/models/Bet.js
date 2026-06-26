const mongoose = require('mongoose');

const BetSchema = new mongoose.Schema({
  debtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  better: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  prediction: {
    type: Boolean,
    required: true // true (вернет в срок) или false (просрочит)
  },
  wager: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Bet', BetSchema);
