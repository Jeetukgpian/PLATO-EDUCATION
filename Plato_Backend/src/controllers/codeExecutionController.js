// src/controllers/codeExecutionController.js

const apiResponse = require('../utils/apiResponse');
const codeExecutionService = require('../services/codeExecutionService');
const Code = require('../models/codeModel');

exports.executeCode = async (req, res, next) => {
  try {
    const { code, input, language } = req.body; // Language is required now
    const userId = req.userId;

    if (!language) {
      return res.status(400).json(apiResponse.error('Language parameter is required'));
    }

    const formattedCode = code.split('\r\n').map(line => line.trim()).filter(line => line).join('\n');
    
    try {
      const executionResult = await codeExecutionService.execute(code, language, input);
      res.json(apiResponse.success({ 
        output: executionResult.output,
        executionSuccess: true
      }));

      const newCodeEntry = new Code({
        userId,
        code: formattedCode,
        executionResult: executionResult.output,
        error: null
      });

      await newCodeEntry.save(); 

    } catch (executionError) {
      res.json(apiResponse.success({ 
        output: executionError.message,
        executionSuccess: false
      }));
      const newCodeEntry = new Code({
        userId,
        code: formattedCode,
        executionResult: null,
        error: executionError.message
      });

      await newCodeEntry.save(); 
    }

  } catch (error) {
    console.error('Code Execution Error:', error);
    res.status(500).json(apiResponse.error('Internal server error'));
  }
};