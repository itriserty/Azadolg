const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemType: {
    type: String,
    enum: ['skin', 'frame', 'boost'],
    required: true
  },
  itemId: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Inventory', InventorySchema);
