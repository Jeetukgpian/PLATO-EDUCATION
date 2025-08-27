// src/routes/chatRoutes.js
const express = require('express');
const chatController = require('../controllers/chatController');
const checkApiKey = require('../middleware/apiKeyCheck');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'Chat routes are working' });
});

router.post('/send', checkApiKey, chatController.sendChat);

// Fetch past conversations route
router.get('/past', chatController.getPastConversations);

module.exports = router;