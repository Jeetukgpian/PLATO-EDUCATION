// utils/keepAlive.js

/**
 * Utility for sending keep-alive packets to prevent Azure's 230-second timeout
 */

// Track active keep-alive intervals
const activeIntervals = new Map();

/**
 * Start sending keep-alive packets every 120 seconds (2 minutes)
 * @param {Response} res - Express response object
 * @param {string} id - Unique identifier for this keep-alive
 * @returns {number} - Interval ID for cleanup
 */
exports.startKeepAlive = (res, id) => {
  console.log(`Starting keep-alive for request ${id}`);
  
  // Send initial comment to establish connection
  res.write('{"keepAlive": true, "status": "processing", "message": "Starting generation..."}\n\n');
  
  // Set up interval to send keep-alive packets every 2 minutes (120000ms)
  // This is safely below the 230-second timeout
  const interval = setInterval(() => {
    try {
      // Send a JSON comment that won't affect the final parsing
      console.log(`Sending keep-alive packet for request ${id}`);
      res.write('{"keepAlive": true, "timestamp": ' + Date.now() + '}\n\n');
    } catch (error) {
      console.error(`Error sending keep-alive for ${id}:`, error);
      this.stopKeepAlive(interval);
    }
  }, 120000); // 2 minutes
  
  // Store in our tracking map
  activeIntervals.set(id, interval);
  
  return interval;
};

/**
 * Stop the keep-alive interval
 * @param {number} interval - The interval to clear
 */
exports.stopKeepAlive = (interval) => {
  if (interval) {
    clearInterval(interval);
    
    // Find and remove from our tracking
    for (const [id, activeInterval] of activeIntervals.entries()) {
      if (activeInterval === interval) {
        console.log(`Stopping keep-alive for request ${id}`);
        activeIntervals.delete(id);
        break;
      }
    }
  }
};
