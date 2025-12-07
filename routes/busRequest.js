const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureStudent, ensureDriver, ensureStudentAPI, ensureDriverAPI } = require('../config/auth');
const BusRequest = require('../models/BusRequest');
const Bus = require('../models/Bus');
const User = require('../models/User');

// Student requests a bus
router.post('/request', ensureStudentAPI, async (req, res) => {
    try {
        const { busId, boardingStop, destination } = req.body;
        
        // Validate input
        if (!busId || !boardingStop || !destination) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        // Check if bus exists
        const bus = await Bus.findById(busId);
        if (!bus) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        // Check for existing pending request
        const existingRequest = await BusRequest.findOne({
            student: req.session.user.id,
            bus: busId,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({ 
                success: false, 
                message: 'You already have a pending request for this bus' 
            });
        }

        // Create new request
        const newRequest = new BusRequest({
            student: req.session.user.id,
            bus: busId,
            boardingStop,
            destination,
            driver: bus.driver // Assuming bus has a driver field
        });

        await newRequest.save();

        // Populate student details for the response
        await newRequest.populate('student', 'name email studentId');
        
        req.flash('success_msg', 'Bus request submitted successfully');
        res.redirect('/student/dashboard');

    } catch (error) {
        console.error('Error creating bus request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: error.message 
        });
    }
});

// Driver gets pending requests
router.get('/driver/requests', ensureDriverAPI, async (req, res) => {
    try {
        // Find all pending requests for buses driven by this driver
        const requests = await BusRequest.find({ 
            driver: req.session.user.id,
            status: 'pending' 
        })
        .populate('student', 'name email studentId department')
        .populate('bus', 'busName busNumber')
        .sort({ createdAt: -1 });

        res.json({ 
            success: true, 
            requests 
        });
    } catch (error) {
        console.error('Error fetching bus requests:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching requests',
            error: error.message 
        });
    }
});

// Driver accepts a request
router.post('/:requestId/accept', ensureDriverAPI, async (req, res) => {
    try {
        const request = await BusRequest.findById(req.params.requestId)
            .populate('student', 'name email studentId')
            .populate('bus', 'busName busNumber');

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Request not found' 
            });
        }

        // Check if the driver is authorized
        if (request.driver.toString() !== req.session.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to accept this request' 
            });
        }

        // Update request status
        request.status = 'accepted';
        request.responseTime = new Date();
        await request.save();

        // In a real app, you might want to send a notification to the student here

        res.json({ 
            success: true, 
            message: 'Request accepted',
            request
        });

    } catch (error) {
        console.error('Error accepting request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error accepting request',
            error: error.message 
        });
    }
});

// Driver rejects a request
router.post('/:requestId/reject', ensureDriverAPI, async (req, res) => {
    try {
        const request = await BusRequest.findById(req.params.requestId);

        if (!request) {
            return res.status(404).json({ 
                success: false, 
                message: 'Request not found' 
            });
        }

        // Check if the driver is authorized
        if (request.driver.toString() !== req.session.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to reject this request' 
            });
        }

        // Update request status
        request.status = 'rejected';
        request.responseTime = new Date();
        await request.save();

        // In a real app, you might want to send a notification to the student here

        res.json({ 
            success: true, 
            message: 'Request rejected',
            request
        });

    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error rejecting request',
            error: error.message 
        });
    }
});

// Get accepted passengers for a bus
router.get('/bus/:busId/passengers', ensureDriverAPI, async (req, res) => {
    try {
        const bus = await Bus.findById(req.params.busId);
        
        if (!bus) {
            return res.status(404).json({ 
                success: false, 
                message: 'Bus not found' 
            });
        }

        // Check if the current user is the driver of this bus
        if (bus.driver.toString() !== req.session.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to view passengers for this bus' 
            });
        }

        // Get all accepted requests for this bus
        const passengers = await BusRequest.find({
            bus: req.params.busId,
            status: 'accepted'
        })
        .populate('student', 'name email studentId department')
        .sort({ boardingStop: 1 });

        res.json({ 
            success: true, 
            passengers 
        });

    } catch (error) {
        console.error('Error fetching passengers:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching passengers',
            error: error.message 
        });
    }
});

// Add sample passengers (for testing)
router.post('/add-sample-passengers', ensureDriverAPI, async (req, res) => {
    try {
        const { busId } = req.body;
        
        // Check if bus exists
        const bus = await Bus.findById(busId);
        if (!bus) {
            return res.status(404).json({ 
                success: false, 
                message: 'Bus not found' 
            });
        }

        // Sample student data
        const sampleStudents = [
            { name: 'John Doe', studentId: 'S001', department: 'Computer Science' },
            { name: 'Jane Smith', studentId: 'S002', department: 'Electrical Engineering' },
            { name: 'Robert Johnson', studentId: 'S003', department: 'Mechanical Engineering' },
            { name: 'Emily Davis', studentId: 'S004', department: 'Civil Engineering' },
            { name: 'Michael Wilson', studentId: 'S005', department: 'Electronics' }
        ];

        // Create sample requests
        const sampleRequests = await Promise.all(sampleStudents.map(async (student, index) => {
            // Create or find student user
            let user = await User.findOne({ studentId: student.studentId });
            
            if (!user) {
                user = new User({
                    name: student.name,
                    email: `${student.studentId.toLowerCase()}@example.com`,
                    studentId: student.studentId,
                    department: student.department,
                    role: 'student',
                    password: 'password123' // In a real app, generate a secure password
                });
                await user.save();
            }

            // Create accepted request
            const request = new BusRequest({
                student: user._id,
                bus: busId,
                status: 'accepted',
                boardingStop: `Stop ${index + 1}`,
                destination: 'Main Campus',
                driver: bus.driver,
                responseTime: new Date()
            });
            
            await request.save();
            return request;
        }));

        res.json({ 
            success: true, 
            message: 'Sample passengers added successfully',
            count: sampleRequests.length
        });

    } catch (error) {
        console.error('Error adding sample passengers:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding sample passengers',
            error: error.message 
        });
    }
});

// Cancel a bus request (for students)
router.delete('/:requestId', ensureStudentAPI, async (req, res) => {
    try {
        const request = await BusRequest.findById(req.params.requestId);
        
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Ensure the request belongs to the current user
        if (request.student.toString() !== req.session.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to cancel this request' 
            });
        }

        // Only allow cancellation of pending requests
        if (request.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: 'Only pending requests can be cancelled' 
            });
        }

        // Remove the request
        await BusRequest.findByIdAndDelete(req.params.requestId);
        
        // Remove the request reference from the user's busRequests array
        await User.findByIdAndUpdate(req.session.user.id, {
            $pull: { busRequests: request._id }
        });

        res.json({ 
            success: true, 
            message: 'Bus request cancelled successfully' 
        });
    } catch (err) {
        console.error('Error cancelling bus request:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: err.message 
        });
    }
});

module.exports = router;
