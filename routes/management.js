const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { ensureAuthenticated, ensureManagement } = require('../config/auth');
const Bus = require('../models/Bus');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');

// Import any additional models if needed
// const Route = require('../models/Route');

// Management Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Fetch buses to display on map and dashboard
    const buses = await Bus.find({});
    
    // Fetch student count
    const studentCount = await User.countDocuments({ role: 'student' });
    
    // Collect unique routes
    const routes = [...new Set(buses.map(bus => bus.route))].filter(Boolean);
    
    // Create empty reports array (can be populated with real reports later)
    const reports = [];
    
    // Collect and process all feedback from both Bus model and standalone Feedback model
    let allFeedback = [];
    let studentComplaints = [];
    
    // Process feedback from standalone Feedback model
    const standaloneFeedback = await Feedback.find({}).sort({ createdAt: -1 });
    standaloneFeedback.forEach(item => {
      const feedbackItem = {
        ...item.toObject(),
        bus: {
          busId: item.busName || 'General',
          busName: item.busName || 'General Feedback',
          driverName: item.driverName || 'N/A',
          _id: item.busId
        }
      };
      
      // Separate into complaints (based on subject/content) and positive feedback
      if (item.subject && (item.subject.toLowerCase().includes('complaint') || 
          item.subject.toLowerCase().includes('issue') || 
          item.subject.toLowerCase().includes('problem'))) {
        studentComplaints.push(feedbackItem);
      } else {
        allFeedback.push(feedbackItem);
      }
    });
    
    // Process complaints from standalone Complaint model
    const standaloneComplaints = await Complaint.find({}).sort({ createdAt: -1 });
    standaloneComplaints.forEach(item => {
      const complaintItem = {
        ...item.toObject(),
        bus: {
          busId: item.busName || 'General',
          busName: item.busName || 'N/A',
          driverName: item.driverName || 'N/A',
          _id: item.busId
        }
      };
      
      studentComplaints.push(complaintItem);
    });
    
    // Process feedback embedded in Bus model (legacy)
    for (const bus of buses) {
      if (bus.feedback && bus.feedback.length > 0) {
        // Add bus info to each feedback item for context
        const busInfo = {
          busId: bus.busId,
          busName: bus.busName,
          driverName: bus.driverName,
          _id: bus._id
        };
        
        // Process each feedback item
        bus.feedback.forEach(item => {
          const feedbackWithBus = {
            ...item.toObject(),
            bus: busInfo
          };
          
          // Separate into complaints (rating ≤ 3) and positive feedback
          if (item.rating <= 3) {
            studentComplaints.push(feedbackWithBus);
          } else {
            allFeedback.push(feedbackWithBus);
          }
        });
      }
    }
    
    // Sort feedback by timestamp (newest first)
    allFeedback.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    studentComplaints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Render dashboard with data
    res.render('management/dashboard', { 
      title: 'Management Dashboard',
      buses,
      feedback: allFeedback,
      complaints: studentComplaints,
      studentCount,
      routes,
      reports,
      user: req.user
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.render('management/dashboard', { 
      title: 'Management Dashboard',
      error: 'Could not load dashboard data',
      user: req.user
    });
  }
});

