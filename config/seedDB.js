const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Bus = require('../models/Bus');
const User = require('../models/User');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('MongoDB Connected for seeding...');

    // Clear existing data
    await Bus.deleteMany({});
    await User.deleteMany({});

    console.log('Creating 6 buses with specific routes...');

    // Bus data
    const busesData = [
      {
        busName: '8th Block Express',
        busId: 'KBUS001',
        busNumber: 'TN67AB1001',
        plateNumber: 'TN67AB1001',
        driverName: 'Rajesh Kumar',
        route: '8th Block → Ladies Hostel',
        capacity: 50,
        pin: '1111',
        isActive: true,
        currentLocation: '8th Block',
        schedule: [
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '07:30 AM',
            departure: '8th Block',
            arrival: 'Ladies Hostel',
            duration: '15 mins'
          },
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '06:00 PM',
            departure: 'Ladies Hostel',
            arrival: '8th Block',
            duration: '15 mins'
          }
        ]
      },
      {
        busName: 'Boys Hostel Shuttle',
        busId: 'KBUS002',
        busNumber: 'TN67AB1002',
        plateNumber: 'TN67AB1002',
        driverName: 'Suresh Reddy',
        route: 'Boys Hostel → Main Gate',
        capacity: 45,
        pin: '2222',
        isActive: true,
        currentLocation: 'Boys Hostel',
        schedule: [
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '08:00 AM',
            departure: 'Boys Hostel',
            arrival: 'Main Gate',
            duration: '10 mins'
          },
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '05:30 PM',
            departure: 'Main Gate',
            arrival: 'Boys Hostel',
            duration: '10 mins'
          }
        ]
      },
      {
        busName: 'Main Gate Express',
        busId: 'KBUS003',
        busNumber: 'TN67AB1003',
        plateNumber: 'TN67AB1003',
        driverName: 'Kumar Swami',
        route: 'Main Gate → Hostel',
        capacity: 50,
        pin: '3333',
        isActive: true,
        currentLocation: 'Main Gate',
        schedule: [
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '08:15 AM',
            departure: 'Main Gate',
            arrival: 'Hostel Complex',
            duration: '12 mins'
          },
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '05:45 PM',
            departure: 'Hostel Complex',
            arrival: 'Main Gate',
            duration: '12 mins'
          }
        ]
      },
      {
        busName: 'Ladies Hostel Express',
        busId: 'KBUS004',
        busNumber: 'TN67AB1004',
        plateNumber: 'TN67AB1004',
        driverName: 'Priya Devi',
        route: 'Ladies Hostel → 8th Block',
        capacity: 45,
        pin: '4444',
        isActive: true,
        currentLocation: 'Ladies Hostel',
        schedule: [
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '07:45 AM',
            departure: 'Ladies Hostel',
            arrival: '8th Block',
            duration: '15 mins'
          },
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            time: '06:15 PM',
            departure: '8th Block',
            arrival: 'Ladies Hostel',
            duration: '15 mins'
          }
        ]
      },
      {
        busName: 'VIP Express Madurai',
        busId: 'KBUS005',
        busNumber: 'TN67AB1005',
        plateNumber: 'TN67AB1005',
        driverName: 'Venkatesh Iyer',
        route: 'Madurai → Kalasalingam University',
        capacity: 35,
        pin: '5555',
        isActive: true,
        currentLocation: 'Madurai',
        schedule: [
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            time: '06:30 AM',
            departure: 'Madurai Central',
            arrival: 'Kalasalingam University',
            duration: '2 hours 30 mins'
          },
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            time: '07:00 PM',
            departure: 'Kalasalingam University',
            arrival: 'Madurai Central',
            duration: '2 hours 30 mins'
          }
        ]
      },
      {
        busName: 'VIP Express University',
        busId: 'KBUS006',
        busNumber: 'TN67AB1006',
        plateNumber: 'TN67AB1006',
        driverName: 'Arjun Patel',
        route: 'Kalasalingam University → Madurai',
        capacity: 35,
        pin: '6666',
        isActive: true,
        currentLocation: 'Kalasalingam University',
        schedule: [
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            time: '06:45 AM',
            departure: 'Kalasalingam University',
            arrival: 'Madurai Central',
            duration: '2 hours 30 mins'
          },
          {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            time: '07:15 PM',
            departure: 'Madurai Central',
            arrival: 'Kalasalingam University',
            duration: '2 hours 30 mins'
          }
        ]
      }
    ];

    // Create buses and their drivers
    for (const busData of busesData) {
      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(busData.pin, salt);

      // Create driver user
      const driverUser = new User({
        name: busData.driverName,
        email: `${busData.busId.toLowerCase()}@kalasalingam.ac.in`,
        password: hashedPin,
        role: 'driver',
        isVerified: true,
        phone: `+91-${Math.floor(Math.random() * 9000000000) + 1000000000}`
      });

      const savedDriver = await driverUser.save();

      // Create bus
      const bus = new Bus({
        busName: busData.busName,
        busId: busData.busId,
        busNumber: busData.busNumber,
        plateNumber: busData.plateNumber,
        driverName: busData.driverName,
        route: busData.route,
        capacity: busData.capacity,
        driver: savedDriver._id,
        pin: hashedPin,
        isActive: busData.isActive,
        currentLocation: busData.currentLocation,
        schedule: busData.schedule
      });

      await bus.save();
      console.log(`✅ Created Bus: ${busData.busName} (${busData.busId})`);
      console.log(`   Driver: ${busData.driverName} (${busData.busId.toLowerCase()}@kalasalingam.ac.in)`);
      console.log(`   PIN: ${busData.pin}`);
      console.log(`   Route: ${busData.route}`);
      console.log('');
    }

    // Create management user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    const managementUser = new User({
      name: 'University Admin',
      email: 'admin@kalasalingam.ac.in',
      password: hashedPassword,
      role: 'management',
      isVerified: true
    });

    await managementUser.save();

    console.log('🎉 Database seeded successfully with 6 buses!');
    console.log('\n📋 Bus Details:');
    busesData.forEach((bus, index) => {
      console.log(`${index + 1}. ${bus.busName} (${bus.busId})`);
      console.log(`   Route: ${bus.route}`);
      console.log(`   Driver: ${bus.driverName}`);
      console.log(`   PIN: ${bus.pin}`);
      console.log('');
    });

    console.log('🔐 Management Login:');
    console.log('Email: admin@kalasalingam.ac.in');
    console.log('Password: admin123');

    process.exit();

  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
};

seedDatabase(); 