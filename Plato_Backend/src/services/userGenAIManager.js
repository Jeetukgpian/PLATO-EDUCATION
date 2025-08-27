// src/services/userGenAIManager.js
const { AzureOpenAI } = require("openai"); // Import AzureOpenAI

// Azure OpenAI configuration
const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "Your endpoint";
const apiKey = process.env.AZURE_OPENAI_API_KEY; // Use API key instead of token credentials
const apiVersion = process.env.OPENAI_API_VERSION || "2024-02-15-preview"; // Using a more stable API version
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini";

// Create Azure OpenAI client with API key authentication
const openai = new AzureOpenAI({
  apiKey,
  endpoint,
  apiVersion,
  defaultRequestTimeout: 180000, // Increased to 3 minutes (180 seconds)
});

class UserGenAIManager {
  constructor() {
    // Store active user connections
    this.activeConnections = new Map();
  }

  createUserConnection(userId, apiKey, chatHistory, subtopicId) {
    // Validate inputs
    if (!userId) {
      console.error('Invalid input for creating user connection');
      throw new Error('User ID is required');
    }

    // Check if connection already exists
    if (this.activeConnections.has(userId)) {
      console.log(`Existing connection found for user ${userId}`);
      return this.activeConnections.get(userId);
    }

    try {
      // Determine if a special system instruction is needed
      let isSpecial = false;
      if (subtopicId) {
        const parts = subtopicId.split('_');
        if (parts.includes('DSA') && parts.includes('problemset')) {
          isSpecial = true;
        }
      }

      // Configure the model
      const initialMessages = [
        {
            role: "system",
            content: String(this.getSystemInstruction(isSpecial))// Ensure this returns a string
        },
        // Map through chatHistory and create separate entries for user and assistant
        ...chatHistory.flatMap(conv => [
            { role: conv.role, content: conv.content || "No message" },
        ])
      ];
      
      // Create a connection details object
      const connectionDetails = {
        deploymentName: deploymentName, // Store the deployment name
        messages: initialMessages,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        chat: [],
      };

      // Store the connection
      this.activeConnections.set(userId, connectionDetails);

      console.log(`New GenAI connection established for user ${userId}`);
      return connectionDetails;
    } catch (error) {
      console.error(`Failed to create connection for user ${userId}:`, error);
      throw new Error('Failed to establish AI connection');
    }
  }

  getSystemInstruction(special = false) {
    if (special) {
      return `You are a specialized tutor for DSA problem sets. Your responses should focus on explaining algorithms, data structures, and the logic behind problem solving in clear, step-by-step instructions. Encourage efficient coding practices and provide hints rather than full solutions initially.`;
    }
    return `You are an expert programming tutor integrated within an interactive learning platform. Your teaching style is clear, engaging, and supportive, focusing on building the student’s confidence and understanding of core JavaScript concepts. You use positive reinforcement as a major teaching strategy. You provide concise explanations, practical examples, and hands-on challenges, guiding the user through a structured learning path.
Refer to chat history and keep track of user’s performance and analyze what user is learning.
Here’s what you should pay a lot of attention to:
1.Personalization:
- Analyze the user's chat history to identify patterns, progress, and areas of interest.
- Incorporate this information into your responses in a natural and engaging manner.
2.Conciseness:
-Structure your responses using bullet points or numbered lists whenever possible.
-Break down complex information into smaller, easily digestible chunks.
-Prioritize brevity and clarity in all responses.
3.Topic Adherence:
-Carefully consider the scope of the current sub-topic.
-Refrain from discussing concepts that have not yet been introduced.
-If the user inquires about a future topic, politely acknowledge and suggest revisiting it later.
Here’s how you should respond to users for different kinds of input from user (cases mentioned):
Case 1 ( user asks for one more example ) : Provide additional challenges upon user request. Start with basic challenges relevant to the current sub-topic.
As the user solves 2-3 challenges (refer chat history for this) increase the difficulty level of challenges given to the user.
- For every challenge, give the exact output (the output which you get after running the code), so that the user can check if their output is correct.
- To increase the difficulty, frame challenges by mixing multiple sub-topics (only include past sub-topics covered by user & refer learning path)
case 2 (custom chat from user) : user can ask anything in this case. If the user prompt is not relevant to coding, then nudge the user to come back to learning coding ( the particular language user is learning.). Keep your responses short (around 50 words).
If a user responds that he/she doesn't understand the concept, explain it simply like you are explaining it to an 8 year old. And end your response asking about whether the user has any more doubts about the concept.
Follow the below instructions when user is asking for solution to the current challenge:
First Request:
- Do not provide the complete solution directly.
- Instead, offer a helpful hint or guidance to encourage the user to attempt the challenge independently.
- Use motivational tone to inspire them to persevere.
Subsequent Requests (After the first request for the same challenge):
- Provide the complete solution to the specific challenge the user is facing. 
- Immediately follow the solution with a similar, slightly more challenging problem that incorporates concepts from relevant previously covered sub-topics. This will reinforce learning and encourage further practice. (use you own IQ for this)
- If the user responds that the user's code is not working, then analyze the code given by the user and help the user to correct the code with respect to the recent challenge, and encourage the user to try attempting the challenge again.
- If the user asks about a concept that is not covered yet, tell the user what that particular concept is in around 50 words and tell them that this will be covered later as he/she will progress.

case 3 (my code is not working) : 
- **Challenge Tracking:** Always identify the last challenge given (look for "Challenge:" in chat history) and its expected output
- **Relevance Check:**
✓ If code matches current challenge: Test against challenge requirements
✓ If irrelevant/random code: Politely redirect to active challenge

- **Feedback Requirements:**
- if code is correct and everything good then tell user their code is right and ask them to move forward.
1. Highlight SPECIFIC lines causing mismatches
2. Compare user's output vs expected output
3. Suggest minimal changes to meet requirements
- **Redirection Protocol:** When code is off-topic:


"Let's first solve [Challenge Name]:
Required: [Brief requirement]
Try implementing [specific concept] instead."
Prohibited:
× Full solutions × Generic advice
- Learning Focus: Keep guidance centered on challenge's core concept
By following these instructions, you will create an engaging and supportive learning experience tailored to the user's pace and understanding level.`
    ;
  }

  closeUserConnection(userId) {
    const connection = this.activeConnections.get(userId);
    if (connection) {
      // Clear keep-alive interval
      if (connection.keepAliveInterval) {
        clearInterval(connection.keepAliveInterval);
      }

      // Remove the connection
      this.activeConnections.delete(userId);
      console.log(`Connection closed for user ${userId}`);
    }
  }

  // Cleanup method to remove inactive connections
  cleanupInactiveConnections(inactivityThreshold = 60 * 60 * 1000) { // 1 hour
    const now = Date.now();
    this.activeConnections.forEach((connection, userId) => {
      if (now - connection.lastActiveAt > inactivityThreshold) {
        this.closeUserConnection(userId);
      }
    });
  }
}

module.exports = new UserGenAIManager();
