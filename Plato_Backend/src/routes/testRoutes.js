const express = require('express');
const router = express.Router();

// Test route to check if the server is running
router.get('/ping', (req, res) => {
    res.json({ message: 'Pong! The server is running.' });
});

// Test route to check if authentication is working
router.get('/status', (req, res) => {
    res.json({ message: 'All systems operational.' });
});

// Test route to check database connection
router.get('/db-status', async (req, res) => {
    try {
        const dbStatus = {
            connected: mongoose.connection.readyState === 1,
            state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
        };
        res.json({ message: 'Database connection status', dbStatus });
    } catch (error) {
        res.status(500).json({ message: 'Error checking database status', error: error.message });
    }
});

module.exports = router;