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
  gameType: {
    type: String,
    enum: ['coinflip', 'twenty_one'],
    default: 'coinflip'
  },
  gameState: {
    deck: [{
      suit: { type: String, enum: ['red', 'blue'] },
      value: { type: Number, min: 3, max: 11 },
      id: String
    }],
    challengerHand: [{
      suit: { type: String, enum: ['red', 'blue'] },
      value: { type: Number, min: 3, max: 11 },
      id: String
    }],
    opponentHand: [{
      suit: { type: String, enum: ['red', 'blue'] },
      value: { type: Number, min: 3, max: 11 },
      id: String
    }],
    challengerPassed: { type: Boolean, default: false },
    opponentPassed: { type: Boolean, default: false },
    currentTurn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isBotMatch: { type: Boolean, default: false },
    lastAction: { type: String, default: '' },
    replayMessage: { type: String, default: '' }
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
