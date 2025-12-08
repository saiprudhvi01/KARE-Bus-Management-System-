const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require('cors');

const connectDB = require('./config/db');
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(cookieParser());

// Express Session
app.use(session({
  secret: 'bus_management_secret',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// Connect Flash
app.use(flash());

// Enable CORS for API routes
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Global Variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// EJS Layout Setup
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const studentRouter = require('./routes/student');
const driverRouter = require('./routes/driver');
const managementRouter = require('./routes/management');
const busRequestRouter = require('./routes/busRequest');

app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/student', studentRouter);
app.use('/driver', driverRouter);
app.use('/management', managementRouter);
app.use('/api/bus-requests', busRequestRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 