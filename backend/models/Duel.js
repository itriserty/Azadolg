const mongoose = require('mongoose');

const DuelSchema = new mongoose.Schema({
  challenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  opponent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  debtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null // Если дуэль ведется на списание долга
  },
  wager: {
    type: Number,
    default: 0 // Ставка в Карме
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'finished'],
    default: 'pending'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Duel', DuelSchema);
