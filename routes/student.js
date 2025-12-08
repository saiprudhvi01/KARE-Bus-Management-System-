const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { ensureAuthenticated, ensureStudent } = require('../config/auth');
const Bus = require('../models/Bus');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');

// Student Dashboard
router.get('/dashboard', ensureStudent, async (req, res) => {
  try {
    // Fetch active buses with necessary fields for the dropdown
    const buses = await Bus.find({ isActive: true })
      .select('_id busName busNumber route isActive driverName')
      .sort({ busName: 1 })
      .lean();
    
    // Format buses for dropdown
    const formattedBuses = buses.map(bus => ({
      _id: bus._id,
      displayName: `${bus.busName} (${bus.busNumber}) - ${bus.route}${bus.driverName ? ` - ${bus.driverName}` : ''}`
    }));
    
    // Fetch today's day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = days[new Date().getDay()];
    
    // Filter buses with schedules for today
    const busesWithScheduleToday = buses.filter(bus => {
      if (!bus.schedule || bus.schedule.length === 0) return false;
      return bus.schedule.some(schedule => schedule.days && schedule.days.includes(today));
    });
    
    // Get user with populated bus assignment and request
    const user = await User.findById(req.session.user.id)
      .populate('assignedBus', 'busName busNumber route driverName')
      .populate({
        path: 'busRequests',
        match: { status: 'pending' },
        options: { sort: { requestedAt: -1 }, limit: 1 },
        populate: {
          path: 'bus',
          select: 'busName busNumber route'
        }
      });
    
    // Format user data for the view
    const userData = {
      ...user.toObject(),
      pendingBusRequest: user.busRequests && user.busRequests.length > 0 ? {
        _id: user.busRequests[0]._id,
        busName: user.busRequests[0].bus.busName,
        busNumber: user.busRequests[0].bus.busNumber,
        route: user.busRequests[0].bus.route,
        requestedAt: user.busRequests[0].requestedAt
      } : null
    };
    
    // Add formatted buses to the view data
    res.locals.busesForDropdown = formattedBuses;
    
    res.render('student/dashboard', {
      title: 'Student Dashboard',
      user: userData,
      buses: buses,  // This will be used in the feedback form
      busesCount: buses.length,
      busesWithScheduleToday: busesWithScheduleToday,  // For the bus schedule section
      currentDate: new Date().toISOString().split('T')[0]  // For any date-related functionality
    });
  } catch (err) {
    console.error('Error loading student dashboard:', err);
    res.render('student/dashboard', {
      title: 'Student Dashboard',
      user: req.session.user,
      error: 'Could not load dashboard data'
    });
  }
});

// List all available buses
router.get('/buses', ensureStudent, async (req, res) => {
  try {
    const buses = await Bus.find({ isActive: true }).lean();
    
    // Add passenger count to each bus
    const busesWithPassengerCount = buses.map(bus => ({
      ...bus,
      passengerCount: bus.passengers ? bus.passengers.length : 0
    }));
    
    res.render('student/buses', {
      title: 'Available Buses',
      user: req.session.user,
      buses: busesWithPassengerCount
    });
  } catch (err) {
    console.error('Error loading buses:', err);
    req.flash('error_msg', 'Failed to load buses');
    res.redirect('/student/dashboard');
  }
});

// View bus details
router.get('/bus/:id', ensureStudent, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id).lean();
    
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/student/buses');
    }
    
    res.render('student/bus-details', {
      title: `${bus.busName} Details`,
      user: req.session.user,
      bus: bus
    });
  } catch (err) {
    console.error('Error loading bus details:', err);
    req.flash('error_msg', 'Error loading bus details');
    res.redirect('/student/buses');
  }
});

// View Bus Schedule
router.get('/schedule', ensureStudent, async (req, res) => {
  try {
    // Fetch active buses with their schedules
    const buses = await Bus.find({ isActive: true });
    
    // Current day of the week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = days[new Date().getDay()];
    
    res.render('student/schedule', {
      title: 'Bus Schedule',
      user: req.session.user,
      buses: buses,
      today: today
    });
  } catch (err) {
    console.error('Error loading schedule:', err);
    req.flash('error_msg', 'Failed to load bus schedule');
    res.redirect('/student/dashboard');
  }
});

