const globalContext = require('../utils/globalContext');

class CacheManager {
  constructor() {
    this.conversationCache = new Map();
    this.CACHE_LIMIT = 50;
    this.CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours
    // Automatically start periodic cleanup on initialization
    this.startCacheCleanup();
  }

  logCacheSummary() {
    const summary = {};
    for (const key of this.conversationCache.keys()) {
      const [userId, subtopicId] = key.split('_',2);
      if (summary[userId]) {
        summary[userId].push(subtopicId);
      } else {
        summary[userId] = [subtopicId];
      }
    }
    console.log('Cache Summary:', Object.keys(summary).length, 'users:', summary);
  }

  // Initialize cache for a user with initial conversations
  initializeCache(userId, subtopicId, conversations) {
    const cachedConversations = conversations.slice(0, this.CACHE_LIMIT).map(conv => ({
      userMessage: conv.userMessage,
      aiResponse: conv.aiResponse,
      timestamp: conv.timestamp || new Date(),
      subtopicId: conv.subtopicId, // Add this new field
    }));
  
    this.conversationCache.set(`${userId}_${subtopicId}`, {
      conversations: cachedConversations,
      lastUpdated: Date.now(),
    });
    console.log(`Initialized cache for user "${userId}" with subtopic "${subtopicId}".`);
    this.logCacheSummary();
  }

  // Get the most recent 10 conversations for a user
  getConversations(userId, subtopicId) {
    const cachedData = this.conversationCache.get(`${userId}_${subtopicId}`);
    if (!cachedData) {  // Added check to prevent undefined errors
      return [];
    }
    const conversations = cachedData.conversations
      .slice(0, 15) // Take the newest 10 conversations
      .reverse(); // Reverse the order to make the most recent one last

    return conversations;
  }

  // Add a new conversation to the user's cache
  updateCache(userId, subtopicId, newConversation) {
    let cachedData = this.conversationCache.get(`${userId}_${subtopicId}`);

    if (!cachedData) {
      cachedData = { conversations: [], lastUpdated: Date.now() };
    }

    // Add the new conversation to the start
    cachedData.conversations.unshift({
      userMessage: newConversation.userMessage,
      aiResponse: newConversation.aiResponse,
      timestamp: new Date()
    });

    // Trim cache to the defined limit
    if (cachedData.conversations.length > this.CACHE_LIMIT) {
      cachedData.conversations = cachedData.conversations.slice(0, this.CACHE_LIMIT);
    }

    // Update last updated timestamp
    cachedData.lastUpdated = Date.now();

    // Save the updated cache
    this.conversationCache.set(`${userId}_${subtopicId}`, cachedData);
    console.log(`Updated cache for user "${userId}" with subtopic "${subtopicId}".`);
    this.logCacheSummary();
  }

  // Clear cache for a specific user
  clearCache(userId) {
    // Delete all entries with keys starting with the given userId
    for (const key of Array.from(this.conversationCache.keys())) {
      if (key.startsWith(`${userId}_`)) {
        this.conversationCache.delete(key);
      }
    }
    console.log(`Cleared cache for user "${userId}". Current cache size: ${this.conversationCache.size}`);
    this.logCacheSummary();
  }

  // Clear all expired caches
  clearExpiredCaches() {
    const now = Date.now();
    for (const [key, cachedData] of this.conversationCache.entries()) {
      if (now - cachedData.lastUpdated > this.CACHE_EXPIRY_TIME) {
        this.conversationCache.delete(key);
        console.log(`Cache cleared for expired key: "${key}". Current cache size: ${this.conversationCache.size}`);
      }
    }
    this.logCacheSummary();
  }

  // Start periodic cache cleanup
  startCacheCleanup() {
    setInterval(() => {
      this.clearExpiredCaches();
    }, this.CACHE_EXPIRY_TIME);
  }
}

module.exports = new CacheManager();
