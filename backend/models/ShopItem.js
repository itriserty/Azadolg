const mongoose = require('mongoose');

const ShopItemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    required: true,
    enum: ['frame', 'skin', 'boost', 'badge', 'title', 'nick_color']
  },
  rarity: {
    type: String,
    required: true,
    enum: ['common', 'rare', 'legendary', 'immortal'],
    default: 'common'
  },
  description: {
    type: String,
    default: ''
  },
  value: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ShopItem', ShopItemSchema);