// Track Bus Location
router.get('/track/:busId?', ensureStudent, async (req, res) => {
  try {
    let selectedBus = null;
    const buses = await Bus.find({ isActive: true });
    
    // If busId is provided, find that specific bus
    if (req.params.busId) {
      selectedBus = await Bus.findOne({ busId: req.params.busId, isActive: true });
      if (!selectedBus) {
        req.flash('error_msg', 'Bus not found or not active');
        return res.redirect('/student/buses');
      }
    }
    
    res.render('student/track', {
      title: 'Track Bus',
      user: req.session.user,
      buses: buses,
      selectedBus: selectedBus
    });
  } catch (err) {
    console.error('Error tracking bus:', err);
    req.flash('error_msg', 'Failed to load tracking data');
    res.redirect('/student/buses');
  }
});

// Submit feedback for a bus
router.post('/feedback/:busId', ensureStudent, async (req, res) => {
  try {
    const { rating, message } = req.body;
    const { busId } = req.params;
    
    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      req.flash('error_msg', 'Please provide a valid rating between 1 and 5');
      return res.redirect(`/student/track/${busId}`);
    }
    
    // Find the bus
    const bus = await Bus.findOne({ busId });
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/student/buses');
    }
    
    // Add feedback to the bus
    bus.feedback.unshift({
      studentId: req.session.user.id,
      studentName: req.session.user.name,
      message: message || '',
      rating: parseInt(rating),
      timestamp: new Date(),
      isRead: false
    });
    
    await bus.save();
    
    req.flash('success_msg', 'Thank you for your feedback!');
    res.redirect(`/student/track/${busId}`);
  } catch (err) {
    console.error('Error submitting feedback:', err);
    req.flash('error_msg', 'Failed to submit feedback');
    res.redirect('/student/buses');
  }
});

// Student Profile
router.get('/profile', ensureStudent, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/student/dashboard');
    }
    
    const success_msg = req.flash('success_msg');
    
    res.render('student/profile', {
      title: 'My Profile',
      user: user,
      success_msg: success_msg.length > 0 ? success_msg[0] : ''
    });
  } catch (err) {
    console.error('Error loading profile:', err);
    req.flash('error_msg', 'Failed to load profile');
    res.redirect('/student/dashboard');
  }
});

// Edit Profile Page
router.get('/profile/edit', ensureStudent, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/student/dashboard');
    }
    
    const success_msg = req.flash('success_msg');
    const error_msg = req.flash('error_msg');
    
    res.render('student/edit-profile', {
      title: 'Edit Profile',
      user: user,
      success_msg: success_msg.length > 0 ? success_msg[0] : '',
      error_msg: error_msg.length > 0 ? error_msg[0] : ''
    });
  } catch (err) {
    console.error('Error loading edit profile:', err);
    req.flash('error_msg', 'Failed to load edit profile');
    res.redirect('/student/profile');
  }
});

// Update Profile
router.post('/profile/update', ensureStudent, async (req, res) => {
  try {
    const { name, studentId, department, currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.id;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/student/profile');
    }
    
    // Update basic info
    user.name = name || user.name;
    
    if (user.role === 'student') {
      user.studentId = studentId || user.studentId;
      user.department = department || user.department;
    }
    
    // Handle password change if requested
    if (newPassword) {
      if (!currentPassword) {
        req.flash('error_msg', 'Current password is required to change password');
        return res.redirect('/student/profile/edit');
      }
      
      if (newPassword !== confirmPassword) {
        req.flash('error_msg', 'New password and confirm password do not match');
        return res.redirect('/student/profile/edit');
      }
      
      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        req.flash('error_msg', 'Current password is incorrect');
        return res.redirect('/student/profile/edit');
      }
      
      // Hash and set new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }
    
    await user.save();
    
    // Update session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    };
    
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/student/profile');
    
  } catch (err) {
    console.error('Error updating profile:', err);
    req.flash('error_msg', 'Failed to update profile');
    res.redirect('/student/profile/edit');
  }
});