// Manage Buses
router.get('/buses', ensureManagement, async (req, res) => {
  try {
    const buses = await Bus.find({}).sort({ createdAt: -1 });
    
    res.render('management/buses', {
      title: 'Manage Buses',
      user: req.session.user,
      buses
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to fetch buses');
    res.redirect('/management/dashboard');
  }
});

// Add New Bus Form
router.get('/buses/add', ensureManagement, (req, res) => {
  res.render('management/add-bus', {
    title: 'Add New Bus',
    user: req.session.user
  });
});

// Add New Bus
router.post('/buses/add', ensureManagement, async (req, res) => {
  try {
    const { 
      busName, busId, busNumber, plateNumber, driverName, 
      route, capacity, pin, confirmPin, currentLocation, 
      notes, isActive 
    } = req.body;
    
    // Validate input
    if (!busName || !busId || !busNumber || !plateNumber || !driverName || !route || !capacity || !pin) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/management/buses/add');
    }
    
    // Check if PIN and confirm PIN match
    if (pin !== confirmPin) {
      req.flash('error_msg', 'PINs do not match');
      return res.redirect('/management/buses/add');
    }
    
    // Check if bus ID already exists
    const existingBus = await Bus.findOne({ busId });
    if (existingBus) {
      req.flash('error_msg', 'Bus ID already exists. Please choose a different ID');
      return res.redirect('/management/buses/add');
    }
    
    // Hash the PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);
    
    // Create new bus
    const newBus = new Bus({
      busName,
      busId,
      busNumber,
      plateNumber,
      driverName,
      route,
      capacity: parseInt(capacity),
      pin: hashedPin,
      currentLocation: currentLocation || 'Not specified',
      notes: notes || '',
      isActive: isActive === 'on',
      // Add default schedule for weekdays
      schedule: [
        {
          time: '7:45 AM',
          departure: 'Bus Depot',
          arrival: 'Campus',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        },
        {
          time: '8:15 AM',
          departure: 'Campus',
          arrival: 'City Center',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        },
        {
          time: '1:00 PM',
          departure: 'City Center',
          arrival: 'Campus',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        },
        {
          time: '4:30 PM',
          departure: 'Campus',
          arrival: 'Bus Depot',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        }
      ],
      // Add initial activity
      recentActivity: [
        {
          action: 'Bus Added',
          details: 'Bus was added to the system',
          timestamp: new Date()
        }
      ]
    });
    
    await newBus.save();
    req.flash('success_msg', 'Bus added successfully');
    res.redirect('/management/buses');
  } catch (err) {
    console.error('Error adding bus:', err);
    req.flash('error_msg', 'An error occurred while adding the bus');
    res.redirect('/management/buses/add');
  }
});

router.get('/buses/view/:id', ensureManagement, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/management/buses');
    }
    
    res.render('management/view-bus', {
      user: req.session.user,
      page_title: 'View Bus Details',
      bus
    });
  } catch (err) {
    console.error('Error viewing bus:', err);
    req.flash('error_msg', 'An error occurred while retrieving bus details');
    res.redirect('/management/buses');
  }
});

router.get('/buses/edit/:id', ensureManagement, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      req.flash('error_msg', 'Bus not found');
      return res.redirect('/management/buses');
    }
    
    res.render('management/edit-bus', {
      user: req.session.user,
      page_title: 'Edit Bus',
      bus
    });
  } catch (err) {
    console.error('Error retrieving bus for edit:', err);
    req.flash('error_msg', 'An error occurred while retrieving bus details');
    res.redirect('/management/buses');
  }
});

