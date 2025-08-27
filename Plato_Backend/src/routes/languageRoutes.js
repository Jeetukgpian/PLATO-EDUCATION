// src/routes/languageRoutes.js
const express = require('express');
const languageController = require('../controllers/languageController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/select', languageController.getTopicsByLanguage);
router.post('/update-topics', languageController.saveTopicsInUserProfile); // New route
router.post('/generate-course', languageController.generatePersonalizedCourse);

module.exports = router;
