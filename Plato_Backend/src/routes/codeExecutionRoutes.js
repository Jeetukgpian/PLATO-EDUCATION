const express = require('express');
const codeExecutionController = require('../controllers/codeExecutionController');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware



const router = express.Router();
router.use(authMiddleware); 

router.post('/execute', codeExecutionController.executeCode);

module.exports = router;