// Update bus (using method-override for PUT)
router.put('/buses/update/:id', ensureManagement, async (req, res) => {
  try {
    const { 
      busName, busNumber, plateNumber, driverName, 
      route, capacity, currentLocation, 
      notes, isActive, currentPin, newPin, confirmNewPin,
      lastMaintenanceDate, nextMaintenanceDate, fuelStatus, engineHealth
    } = req.body;
    
    // Find the bus
    let bus;
    try {
      bus = await Bus.findById(req.params.id);
      if (!bus) {
        req.flash('error_msg', 'Bus not found');
        return res.redirect('/management/buses');
      }
    } catch (err) {
      console.error('Error finding bus:', err);
      req.flash('error_msg', 'Error finding bus');
      return res.redirect('/management/buses');
    }
    
    // Update bus data with validation
    try {
      bus.busName = busName || bus.busName;
      bus.busNumber = busNumber || bus.busNumber;
      bus.plateNumber = plateNumber || bus.plateNumber;
      bus.driverName = driverName || bus.driverName;
      bus.route = route || bus.route;
      bus.capacity = capacity ? parseInt(capacity) : bus.capacity;
      bus.currentLocation = currentLocation || bus.currentLocation || 'Not specified';
      bus.notes = notes || bus.notes || '';
      bus.isActive = isActive === 'on';
    } catch (err) {
      console.error('Error updating bus fields:', err);
      req.flash('error_msg', 'Error updating bus information');
      return res.redirect(`/management/buses/edit/${req.params.id}`);
    }
    
    // Update maintenance information
    if (lastMaintenanceDate) bus.lastMaintenanceDate = new Date(lastMaintenanceDate);
    if (nextMaintenanceDate) bus.nextMaintenanceDate = new Date(nextMaintenanceDate);
    if (fuelStatus) bus.fuelStatus = parseInt(fuelStatus);
    if (engineHealth) bus.engineHealth = parseInt(engineHealth);
    
    // If PIN change is requested
    if (currentPin && newPin && newPin === confirmNewPin) {
      // Verify current PIN
      const isMatch = await bcrypt.compare(currentPin, bus.pin);
      if (!isMatch) {
        req.flash('error_msg', 'Current PIN is incorrect');
        return res.redirect(`/management/buses/edit/${req.params.id}`);
      }
      
      // Check if new PIN and confirm PIN match
      if (newPin !== confirmNewPin) {
        req.flash('error_msg', 'New PINs do not match');
        return res.redirect(`/management/buses/edit/${req.params.id}`);
      }
      
      // Hash and save new PIN
      const salt = await bcrypt.genSalt(10);
      bus.pin = await bcrypt.hash(newPin, salt);
    }
    
    // Add recent activity for the edit
    bus.recentActivity.unshift({
      action: 'Bus Updated',
      details: 'Bus information was updated by management',
      timestamp: new Date()
    });
    
    // Keep only the 5 most recent activities
    if (bus.recentActivity.length > 5) {
      bus.recentActivity = bus.recentActivity.slice(0, 5);
    }
    
    try {
      await bus.save();
      req.flash('success_msg', 'Bus updated successfully');
      return res.redirect('/management/buses');
    } catch (err) {
      console.error('Error saving bus:', err);
      req.flash('error_msg', 'Error saving bus information');
      return res.redirect(`/management/buses/edit/${req.params.id}`);
    }
  } catch (err) {
    console.error('Error updating bus:', err);
    req.flash('error_msg', 'An error occurred while updating the bus');
    res.redirect(`/management/buses/edit/${req.params.id}`);
  }
});

router.post('/buses/delete/:id', ensureManagement, async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Bus deleted successfully');
    res.redirect('/management/buses');
  } catch (err) {
    console.error('Error deleting bus:', err);
    req.flash('error_msg', 'An error occurred while deleting the bus');
    res.redirect('/management/buses');
  }
});

