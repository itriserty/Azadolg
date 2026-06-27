const mongoose = require('mongoose');

const MarketItemSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemId: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    enum: ['skin', 'frame', 'boost'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MarketItem', MarketItemSchema);
