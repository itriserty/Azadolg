const mongoose = require('mongoose');

const UserTaskSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  task_type: {
    type: String,
    required: true
  },
  target_value: {
    type: Number,
    required: true
  },
  current_value: {
    type: Number,
    default: 0
  },
  reward_karma: {
    type: Number,
    required: true
  },
  is_completed: {
    type: Boolean,
    default: false
  },
  expires_at: {
    type: Date,
    required: true
  },
  meta_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('UserTask', UserTaskSchema, 'user_tasks');
