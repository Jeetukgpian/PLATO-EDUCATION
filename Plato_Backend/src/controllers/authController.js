const admin = require('../config/firebaseAdmin'); // Assuming the path is correct
const User = require('../models/userModel');
const Chat = require('../models/chatModels');
const jwt = require('jsonwebtoken');
const apiResponse = require('../utils/apiResponse');
const cacheManager = require('../services/cacheManager');
const defaultTopics = require('../models/topicModel');
const mongoose = require('mongoose');
const userGenAIManager = require('../services/userGenAIManager');


exports.login = async (req, res) => {
  try {
    // Extract the user data from the request body
    const {idToken }= req.body;
    const token = idToken;
    
    if (!token) {
      return res.status(400).json(apiResponse.error('Missing required field: token'));
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const userId = decodedToken.uid;
    const name = decodedToken.name;


 
    let responseMessage ='Login Success';
    let user = await User.findOne({ firebaseUserId: userId });
    if (!user) {
      // Create a new user if they don't exist
      user = new User({
        firebaseUserId: userId, // Use the Firebase user ID
        username: name, // Use name or email from token
        topics :[],
      });
      responseMessage = 'User registered';
      await user.save();
    }
    

    console.log("responseMessage",responseMessage);
    res.json(apiResponse.success(
      { userId: user._id, username: user.username, topics: user.topics },
      responseMessage
    ));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(apiResponse.error('Login failed', error.message));
  }
};

exports.logout = async (req, res) => {
  try {
    const firebaseUserId = req.userId;
    userGenAIManager.closeUserConnection(firebaseUserId);
    cacheManager.clearCache(firebaseUserId);
    const { alltopics } = req.body;
    const topics = alltopics;
    await User.findOneAndUpdate({ firebaseUserId }, { topics }, { new: true });
    
    res.json(apiResponse.success(null, 'Logged out successfully'));
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(apiResponse.error('Logout failed', error.message));
  }
};

// exports.getWelcomeMessage = (userId) => {
//   return welcomeMessages[userId] || "Welcome message not found.";
// };

const saveWelcomeChat = async (userId, message) => {
  const systemChat = new Chat({
    userId,
    userMessage: "", // Empty user message for the initial welcome
    aiResponse: message,
  });
  await systemChat.save();
};

// const generateWelcomeMessage = async (user) => {
//   const pastConversations = await Chat.find({ userId: user._id })
//     .sort({ timestamp: -1 })
//     .limit(10);

//   // Initialize cache with past conversations
//   cacheManager.initializeCache(user._id.toString(), pastConversations);

//   const genAIConnection = userGenAIManager.createUserConnection(
//     user._id.toString(),
//     process.env.GOOGLE_API_KEY,
//     []
//   );

//   if (pastConversations.length > 0) {
//     // Generate welcome message with context from past conversations
//     return await generateMessageWithContext(genAIConnection, pastConversations, user.username);
//   } else {
//     // Generate welcome message for new users
//     return await generateMessageForNewUser(genAIConnection, user.username);
//   }
// };

// const generateMessageWithContext = async (genAIConnection, pastConversations, username) => {
//   const chatHistory = pastConversations.map(conv => ([
//     { role: "user", parts: [{ text: conv.userMessage || "No user message" }] },
//     { role: "model", parts: [{ text: conv.aiResponse || "No AI response" }] }
//   ])).flat();

//   genAIConnection.chat = genAIConnection.model.startChat({ history: chatHistory });

//   const prompt = `
//     Follow system instruction while answering and keep chat context in mind.
//     Here are the last 5 conversations with the user:
//     ${pastConversations.map(conv => `User: ${conv.userMessage}\nAI: ${conv.aiResponse}`).join('\n')}
    
//     Create a personalized welcome message for the user "${username}".
//     Response format for teacher:
//     - Welcome back message.
//     - Conclude what the user learned in brief (based on syllabus progress).
//     - Give a challenge to recall learnings.
//   `;

//   const response = await genAIConnection.chat.sendMessage(prompt);
//   return response.response.text();
// };

// const generateMessageForNewUser = async (genAIConnection, username) => {
//   const prompt = `
//     Follow system instruction while answering.
//     Response format for teacher:
//     - Welcome message for new user.
//     - Start with the first topic of the syllabus and introduce it briefly.
//     - Give a challenge for the user to solve.

//     Username: "${username}"
//     Student prompt: "Hi, I am a beginner and want to learn JavaScript."
//   `;

//   const response = await genAIConnection.chat.sendMessage(prompt);
//   return response.response.text();
// };