// API endpoint to get bus location
router.get('/api/bus-location/:busId', ensureStudent, async (req, res) => {
  try {
    const bus = await Bus.findOne({ busId: req.params.busId });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    
    res.json({
      success: true,
      busId: bus.busId,
      busName: bus.busName,
      currentLocation: bus.currentLocation,
      coordinates: bus.currentCoordinates,
      boardingPoint: bus.boardingPoint,
      destinationPoint: bus.destinationPoint,
      lastUpdated: bus.currentCoordinates.lastUpdated
    });
  } catch (err) {
    console.error('Error fetching bus location:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send feedback to driver and admin
router.post('/send-feedback', ensureStudent, async (req, res) => {
  try {
    const { busId, subject, message, isAnonymous } = req.body;
    const wantsJson = req.accepts(['json', 'html']) === 'json';
    
    // Input validation
    if (!subject || !message) {
      const errorMessage = 'Subject and message are required';
      if (wantsJson) {
        return res.status(400).json({ success: false, message: errorMessage });
      }
      req.flash('error_msg', errorMessage);
      return res.redirect('back');
    }
    
    // Create new feedback document with minimal required fields
    const feedback = new Feedback({
      subject,
      message,
      studentId: req.session.user._id,
      studentName: isAnonymous ? 'Anonymous Student' : req.session.user.name,
      isAnonymous: !!isAnonymous,
      status: 'pending',
      busId: null,
      busName: 'General Feedback',
      busNumber: 'N/A',
      driverId: null,
      driverName: 'N/A',
      createdAt: new Date()
    });

    // If busId is provided, populate bus and driver info
    if (busId) {
      const bus = await Bus.findById(busId);
      if (bus) {
        feedback.busId = bus._id;
        feedback.busName = bus.name || bus.busName;
        feedback.busNumber = bus.busNumber;
        feedback.driverId = bus.driverId || bus._id;
        feedback.driverName = bus.driverName || 'Unknown Driver';
      }
    }
    
    await feedback.save();
    
    const successMessage = 'Thank you for your feedback! It has been submitted successfully.';
    if (wantsJson) {
      return res.json({ success: true, message: successMessage });
    }
    
    req.flash('success_msg', successMessage);
    return res.redirect('back');
    
  } catch (error) {
    console.error('Error sending feedback:', error);
    const errorMessage = 'Failed to submit feedback. Please try again.';
    if (req.accepts(['json', 'html']) === 'json') {
      return res.status(500).json({ success: false, message: errorMessage });
    }
    req.flash('error_msg', errorMessage);
    return res.redirect('back');
  }
});

// Send complaint to admin
router.post('/send-complaint', ensureStudent, async (req, res) => {
  try {
    const { busId, type, subject, message, severity, isAnonymous } = req.body;
    const wantsJson = req.accepts(['json', 'html']) === 'json';
    
    // Input validation
    if (!subject || !message) {
      const errorMessage = 'Subject and message are required';
      if (wantsJson) {
        return res.status(400).json({ success: false, message: errorMessage });
      }
      req.flash('error_msg', errorMessage);
      return res.redirect('back');
    }
    
    // Create new complaint document with minimal required fields
    const complaint = new Complaint({
      type: type || 'general',
      subject,
      message,
      severity: severity || 'medium',
      studentId: req.session.user._id,
      studentName: isAnonymous ? 'Anonymous Student' : req.session.user.name,
      isAnonymous: !!isAnonymous,
      status: 'pending',
      createdAt: new Date(),
      busId: null,
      busName: 'N/A',
      busNumber: 'N/A',
      driverId: null,
      driverName: 'N/A'
    });

    // If busId is provided, populate bus and driver info
    if (busId) {
      const bus = await Bus.findById(busId);
      if (bus) {
        complaint.busId = bus._id;
        complaint.busName = bus.name || bus.busName;
        complaint.busNumber = bus.busNumber;
        complaint.driverId = bus.driverId || bus._id;
        complaint.driverName = bus.driverName || 'Unknown Driver';
      }
    }
    
    await complaint.save();
    
    const successMessage = 'Your complaint has been submitted successfully. We will review it shortly.';
    if (wantsJson) {
      return res.json({ success: true, message: successMessage });
    }
    
    req.flash('success_msg', successMessage);
    return res.redirect('back');
    
  } catch (error) {
    console.error('Error sending complaint:', error);
    const errorMessage = 'Failed to submit complaint. Please try again.';
    if (req.accepts(['json', 'html']) === 'json') {
      return res.status(500).json({ success: false, message: errorMessage });
    }
    req.flash('error_msg', errorMessage);
    return res.redirect('back');
  }
});

// API endpoint to get all bus locations for map
router.get('/api/all-bus-locations', ensureStudent, async (req, res) => {
  try {
    const buses = await Bus.find({ isActive: true });
    const busLocations = buses.map(bus => ({
      _id: bus._id,
      busId: bus.busId,
      busName: bus.busName || bus.name,
      busNumber: bus.busNumber,
      route: bus.route,
      isActive: bus.isActive,
      currentLocation: bus.currentLocation,
      coordinates: bus.currentCoordinates,
      lastUpdated: bus.currentCoordinates?.lastUpdated || new Date()
    }));
    
    res.json({
      success: true,
      buses: busLocations
    });
  } catch (err) {
    console.error('Error fetching bus locations:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 