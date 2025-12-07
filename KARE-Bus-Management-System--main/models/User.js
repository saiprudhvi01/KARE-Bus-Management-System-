const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: function() {
      return !this.googleId; // Name is required only for non-Google OAuth users
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password is required only for non-Google OAuth users
    }
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['student', 'driver', 'management'],
    required: true
  },
  studentId: {
    type: String,
    required: function() {
      return this.role === 'student' && !this.googleId;
    }
  },
  department: {
    type: String,
    required: function() {
      return this.role === 'student' && !this.googleId;
    }
  },
  picture: {
    type: String
  },
  assignedBus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null
  },
  boardingStop: {
    type: String,
    default: ''
  },
  busRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusRequest'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema); 