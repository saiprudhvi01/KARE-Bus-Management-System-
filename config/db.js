const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection String:', process.env.MONGODB_URI ? 'Found' : 'Missing');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds timeout
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database Name: ${conn.connection.name}`);
    
    // Log when connected
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to DB');
    });

    // Log connection errors
    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });

    // Log disconnections
    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected');
    });
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
};

module.exports = connectDB; 