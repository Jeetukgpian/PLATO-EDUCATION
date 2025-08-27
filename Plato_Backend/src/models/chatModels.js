// src/models/chatModel.js
const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User ', required: true },
  subtopicId: { type: String}, // Add this new field
  userMessage: { type: String, default :null },
  aiResponse: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;