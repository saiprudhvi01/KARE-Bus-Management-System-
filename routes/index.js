const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
  // If user is already logged in, redirect to respective dashboard
  if (req.session.user) {
    const { role } = req.session.user;
    if (role === 'student') return res.redirect('/student/dashboard');
    if (role === 'driver') return res.redirect('/driver/dashboard');
    if (role === 'management') return res.redirect('/management/dashboard');
  }
  
  res.render('home', { 
    title: 'Bus Management System',
    welcomeMessage: 'Welcome to Bus Management System 🚌'
  });
});

// Login pages
router.get('/login', (req, res) => {
  // If user is already logged in, redirect to respective dashboard
  if (req.session.user) {
    const { role } = req.session.user;
    if (role === 'student') return res.redirect('/student/dashboard');
    if (role === 'driver') return res.redirect('/driver/dashboard');
    if (role === 'management') return res.redirect('/management/dashboard');
  }
  
  // Redirect to student login as default
  res.redirect('/login/student');
});

router.get('/login/student', (req, res) => {
  // If already logged in, redirect to respective dashboard
  if (req.session.user) {
    const { role } = req.session.user;
    if (role === 'student') return res.redirect('/student/dashboard');
    if (role === 'driver') return res.redirect('/driver/dashboard');
    if (role === 'management') return res.redirect('/management/dashboard');
  }
  
  res.render('login', { 
    title: 'Student Login',
    userType: 'student'
  });
});

router.get('/login/driver', (req, res) => {
  // If already logged in, redirect to respective dashboard
  if (req.session.user) {
    const { role } = req.session.user;
    if (role === 'student') return res.redirect('/student/dashboard');
    if (role === 'driver') return res.redirect('/driver/dashboard');
    if (role === 'management') return res.redirect('/management/dashboard');
  }
  
  res.render('login-driver', { 
    title: 'Driver Login',
    userType: 'driver'
  });
});

router.get('/login/management', (req, res) => {
  // If already logged in, redirect to respective dashboard
  if (req.session.user) {
    const { role } = req.session.user;
    if (role === 'student') return res.redirect('/student/dashboard');
    if (role === 'driver') return res.redirect('/driver/dashboard');
    if (role === 'management') return res.redirect('/management/dashboard');
  }
  
  res.render('login', { 
    title: 'Management Login',
    userType: 'management'
  });
});

// Signup pages
router.get('/signup/student', (req, res) => {
  // If already logged in as student, redirect to dashboard
  if (req.session.user && req.session.user.role === 'student') {
    return res.redirect('/student/dashboard');
  }
  
  // If logged in as management, logout and redirect to main home page
  if (req.session.user && req.session.user.role === 'management') {
    req.session.destroy();
    req.flash('success_msg', 'You have been logged out successfully.');
    return res.redirect('/');
  }
  
  res.render('signup', { 
    title: 'Student Signup',
    userType: 'student'
  });
});

router.get('/signup/driver', (req, res) => {
  res.render('signup', { 
    title: 'Driver Signup',
    userType: 'driver'
  });
});

router.get('/signup/management', (req, res) => {
  res.render('signup', { 
    title: 'Management Signup',
    userType: 'management'
  });
});

module.exports = router; 