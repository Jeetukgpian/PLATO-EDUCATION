// src/middleware/apiKeyCheck.js
const apiResponse = require('../utils/apiResponse');

const checkApiKey = (req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json(apiResponse.error('API key not configured'));
  }
  next();
};

module.exports = checkApiKey;