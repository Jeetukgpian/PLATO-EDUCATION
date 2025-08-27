// File path: controllers/chatController.js

const Chat = require('../models/chatModels');
const userGenAIManager = require('../services/userGenAIManager');
const apiResponse = require('../utils/apiResponse');
const cacheManager = require('../services/cacheManager');
const { AzureOpenAI } = require("openai"); // Keep using AzureOpenAI

// Azure OpenAI configuration for Chat Controller
const endpoint = process.env.CHAT_AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.CHAT_AZURE_OPENAI_API_KEY;
const apiVersion = process.env.CHAT_OPENAI_API_VERSION || "2024-10-21";
const deploymentName = process.env.CHAT_AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini";

// Add debug logging for configuration
console.log("Chat Controller - Azure OpenAI Configuration:");
console.log("Endpoint:", endpoint);
console.log("API Version:", apiVersion);
console.log("Deployment Name:", deploymentName);
console.log("API Key (first 5 chars):", apiKey ? apiKey.substring(0, 5) + "..." : "undefined");

// Create Azure OpenAI client for Chat Controller with detailed options
const options = {
  apiKey,
  endpoint,
  apiVersion,
  defaultRequestTimeout: 60000, // Set timeout to 60 seconds
};

console.log("Chat Controller - Full OpenAI options object:", JSON.stringify({
  endpoint: options.endpoint,
  apiVersion: options.apiVersion,
  defaultRequestTimeout: options.defaultRequestTimeout,
  // Don't log the full API key
  apiKey: options.apiKey ? "present" : "missing"
}));

const openai = new AzureOpenAI(options);

const globalContext = require('../utils/globalContext');

const defaultMessages = require('../models/defaultMessages');

