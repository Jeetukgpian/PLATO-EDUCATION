// src/utils/geminiErrorHandler.js
const handleGeminiError = (error) => {
    if (error.response) {
      // The API request was made and the server responded with a status code
      // that falls out of the range of 2xx
      return `API Error: ${error.response.data.error.message}`;
    } else if (error.request) {
      // The request was made but no response was received
      return 'No response received from AI service';
    } else {
      // Something happened in setting up the request that triggered an Error
      return 'Error setting up AI request';
    }
  };
  
  module.exports = handleGeminiError;