// API route to get all buses (for AJAX/fetch calls)
router.get('/api/buses', ensureManagement, async (req, res) => {
  try {
    const buses = await Bus.find().sort({ createdAt: -1 });
    res.json(buses);
  } catch (err) {
    console.error('Error fetching buses:', err);
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
});

// Manage Students
router.get('/students', ensureManagement, async (req, res) => {
  try {
    // Get all students with their bus assignments
    const students = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $lookup: {
          from: 'buses',
          localField: 'assignedBus',
          foreignField: '_id',
          as: 'busInfo'
        }
      },
      { $unwind: { path: '$busInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          studentId: 1,
          department: 1,
          year: 1,
          busName: '$busInfo.busName',
          busNumber: '$busInfo.busNumber',
          assignedBus: 1,
          status: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    
    // Get all active buses for the assignment dropdown
    const buses = await Bus.find({ isActive: true }).select('_id busName busNumber');
    
    res.render('management/students', {
      title: 'Manage Students',
      user: req.session.user,
      students,
      buses,
      messages: {
        success: req.flash('success_msg'),
        error: req.flash('error_msg')
      }
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    req.flash('error_msg', 'Failed to fetch students');
    res.redirect('/management/dashboard');
  }
});

// Update student bus assignment
router.post('/students/assign-bus', ensureManagement, async (req, res) => {
  try {
    const { studentId, busId } = req.body;
    
    // Validate input
    if (!studentId || !busId) {
      req.flash('error_msg', 'Student ID and Bus ID are required');
      return res.redirect('/management/students');
    }
    
    // Update student's bus assignment
    await User.findByIdAndUpdate(studentId, { 
      assignedBus: busId,
      status: 'assigned'
    });
    
    req.flash('success_msg', 'Bus assigned to student successfully');
    res.redirect('/management/students');
    
  } catch (err) {
    console.error('Error assigning bus to student:', err);
    req.flash('error_msg', 'Failed to assign bus to student');
    res.redirect('/management/students');
  }
});

// View Feedback and Complaints
router.get('/feedback', ensureManagement, async (req, res) => {
  try {
    const [feedback, complaints] = await Promise.all([
      Feedback.find().sort({ createdAt: -1 }).populate('busId', 'busName busNumber'),
      Complaint.find().sort({ createdAt: -1 }).populate('busId', 'busName busNumber')
    ]);
    
    res.render('management/feedback', {
      title: 'Feedback & Complaints',
      user: req.session.user,
      feedback,
      complaints,
      messages: {
        success: req.flash('success_msg'),
        error: req.flash('error_msg')
      }
    });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    req.flash('error_msg', 'Failed to load feedback and complaints');
    res.redirect('/management/dashboard');
  }
});

// Update feedback status (delete when marked as resolved/read)
router.post('/feedback/update-status/:id', ensureManagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response } = req.body;
    
    // If status is being marked as resolved or read, delete the feedback
    if (status === 'resolved' || req.body.markAsRead) {
      await Feedback.findByIdAndDelete(id);
      req.flash('success_msg', 'Feedback marked as read and removed');
    } else {
      // Otherwise update the feedback
      await Feedback.findByIdAndUpdate(id, { 
        status: status || 'pending',
        adminResponse: response || '',
        respondedAt: new Date()
      });
      req.flash('success_msg', 'Complaint status updated successfully');
    }

    res.redirect('/management/feedback');
  } catch (err) {
    console.error('Error updating complaint:', err);
    req.flash('error_msg', 'Failed to update complaint');
    res.redirect('/management/feedback');
  }
});

// Reports
router.get('/reports', ensureManagement, (req, res) => {
  res.render('management/reports', {
    title: 'Reports',
    user: req.session.user
  });
});

// Mark feedback as read (and delete it)
router.post('/feedback/mark-read/:id', ensureManagement, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      req.flash('error_msg', 'Feedback not found');
      return res.redirect('/management/feedback');
    }
    
    // Delete the feedback when marked as read
    await Feedback.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Feedback marked as read and removed');
    res.redirect('/management/feedback');
  } catch (err) {
    console.error('Error marking feedback as read:', err);
    req.flash('error_msg', 'Failed to update feedback');
    res.redirect('/management/feedback');
  }
});

// Update complaint status (delete when marked as resolved)
router.post('/complaints/update-status/:id', ensureManagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response } = req.body;
    
    console.log('Complaint update - ID:', id, 'Status:', status, 'Response:', response);
    
    // If status is being marked as resolved or closed, delete the complaint
    if (status === 'resolved' || status === 'closed') {
      console.log('Deleting complaint with ID:', id);
      await Complaint.findByIdAndDelete(id);
      req.flash('success_msg', 'Complaint marked as resolved and removed');
    } else {
      // Otherwise update the complaint
      console.log('Updating complaint with ID:', id, 'to status:', status);
      await Complaint.findByIdAndUpdate(id, { 
        status: status || 'open',
        adminResponse: response || '',
        resolvedAt: status === 'resolved' ? new Date() : null
      });
      req.flash('success_msg', 'Complaint status updated successfully');
    }
    
    res.redirect('/management/feedback');
  } catch (err) {
    console.error('Error updating complaint:', err);
    req.flash('error_msg', 'Failed to update complaint');
    res.redirect('/management/feedback');
  }
});

// Mark complaint as read (and delete it)
router.post('/complaints/mark-read/:id', ensureManagement, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      req.flash('error_msg', 'Complaint not found');
      return res.redirect('/management/feedback');
    }
    
    // Delete the complaint when marked as read
    await Complaint.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Complaint marked as read and removed');
    res.redirect('/management/feedback');
  } catch (err) {
    console.error('Error marking complaint as read:', err);
    req.flash('error_msg', 'Failed to update complaint');
    res.redirect('/management/feedback');
  }
});

