const mongoose = require('mongoose');

const DebtSchema = new mongoose.Schema({
  creditor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  debtor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  penaltyRate: { 
    type: Number, 
    default: 0.01 // 1% в день от суммы долга при просрочке
  },
  dueDate: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending_confirmation', 'active', 'declined', 'paid'], 
    default: 'pending_confirmation' 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Debt', DebtSchema);
