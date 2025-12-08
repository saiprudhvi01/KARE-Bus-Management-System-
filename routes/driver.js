const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureDriver } = require('../config/auth');
const Bus = require('../models/Bus');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');
const BusRequest = require('../models/BusRequest');

// Driver Dashboard
router.get('/dashboard', ensureDriver, async (req, res) => {
  try {
    // Fetch bus data
    const bus = await Bus.findOne({ driver: req.session.user.id });
    
    // Get passenger count using the model method
    const passengerCount = bus ? await bus.getPassengerCount() : 0;
    
    // Get pending request count
    const pendingRequests = bus ? await BusRequest.countDocuments({
      bus: bus._id,
      status: 'pending'
    }) : 0;

    // Get feedback and complaints for this driver
    const [feedback, complaints] = await Promise.all([
      Feedback.find({ driverId: req.session.user.id }).sort({ createdAt: -1 }),
      Complaint.find({ driverId: req.session.user.id }).sort({ createdAt: -1 })
    ]);

    // Get unread feedback count
    const unreadFeedbackCount = feedback.filter(f => !f.readByDriver).length;
    
    // Get open complaints count
    const openComplaintsCount = complaints.filter(c => c.status === 'open').length;

    res.render('driver/dashboard', {
      title: 'Driver Dashboard',
      user: req.session.user,
      bus: bus ? {
        ...bus.toObject(),
        passengerCount, // Include the count in the bus object
        feedback: feedback, // Add standalone feedback to bus object
        complaints: complaints // Add complaints to bus object
      } : null,
      passengerCount,
      pendingRequests,
      feedback,
      complaints,
      unreadFeedbackCount,
      openComplaintsCount
    });
  } catch (err) {
    console.error('Error fetching bus data:', err);
    res.render('driver/dashboard', {
      title: 'Driver Dashboard',
      user: req.session.user,
      error_msg: 'Failed to load bus data',
      pendingRequests: 0,  // Add default value for error case
      passengerCount: 0,   // Add default value for error case
      bus: null,           // Add null bus for error case
      feedback: [],
      complaints: [],
      unreadFeedbackCount: 0,
      openComplaintsCount: 0
    });
  }
});

// Update Bus Location
router.get('/update-location', ensureDriver, async (req, res) => {
  try {
    // Get full bus data including location info
    const bus = await Bus.findById(req.session.user.busId);
    
    // Add bus data to user object so we can access it in the template
    const userData = { ...req.session.user, bus };
    
    res.render('driver/update-location', {
      title: 'Update Location',
      user: userData
    });
  } catch (err) {
    console.error('Error fetching bus data for location update:', err);
    res.render('driver/update-location', {
      title: 'Update Location',
      user: req.session.user,
      error_msg: 'Failed to load location data'
    });
  }
});

// Handle location update form submission
router.post('/update-location', ensureDriver, async (req, res) => {
  try {
    const { 
      currentLat, currentLon,
      boardingLat, boardingLon, boardingPointName,
      destinationLat, destinationLon, destinationPointName
    } = req.body;
    
    // Find the bus
    const bus = await Bus.findById(req.session.user.busId);
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/driver/dashboard');
    }
    
    // Update current coordinates if provided
    if (currentLat && currentLon) {
      bus.currentCoordinates = {
        lat: parseFloat(currentLat),
        lon: parseFloat(currentLon),
        lastUpdated: new Date()
      };
      
      // Also update the text-based location
      bus.currentLocation = 'Updated via map';
      
      // Add activity record
      bus.recentActivity.unshift({
        action: 'Location Updated',
        details: `Current location updated to coordinates (${currentLat}, ${currentLon})`,
        timestamp: new Date()
      });
    }
    
    // Update boarding point if provided
    if (boardingLat && boardingLon) {
      bus.boardingPoint = {
        name: boardingPointName || 'Boarding Point',
        lat: parseFloat(boardingLat),
        lon: parseFloat(boardingLon)
      };
    }
    
    // Update destination point if provided
    if (destinationLat && destinationLon) {
      bus.destinationPoint = {
        name: destinationPointName || 'Destination',
        lat: parseFloat(destinationLat),
        lon: parseFloat(destinationLon)
      };
    }
    
    // Keep only the 5 most recent activities
    if (bus.recentActivity.length > 5) {
      bus.recentActivity = bus.recentActivity.slice(0, 5);
    }
    
    await bus.save();
    req.flash('success_msg', 'Location data updated successfully');
    res.redirect('/driver/update-location');
  } catch (err) {
    console.error('Error updating location:', err);
    req.flash('error_msg', 'An error occurred while updating location data');
    res.redirect('/driver/update-location');
  }
});

// Driver Profile
router.get('/profile', ensureDriver, (req, res) => {
  res.render('driver/profile', {
    title: 'My Profile',
    user: req.session.user
  });
});

// View all feedback
router.get('/feedback', ensureDriver, async (req, res) => {
  try {
    // Find the bus assigned to this driver
    const bus = await Bus.findOne({ driver: req.session.user.id });

    let feedback = [];
    // Load all feedback records assigned to this driver
    feedback = await Feedback.find({ driverId: req.session.user.id }).sort({ createdAt: -1 });
    
    res.render('driver/feedback', {
      title: 'Student Feedback',
      user: req.session.user,
      feedback
    });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    req.flash('error_msg', 'Failed to load feedback');
    res.redirect('/driver/dashboard');
  }
});

