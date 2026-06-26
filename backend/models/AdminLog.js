const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: [
      'ban_user',
      'unban_user',
      'delete_debt',
      'cancel_transaction',
      'reset_password',
      'delete_quest',
      'delete_user',
      'manual_karma_grant',
      'manual_elo_adjust'
    ],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  targetModel: {
    type: String,
    enum: ['User', 'Transaction', 'Quest'],
    required: true
  },
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);