exports.sendChat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId;
    const description = globalContext.getDescription();
    const language = req.query.backendlanguage || '';

    // Set headers for SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let aiResponse = ""; // Buffer to store the full AI response
    const subtopicId = globalContext.getSubtopicId();
    console.log("Processing chat request for subtopicId:", subtopicId);
    console.log("User ID:", userId);
    console.log("Language:", language);

    // Check if this is the first conversation for this subtopicId
    let pastConversations = await getPastConversations(userId, subtopicId);
    let isFirstConversation = pastConversations.length === 0;
    let userPrompt = message;

    if (isFirstConversation) {
      console.log("First conversation for subtopicId:", subtopicId);
      console.log("Description:", description);
      
      // Determine if it's a challenge or theory based on subtopicId
      const parts = subtopicId.split('_');
      const isChallenge = parts.includes('challenge');
      
      // Generate appropriate initial prompt
      userPrompt = generateInitialPrompt(subtopicId, description, isChallenge, language);
      console.log("Generating initial prompt for new subtopic conversation");
    }

    const chatHistory = pastConversations.flatMap((conv) => [
      { role: "user", content: conv.userMessage || "No user message" },
      { role: "assistant", content: conv.aiResponse || "No AI response" },
    ]);

    // Pass subtopicId as an extra argument
    const genAIConnection = userGenAIManager.createUserConnection(
      userId.toString(),
      process.env.OPENAI_API_KEY,
      chatHistory,
      subtopicId
    );

    // For first conversations, we directly use the initial prompt
    // For regular conversations, we use standard prompt handling
    const prompt = isFirstConversation ? 
      userPrompt : 
      generatePrompt(subtopicId, message, pastConversations);
    
    // If it's the first conversation, add appropriate system message
    if (isFirstConversation) {
      genAIConnection.messages.unshift({ 
        role: "system", 
        content: "You are an expert programming tutor providing initial learning content." 
      });
    }

    genAIConnection.messages.push({ role: "user", content: prompt });

    // Log request details before calling API
    console.log("Chat Controller - Azure OpenAI Request Details:");
    console.log("- Deployment:", deploymentName);
    console.log("- Is First Conversation:", isFirstConversation);
    console.log("- Message Count:", genAIConnection.messages.length);
    console.log("- Temperature:", isFirstConversation ? 1 : 0.3);
    console.log("- Max Tokens:", isFirstConversation ? 2000 : 1500);
    console.log("- Endpoint URL being used:", `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`);

    // Call Azure OpenAI API with streaming enabled
    try {
      console.log("Sending stream request to Azure OpenAI...");
      const response = await openai.chat.completions.create({
        model: deploymentName, // Using the deployment name as model
        messages: genAIConnection.messages,
        stream: true,
        temperature: isFirstConversation ? 1 : 0.3, 
        max_tokens: isFirstConversation ? 2000 : 1500,
      });

      console.log("Stream connection established successfully");
      
      // Handle the stream
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          aiResponse += content; // Buffer the content
          res.write(`${content}`); // Stream it to the client
        }
      }
      
      console.log("Stream completed successfully");
      console.log("Total response length:", aiResponse.length);

    } catch (apiError) {
      console.error("Azure OpenAI API Error Details:");
      console.error("- Status:", apiError.status);
      console.error("- Error Code:", apiError.code);
      console.error("- Error Message:", apiError.error?.message || apiError.message);
      console.error("- Request ID:", apiError.request_id || "Not available");
      
      if (apiError.headers) {
        console.error("- Response Headers:", JSON.stringify(apiError.headers));
      }
      
      if (apiError.status === 404) {
        console.error("404 Error indicates resource not found. Check if deployment name, endpoint URL and API version are correct.");
      }
      
      // Still end the response to prevent hanging connections
      res.write("\nError generating response from AI service.");
      res.end();
      return;
    }

    // End the stream and save the full response
    res.write("\n");
    res.end();
    
    // For first conversation, save with empty user message
    const userMessageToSave = isFirstConversation ? '' : extractMessage(message);
    await saveChat(userId, subtopicId, userMessageToSave, aiResponse);

    if (isFirstConversation) {
      // Initialize cache for first conversation
      cacheManager.initializeCache(userId, subtopicId, [{ userMessage: '', aiResponse }]);
    } else {
      // Update cache for existing conversations
      cacheManager.updateCache(userId, subtopicId, { userMessage: userMessageToSave, aiResponse });
    }
    
    userGenAIManager.closeUserConnection(userId);
  } catch (error) {
    console.error("Chat error:", error);
    console.error("Error type:", error.constructor.name);
    console.error("Error stack:", error.stack);
    res.status(500).json(apiResponse.error("Failed to send message", error.message));
  }
};

// Update getPastConversations API endpoint to not generate content
exports.getPastConversations = async (req, res) => {
  try {
    const subtopicId = req.query.subtopicId;
    const userId = req.userId;
    const language = req.query.backendlanguage;

    globalContext.updateSubtopicId(subtopicId);
    globalContext.updateDescription(req.query.description);
    // Check cache first
    const cachedConversations = cacheManager.getConversations(userId, subtopicId);
    if (cachedConversations.length) {
      console.log("conversation from cache");
      return res.json(apiResponse.success(cachedConversations, 'Past conversations'));
    }

    // If not in cache, check database
    const dbConversations = await Chat.find({ userId, subtopicId });
    if (dbConversations.length) {
      console.log("conversation from db");
      cacheManager.initializeCache(userId, subtopicId, dbConversations);
      return res.json(apiResponse.success(dbConversations, 'Past conversations'));
    }

    // Check for default messages
    const parts = subtopicId.split('_');
    
    // Special case for DSA problemsets - return error as before
    if (parts.includes('problemset') && parts.includes('DSA')) {
      return res.json(apiResponse.error('No conversations found for this subtopic ID'));
    }

    const defaultMessage = defaultMessages?.[language]?.[subtopicId] || null;
    
    if (defaultMessage) {
      // Save default message to database
      await saveChat(userId, subtopicId, '', defaultMessage);
      cacheManager.initializeCache(userId, subtopicId, [{ userMessage: '', aiResponse: defaultMessage }]);
      console.log("conversation from default");
      return res.json(apiResponse.success([{ userMessage: '', aiResponse: defaultMessage }], 'Past conversations'));
    }

    // No conversations found, return empty response
    // The frontend should then call sendChat which will generate the initial response
    console.log("No conversations found for:", subtopicId);
    return res.json(apiResponse.success([], 'No past conversations found'));

  } catch (error) {
    console.error(error);
    return res.json(apiResponse.error('Error fetching past conversations'));
  }
};

