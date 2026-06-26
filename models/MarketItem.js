const mongoose = require('mongoose');

const MarketItemSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  seller: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('MarketItem', MarketItemSchema);
