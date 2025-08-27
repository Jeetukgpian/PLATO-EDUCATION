const express = require('express');
const router = express.Router();
const dsaPracticeController = require('../controllers/dsaPracticeController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all problem sets for a user
router.get('/allproblemsets', dsaPracticeController.getAllProblemSets);



module.exports = router;