const getPastConversations = async (userId, subtopicId) => {
  let pastConversations = cacheManager.getConversations(userId, subtopicId);

  if (!pastConversations.length) {
    pastConversations = await Chat.find({ userId, subtopicId })
      .sort({ timestamp: -1 })
      .limit(15);
    cacheManager.initializeCache(userId.toString(), subtopicId, pastConversations);
  }

  return pastConversations;
};

const generatePrompt = (subtopicId, message, pastConversations) => {
  const parts = subtopicId.split('_');
  if (parts.includes('DSA') && parts.includes('problemset')) {
    // Check if pastConversations is empty
    if (pastConversations.length === 0) {
      return `User: ${message}. You are an expert DSA mentor specializing in C++ programming. Your role is to guide users through structured learning by generating challenge sheets, explaining concepts with clarity, and providing intelligent debugging assistance. Maintain a supportive tone with positive reinforcement while ensuring rigorous technical standards.
overall flow : Generate complete challenge sheet -> Challenge Assistance -> Debugging Workflow -> Move to next challenge in challenge sheet.
focus on these 4 user message cases. 
--------------------------------------------------
{trigger : ${message} === ask ai about what user wants to practice}
1. **Challenge Sheet Generation Protocol** (for first user message only)
- Generate complete challenge sheet based on user message. always refere to standard online sources like GFG or Leetcode.
- Prompt user to start from challenge one at end of challenge sheet generation. 
- Give a skeleton code for challenge 1 soltuion which contain basic input output handling in c++ and all basic code. user just need to write code of Logic asked in challenge.
- your response should contain : all challenges for challenge sheet in below format -> start challenge 1-> skeleton code for challenge1.
- For each challenge: 
  ## challenge no. : [Problem Title] 
  **Source Inspiration:** [Leetcode #123 / GFG Article \"Array Rotation\"] (don't attach any hyperlinks to source)
  **Problem Statement:** [Clear description] (start from new line)
  **Sample Test Cases:** (Give atleast 3 Test Case pairs covering edge cases)
  Input: [values]
  Output: [values]
  
- Medium/Hard problems require:
  
  **Numerical Walkthrough:**
  Input → Step 1 → Step 2 → ... → Output
    }
  `;
    }
    
    return `User: ${message}. You are an expert DSA mentor specializing in C++ programming. Your role is to guide users through structured learning by generating challenge sheets, explaining concepts with clarity, and providing intelligent debugging assistance. Maintain a supportive tone with positive reinforcement while ensuring rigorous technical standards.
overall flow : Generate complete challenge sheet -> Challenge Assistance -> Debugging Workflow -> Move to next challenge in challenge sheet.
focus on these 3 user message cases.  
-------------------------------------------------
(trigger : ${message} === "need a hint") 
2. **Challenge Assistance Protocol** 
- strcitly adhere to giving hints only and not the complete solution or any other irrelevant information.
Trach which challeenge user is currently on and provide hints accordingly. 
Refer to user code if needed for answer depending on user message.

- **First Solution Request:**
    - give a short idea of how to approach the solution.
    - provide first few necessary steps to solve the problem. 
    - In the generated skelteton code for that challenge imlemnent the first few steps of the solution.
- **Subsequent Requests:**
  
  // Complete solution with annotations
  void optimalSolution() {
    // Time Complexity: O(n)
  }
  
  Followed by:
  \"Now try this variation: [Related Challenge]\" 
-------------------------------------------------------------
(trigger :${message} ===  "Help me with my code.")
3. **Debugging Workflow** 
- For non-working code:
  - give corrected code highlighting where user was wrong.
  
- For off-topic code:

  **Redirection:**
  \"Let's focus on [Current Challenge] first.\"
- For working code:

  \"Great job! Now let's tackle [Next Challenge].\"
----------------------------------------------------------------
(trigger :${message} ===  "Move to next challenge")
4. challenge progression: 
 - give the next challenge extracting from challenge sheet. 
 -give the skeleton code for that challenge.

---------------------------------------------------------------
`;
  }
  return `User: ${message}. Now generate your answer to the user prompt.
  This is the subtopic user is currently on: ${subtopicId}`;
};

