// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Import CORS
const app = require('./src/app');
const logger = require('./src/utils/logger');
const connectDB = require('./src/config/database');
const PORT = process.env.PORT || 5000;
const path = require('path');

// List of allowed origins
const allowedOrigins = [
  'https://plato-frontend-theta.vercel.app',
  'http://localhost:3000',
  ''
];

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true); // Allow the request
    } else {
      callback(new Error('Not allowed by CORS')); // Reject the request
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE, OPTIONS', // Allowed HTTP methods
  credentials: true, // Allow credentials (if needed)
};

// Use CORS middleware
app.use(cors(corsOptions));

app.use(express.static(path.join(__dirname, 'build')));

// Catch-all route to serve index.html for any undefined routes
app.use(express.static(path.join(__dirname, 'build')));

// Serve React's index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Connect to MongoDB first
connectDB()
    .then(() => {
        // Only start the server after successful DB connection
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        logger.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    });