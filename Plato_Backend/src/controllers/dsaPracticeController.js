const Chat = require('../models/chatModels');
const cacheManager = require('../services/cacheManager');
// ...existing code or imports...

exports.getAllProblemSets = async (req, res) => {
  try {
    const userId = req.userId;
    // Retrieve all chats for the user
    const chats = await Chat.find({ userId });
    const subtopicGroups = new Map();

    // Group chats by subtopicId if it contains both 'problemset' and 'DSA'
    chats.forEach(chat => {
      if (chat.subtopicId) {
        const parts = chat.subtopicId.split('_');
        if (parts.includes('problemset') && parts.includes('DSA')) {
          if (!subtopicGroups.has(chat.subtopicId)) {
            subtopicGroups.set(chat.subtopicId, []);
          }
          subtopicGroups.get(chat.subtopicId).push(chat);
        }
      }
    });

    const firstUserMessages = [];

    // For each subtopic group, sort by timestamp, get the first userMessage, and cache the group
    subtopicGroups.forEach((group, subtopicId) => {
      group.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      firstUserMessages.push(group[0].userMessage);
      cacheManager.initializeCache(userId, subtopicId, group);
    });

    res.json({ success: true, data: firstUserMessages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ...existing code...