const extractMessage = (message) => {
  return message.includes("Here is my code:")
    ? message.split("Here is my code:")[0].trim()
    : message.trim();
};

const saveChat = async (userId, subtopicId, userMessage, aiResponse) => {
  const chat = new Chat({ userId, subtopicId, userMessage, aiResponse });
  await chat.save();
};

// Helper function to generate initial prompts based on subtopic type
const generateInitialPrompt = (subtopicId, description, isChallenge, language) => {
  const parts = subtopicId.split('_');
  
  if (isChallenge) {
    return `Generate an engaging programming challenge for ${language} programming.
   
    SubtopicID: ${subtopicId}
    Challenge Description: ${description}
refer to gfg and letcode to find challenges similar to the description field.

 Your response should include:
    - A concise title for the challenge
    - A clear problem statement
    - 2-3 example test cases with expected outputs
    - Hints (without giving away the solution)
    - a code skelton with basic input output handling in ${language} and all basic code. user just need to write code of Logic asked in challenge.


    Format the challenge in a visually appealing way using markdown.
    Be encouraging and motivational in your language.
    Do not provide the solution in your initial message.`;

  } else {
    // Theory content
    return `Generate an educational introduction to the following programming topic in ${language}:
    SubtopicID: ${subtopicId}
    Topic Description: ${description}
    refere to the description to know exaclty what to teach. 
    1. **Subtopic Introduction**  
   - Begin with a **character-driven scenario** (*e.g., "Emma the engineer faces X problem..."*).  
       {don't always use the same character, use different characters for different subtopics}
   - End with a **specific question** (*e.g., "How can Emma implement this efficiently?"*).

2. **Concept Explanation**  
   - Break the explanation into atleast 2 phases may be **2-3 structured phases**.
   - for each phase follow this format :
   {
     - **Theory in 2-3 bullet points.**  
     - **Numerical example walkthrough** to **visually explain logic** (*e.g., updating a DP table step by step*).  
     - **Code snippet implementing just this phase.**  
     - **Comments linking code to the narrative.**  
    }
   - Ensure **all phases are covered.** one after another in a structured manner.
3. step by step numerical example :
    - for the concept covered in concept explanation, provide a step by step numerical example to explain the complete logic.
    - in each step clealy mention the logic and the code snippet which is used to implement that logic.
    - the steps in total should explain the user how the code is implemented and how the logic is implemented via example the user should be able to see the example value updating in steps.
4. **Key Takeaways**  
   - Present in a **decision flowchart style**:  
     - *"If you see X in a problem, immediately do Y."*  
     - *"Always verify Z before proceeding to the next step."*  
     - *"Pattern match to classic implementation (see snippet 2)."*


5. **Coding Challenge**  
   - Continue the **initial narrative** (*e.g., "Help Emma solve a scaled-up version."*).  
   - Provide **structured C++ starter code**:  
     - Pre-written **I/O handling** using standard libraries.  
     - A **skeleton** with **TODO sections** for students to fill in:  
       cpp
       // TODO: IMPLEMENT PHASE 1 HERE (refer to snippet 1)
       // TODO: ADD PHASE 2 LOGIC (see numerical example)
   - ensure that all the phases taught in concept explanation are used here and given in TODO sections.
       
   - **Test cases must include:**  
     - **2 to 3 numerical test cases** for verification.
     - these numerical test cases must cover edge cases of the problem too. (give direct edge case test cases)
     - each test case must have input and output values. which user can use to verify his/her code.

`;
  }
};
