// src/config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Await the connection to ensure it succeeds before logging
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // MongoDB connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB successfully connected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('MongoDB disconnected');
    });

    logger.info('Initial MongoDB connection established');
  } catch (error) {
    logger.error('MongoDB connection error during initial connection:', error);
    process.exit(1);
  }

  // Handle application termination
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
  });
};

module.exports = connectDB;
