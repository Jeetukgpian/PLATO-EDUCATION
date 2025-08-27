const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User ', required: true },
  code: { type: String, required: true },
  executionResult: { type: String, default: null },
  error: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

const Code = mongoose.model('Code', codeSchema);

module.exports = Code;