// Add route for marking complaint as resolved
router.post('/complaints/resolve/:busId/:feedbackId', async (req, res) => {
  try {
    const { busId, feedbackId } = req.params;
    
    // Find the bus
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    
    // Find the feedback in the array
    const feedbackIndex = bus.feedback.findIndex(
      item => item._id.toString() === feedbackId
    );
    
    if (feedbackIndex === -1) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    
    // Mark as resolved by adding a resolved flag
    bus.feedback[feedbackIndex].resolved = true;
    bus.feedback[feedbackIndex].resolvedAt = new Date();
    bus.feedback[feedbackIndex].resolvedBy = req.user.name;
    
    // Save the bus
    await bus.save();
    
    // If this is an AJAX request
    if (req.xhr) {
      return res.json({ success: true, message: 'Complaint marked as resolved' });
    }
    
    // For regular form submissions, redirect back to the dashboard with success message
    req.flash('success', 'Complaint marked as resolved.');
    res.redirect('/management/dashboard');
    
  } catch (err) {
    console.error('Error resolving complaint:', err);
    
    // If this is an AJAX request
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error resolving complaint' });
    }
    
    // For regular form submissions
    req.flash('error', 'Error resolving complaint.');
    res.redirect('/management/dashboard');
  }
});

// Routes Management
router.get('/routes', ensureManagement, async (req, res) => {
  try {
    // In a real app, you would fetch routes from the database
    // const routes = await Route.find({});
    
    // For now, we'll use sample data
    const routes = [];
    
    res.render('management/routes', {
      title: 'Manage Routes',
      routes: routes
    });
  } catch (err) {
    console.error('Error fetching routes:', err);
    req.flash('error_msg', 'Error loading routes');
    res.redirect('/management/dashboard');
  }
});

// Add a new route
router.post('/routes/add', ensureManagement, async (req, res) => {
  try {
    const { name, stops, isActive } = req.body;
    
    // In a real app, you would save this to the database
    // const newRoute = new Route({
    //   name,
    //   stops: Array.isArray(stops) ? stops : [stops],
    //   isActive: isActive === 'on',
    //   createdBy: req.user.id
    // });
    // await newRoute.save();
    
    req.flash('success_msg', 'Route added successfully');
    res.redirect('/management/routes');
  } catch (err) {
    console.error('Error adding route:', err);
    req.flash('error_msg', 'Error adding route');
    res.redirect('/management/routes');
  }
});

// View reports
router.get('/reports', ensureManagement, async (req, res) => {
  try {
    // Sample data for the reports page
    const summary = {
      activeBuses: 12,
      totalTrips: 245,
      maintenanceDue: 3,
      activeRoutes: 8
    };
    
    const stats = {
      busUtilization: 78,
      onTimePercentage: 92,
      fuelEfficiency: 8.5
    };
    
    const activities = [
      { 
        title: 'Bus 101 Maintenance', 
        description: 'Scheduled maintenance completed',
        timestamp: new Date(Date.now() - 3600000),
        user: 'John Doe'
      },
      { 
        title: 'New Bus Added', 
        description: 'New bus (ID: BUS105) added to the system',
        timestamp: new Date(Date.now() - 86400000),
        user: 'Admin User'
      }
    ];
    
    const alerts = [
      {
        title: 'Maintenance Required',
        message: 'Bus 102 is due for maintenance',
        severity: 'high',
        date: new Date(),
        bus: 'BUS102'
      }
    ];
    
    res.render('management/reports', {
      title: 'Reports & Analytics',
      summary,
      stats,
      activities,
      alerts
    });
  } catch (err) {
    console.error('Error loading reports:', err);
    req.flash('error_msg', 'Error loading reports');
    res.redirect('/management/dashboard');
  }
});

// Export reports
router.get('/reports/export', ensureManagement, async (req, res) => {
  try {
    const { format = 'pdf', startDate, endDate, reportType } = req.query;
    
    // In a real app, you would generate a report based on the parameters
    // and return it in the requested format (PDF, Excel, CSV, etc.)
    
    // For now, we'll just return a success message
    req.flash('success_msg', `Report exported successfully as ${format.toUpperCase()}`);
    res.redirect('/management/reports');
  } catch (err) {
    console.error('Error exporting report:', err);
    req.flash('error_msg', 'Error exporting report');
    res.redirect('/management/reports');
  }
});

module.exports = router; 