const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Bus = require('../models/Bus');
const { getAuthUrl, getUserInfo } = require('../config/google-oauth');

// Google OAuth routes
router.get('/google', (req, res) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    console.log('Google OAuth callback received');
    console.log('Query params:', req.query);
    
    const { code } = req.query;
    if (!code) {
      console.log('No authorization code found');
      req.flash('error_msg', 'Authorization code not found');
      return res.redirect('/login');
    }

    console.log('Getting user info with code...');
    const userInfo = await getUserInfo(code);
    console.log('User info received:', userInfo);
    
    // Check if user exists
    let user = await User.findOne({ email: userInfo.email });
    console.log('Existing user found:', !!user);
    
    if (!user) {
      // Create new user with Google info
      console.log('Creating new user...');
      user = new User({
        name: userInfo.name,
        email: userInfo.email,
        googleId: userInfo.googleId,
        role: 'student', // Default role
        isVerified: true
      });
      await user.save();
      console.log('New user created:', user._id);
    } else if (!user.googleId) {
      // Update existing user with Google ID
      console.log('Updating existing user with Google ID...');
      user.googleId = userInfo.googleId;
      await user.save();
      console.log('User updated with Google ID');
    }

    console.log('User role:', user.role);
    console.log('Setting session data...');

    // Set user session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    };

    console.log('Session data set:', req.session.user);

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error_msg', 'Session error');
        return res.redirect('/login');
      }

      console.log('Session saved successfully, redirecting to:', `/${user.role}/dashboard`);
      console.log('User session data:', req.session.user);
      req.flash('success_msg', 'Successfully logged in with Google');
      return res.redirect(`/${user.role}/dashboard`);
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    req.flash('error_msg', 'Error during Google authentication');
    res.redirect('/login');
  }
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view this resource');
  res.redirect('/');
};

// Student Signup
router.post('/signup/student', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, studentId, department } = req.body;
    
    // Validation
    if (!name || !email || !password || !confirmPassword || !studentId || !department) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/signup/student');
    }
    
    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/signup/student');
    }
    
    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/signup/student');
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'student',
      studentId,
      department
    });
    
    await newUser.save();
    
    req.flash('success_msg', 'You are now registered and can log in');
    res.redirect('/login/student');
    
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server Error');
    res.redirect('/signup/student');
  }
});

// Student Login
router.post('/login/student', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/login/student');
    }
    
    // Find student
    const user = await User.findOne({ email, role: 'student' });
    if (!user) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/login/student');
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/login/student');
    }
    
    // Set session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      department: user.department
    };

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error_msg', 'Session error');
        return res.redirect('/login/student');
      }

      res.redirect('/student/dashboard');
    });
    
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server Error');
    res.redirect('/login/student');
  }
});

// Driver Login
router.post('/login/driver', async (req, res) => {
  try {
    const { busId, pin } = req.body;
    
    // Validation
    if (!busId || !pin) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/login/driver');
    }
    
    // Find bus
    const bus = await Bus.findOne({ busId });
    if (!bus) {
      req.flash('error_msg', 'Invalid Bus ID or PIN');
      return res.redirect('/login/driver');
    }
    
    // Check PIN
    const isMatch = await bcrypt.compare(pin, bus.pin);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid Bus ID or PIN');
      return res.redirect('/login/driver');
    }
    
    // Set session
    req.session.user = {
      id: bus.driver, // Use the driver's user ID, not the bus ID
      busId: bus.busId,
      driverName: bus.driverName,
      route: bus.route,
      role: 'driver'
    };

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error_msg', 'Session error');
        return res.redirect('/login/driver');
      }

      res.redirect('/driver/dashboard');
    });
    
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server Error');
    res.redirect('/login/driver');
  }
});

// Management Login
router.post('/login/management', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/login/management');
    }
    
    // Static credentials check (can be moved to environment variables)
    const adminEmail = process.env.ADMIN_EMAIL || 'dms_admin@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'nikhil';
    
    if (email !== adminEmail || password !== adminPassword) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/login/management');
    }
    
    // Set session
    req.session.user = {
      name: 'Admin',
      email: email,
      role: 'management'
    };

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error_msg', 'Session error');
        return res.redirect('/login/management');
      }

      res.redirect('/management/dashboard');
    });
    
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server Error');
    res.redirect('/login/management');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router; 