const mongoose = require('mongoose');

const ProfileCommentSchema = new mongoose.Schema({
  profileUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProfileComment', ProfileCommentSchema);
