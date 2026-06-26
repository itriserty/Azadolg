const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  eloRating: { 
    type: Number, 
    default: 1000 // Стартовый ELO-рейтинг (Карма)
  },
  coins: { 
    type: Number, 
    default: 200 // Стартовое количество монет
  },
  friends: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { 
  timestamps: true 
});

module.exports = mongoose.model('User', UserSchema);
