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
  karma: { 
    type: Number, 
    default: 0 
  },
  balance: { 
    type: Number, 
    default: 10000 // Начальный баланс монет для покупок на маркете
  },
  friends: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { 
  timestamps: true 
});

module.exports = mongoose.model('User', UserSchema);