// View complaints about this driver's buses
router.get('/complaints', ensureDriver, async (req, res) => {
  try {
    // Load all complaints assigned to this driver
    const complaints = await Complaint.find({ driverId: req.session.user.id }).sort({ createdAt: -1 });
    
    res.render('driver/complaints', {
      title: 'Student Complaints',
      user: req.session.user,
      complaints
    });
  } catch (err) {
    console.error('Error fetching complaints:', err);
    req.flash('error_msg', 'Failed to load complaints');
    res.redirect('/driver/dashboard');
  }
});

// Mark feedback as read
router.post('/feedback/mark-read/:id', ensureDriver, async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const driverId = req.session.user.id;
    
    // Find the feedback and verify it belongs to this driver
    const feedback = await Feedback.findOne({ _id: feedbackId, driverId });
    
    if (!feedback) {
      req.flash('error_msg', 'Feedback not found or not authorized');
      return res.redirect('/driver/feedback');
    }
    
    // Mark as read
    feedback.readByDriver = true;
    await feedback.save();
    
    req.flash('success_msg', 'Feedback marked as read');
    res.redirect('/driver/feedback');
  } catch (err) {
    console.error('Error marking feedback as read:', err);
    req.flash('error_msg', 'Failed to update feedback status');
    res.redirect('/driver/feedback');
  }
});

// Respond to feedback
router.post('/feedback/respond/:id', ensureDriver, async (req, res) => {
  try {
    const { response } = req.body;
    const feedbackId = req.params.id;
    const driverId = req.session.user.id;
    
    // Find the feedback and verify it belongs to this driver
    const feedback = await Feedback.findOne({ _id: feedbackId, driverId });
    
    if (!feedback) {
      req.flash('error_msg', 'Feedback not found or not authorized');
      return res.redirect('/driver/feedback');
    }
    
    // Add driver response
    feedback.driverResponse = response;
    feedback.status = 'responding';
    await feedback.save();
    
    req.flash('success_msg', 'Response sent successfully');
    res.redirect('/driver/feedback');
  } catch (err) {
    console.error('Error responding to feedback:', err);
    req.flash('error_msg', 'Failed to send response');
    res.redirect('/driver/feedback');
  }
});

// View pending bus requests
router.get('/pending-requests', ensureDriver, async (req, res) => {
  try {
    // Find all pending requests for buses driven by this driver
    const requests = await BusRequest.find({
      driver: req.session.user.id,
      status: 'pending'
    })
    .populate('student', 'name email studentId department')
    .populate('bus', 'busName busNumber')
    .sort({ createdAt: -1 });

    res.render('driver/pending-requests', {
      title: 'Pending Bus Requests',
      user: req.session.user,
      requests: requests
    });
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    req.flash('error_msg', 'Failed to load pending requests');
    res.redirect('/driver/dashboard');
  }
});

// View all passengers for driver's bus
router.get('/passengers', ensureDriver, async (req, res) => {
  try {
    // Find the bus assigned to this driver
    const bus = await Bus.findOne({ driver: req.session.user.id });
    
    if (!bus) {
      req.flash('error_msg', 'No bus assigned to you');
      return res.redirect('/driver/dashboard');
    }
    
    // Get passenger count using the model method
    const passengerCount = await bus.getPassengerCount();
    
    // Find all accepted bus requests for this bus
    const passengers = await BusRequest.find({
      bus: bus._id,
      status: 'accepted'
    }).populate('student', 'name email studentId');
    
    // Transform the data to match the template's expected format
    const formattedPassengers = passengers.map(passenger => ({
      _id: passenger._id,
      name: passenger.student?.name || 'Unknown',
      studentId: passenger.student?.studentId || 'N/A',
      boardingTime: passenger.createdAt,
      destination: passenger.destination || 'Main Campus'
    }));
    
    res.render('driver/passengers', {
      title: 'Passenger Management',
      user: req.session.user,
      passengers: formattedPassengers,
      bus: {
        ...bus.toObject(),
        busName: bus.name || bus.busName,
        busNumber: bus.busNumber,
        driverName: req.session.user.name,
        capacity: bus.capacity || 30, // Default capacity if not set
        passengerCount // Include the count in the bus object
      },
      currentTrip: {
        route: bus.route || 'Regular Route',
        nextStop: 'Next Stop: ' + (bus.nextStop || 'Not specified')
      }
    });
    
  } catch (error) {
    console.error('Error fetching passengers:', error);
    req.flash('error_msg', 'Error loading passenger list');
    res.redirect('/driver/dashboard');
  }
});

// Remove passenger from bus
router.post('/passengers/remove/:id', ensureDriver, async (req, res) => {
  try {
    const request = await BusRequest.findById(req.params.id).populate('bus');
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Passenger not found' });
    }
    
    // Check if the bus belongs to the current driver
    if (request.bus.driver.toString() !== req.session.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    // Instead of deleting, we'll update the status to 'cancelled' to keep history
    await BusRequest.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    
    // Get updated passenger count
    const passengerCount = await BusRequest.countDocuments({
      bus: request.bus._id,
      status: 'accepted'
    });
    
    res.json({ 
      success: true, 
      message: 'Passenger removed successfully',
      passengerCount
    });
    
  } catch (error) {
    console.error('Error removing passenger:', error);
    res.status(500).json({ success: false, message: 'Error removing passenger' });
  }
});

module.exports = router;
