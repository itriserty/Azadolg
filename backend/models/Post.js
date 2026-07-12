const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['user_post', 'debt_created', 'achievement_earned', 'system_shaming', 'external_meme'],
    default: 'user_post'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: false
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  image_url: {
    type: String,
    required: false
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Post', PostSchema);
