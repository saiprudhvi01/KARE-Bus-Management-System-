const mongoose = require('mongoose');

const BusRequestSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bus: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bus',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'boarded', 'cancelled'],
        default: 'pending'
    },
    boardingStop: {
        type: String,
        required: true
    },
    destination: {
        type: String,
        required: true
    },
    requestTime: {
        type: Date,
        default: Date.now
    },
    responseTime: {
        type: Date
    },
    boardedTime: {
        type: Date
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('BusRequest', BusRequestSchema);
