const mongoose = require('mongoose');

const LotteryPoolSchema = new mongoose.Schema({
  poolAmount: { 
    type: Number, 
    default: 0 
  },
  tickets: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  month: { 
    type: String, 
    required: true // Например, "2026-06"
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('LotteryPool', LotteryPoolSchema);
