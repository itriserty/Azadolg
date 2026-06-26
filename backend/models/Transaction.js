const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
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
  originalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  dueDate: { 
    type: Date, 
    required: true 
  },
  penaltyRate: { 
    type: Number, 
    default: 0.01 // 1% в день при просрочке
  },
  status: { 
    type: String, 
    enum: ['pending_approval', 'active', 'paid', 'declined'], 
    default: 'pending_approval' 
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  overdueReminderSent: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Transaction', TransactionSchema);
