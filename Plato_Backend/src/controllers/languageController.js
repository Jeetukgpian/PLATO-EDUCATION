// src/controllers/languageController.js

const User = require('../models/userModel');
const defaultTopics = require('../models/topicModel');
const apiResponse = require('../utils/apiResponse');
const { AzureOpenAI } = require("openai");
const keepAliveUtils = require('../utils/KeepAlive');
// Azure OpenAI configuration
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion = process.env.OPENAI_API_VERSION ||"2024-05-01-preview";
const modelName = "o3-mini";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "o3-mini";

// Add debug logging for configuration
console.log("Azure OpenAI Configuration:");
console.log("Endpoint:", endpoint);
console.log("API Version:", apiVersion);
console.log("Model Name:", modelName);
console.log("Deployment Name:", deployment);
console.log("API Key (first 5 chars):", apiKey ? apiKey.substring(0, 5) + "..." : "undefined");

// Create Azure OpenAI client with options object
const options = { 
  endpoint, 
  apiKey, 
  deployment, 
  apiVersion,
  defaultRequestTimeout: 600000 // 3 minutes
};

console.log("Full OpenAI options object:", JSON.stringify({
  endpoint: options.endpoint,
  apiVersion: options.apiVersion,
  deployment: options.deployment,
  defaultRequestTimeout: options.defaultRequestTimeout,
  // Don't log the full API key
  apiKey: options.apiKey ? "present" : "missing"
}));

const openai = new AzureOpenAI(options);

exports.getTopicsByLanguage = async (req, res) => {
    try {
      const language = req.body.language;
      let user = await User.findOne({ firebaseUserId: req.userId });
      if (!user) {
        return res.status(404).json(apiResponse.error('User not found'));
      }
        // If not, get topics from topic model
        const topic = defaultTopics.find(topic => topic.language === language);
        if (!topic) {
          return res.status(404).json(apiResponse.error('Language not found'));
        }
        // Update user topics field with the new topic
        user.topics.push({ language, topics: topic.topics });
        await user.save();
        // Return topics to frontend
        res.json(apiResponse.success(user.topics, 'Topics found'));
    } catch (error) {
      console.error('Error getting topics:', error);
      res.status(500).json(apiResponse.error('Error getting topics', error.message));
    }
  };

  exports.saveTopicsInUserProfile = async (req, res) => {
    try {
      console.log("Initial request body:", req.body);
      
      const user = await User.findOne({ firebaseUserId: req.userId });
      if (!user) {
        return res.status(404).json(apiResponse.error('User not found'));
      }
  
      // Extract topics array from request body
      const topics = Array.isArray(req.body) ? req.body : req.body.topics;
      console.log("Processed topics:", topics);
  
      // Validate topics
      if (!topics || !Array.isArray(topics)) {
        console.log("Invalid topics structure:", topics);
        return res.status(400).json(apiResponse.error('Invalid topics format'));
      }
  
      // Validate topic structure
      for (const topic of topics) {
        if (!topic.language || !Array.isArray(topic.topics)) {
          console.log("Invalid topic structure:", topic);
          return res.status(400).json(apiResponse.error('Each topic must have language and topics array'));
        }
      }
  
      user.topics = topics;
      await user.save();
      
      console.log('Topics saved successfully:', user.topics);
      return res.json(apiResponse.success(user.topics, 'Topics saved successfully'));
  
    } catch (error) {
      console.error('Error saving topics:', error);
      return res.status(500).json(apiResponse.error('Error saving topics', error.message));
    }
  };

  exports.generatePersonalizedCourse = async (req, res) => {
    let keepAliveInterval = null;
    
    try {
      const { expertise, goal, language } = req.body;
      
      if (!expertise || !goal || !language) {
        return res.status(400).json(apiResponse.error('Missing required fields: expertise, goal, or language'));
      }

      console.log(`Generating personalized ${language} course with goal: ${goal}`);
      console.log("User expertise:", expertise);
      
      // Find the user
      const user = await User.findOne({ firebaseUserId: req.userId });
      if (!user) {
        return res.status(404).json(apiResponse.error('User not found'));
      }
      
      // Set up streaming response
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Prevents buffering by nginx
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Create a unique ID for this keep-alive session
      const keepAliveId = `course_gen_${user._id}_${Date.now()}`;
      
      // Start sending keep-alive packets
      keepAliveInterval = keepAliveUtils.startKeepAlive(res, keepAliveId);
      
      // Update user's course_option
      const courseOption = {
        language,
        topics: expertise
      };
      
      // Check if course option for this language already exists
      const existingOptionIndex = user.course_option.findIndex(opt => opt.language === language);
      if (existingOptionIndex >= 0) {
        user.course_option[existingOptionIndex] = courseOption;
      } else {
        user.course_option.push(courseOption);
      }
      
      // Generate course syllabus using AI
      const syllabus = await generateSyllabusWithAI(language, goal, expertise);
      
      if (!syllabus) {
        // Handle error with streaming response
        keepAliveUtils.stopKeepAlive(keepAliveInterval);
        res.write(JSON.stringify(apiResponse.error('Failed to generate course syllabus')));
        return res.end();
      }
      
      // Update user's topics with the generated syllabus
      const existingTopicIndex = user.topics.findIndex(topic => topic.language === language);
      if (existingTopicIndex >= 0) {
        user.topics[existingTopicIndex] = syllabus;
      } else {
        user.topics.push(syllabus);
      }
      
      // Save the user
      await user.save();
      
      // Send final response and end stream
      keepAliveUtils.stopKeepAlive(keepAliveInterval);
      res.write(JSON.stringify(apiResponse.success(user.topics, 'Personalized course generated successfully')));
      return res.end();
      
    } catch (error) {
      console.error('Error generating course:', error);
      
      // Clean up keep-alive if it was started
      if (keepAliveInterval) {
        keepAliveUtils.stopKeepAlive(keepAliveInterval);
      }
      
      // If headers have been sent, use streaming response
      if (res.headersSent) {
        res.write(JSON.stringify(apiResponse.error('Error generating course', error.message)));
        return res.end();
      } else {
        // Otherwise use standard response
        return res.status(500).json(apiResponse.error('Error generating course', error.message));
      }
    }
  };

  // Helper function to generate syllabus using Azure OpenAI
  async function generateSyllabusWithAI(language, goal, expertise) {
    try {
      // Determine which reference syllabus to use
      let referenceLang = language;
      if (goal.toLowerCase() === "dsa" && language === "C++") {
        referenceLang = "DSA"; // Use DSA topic model if goal is DSA
      }

      // Get reference syllabus from topic model
      const referenceSyllabus = defaultTopics.find(topic => topic.language === referenceLang);
      console.log("User expertise:", expertise);
      if (!referenceSyllabus) {
        console.warn(`No reference syllabus found for ${referenceLang}, proceeding without reference`);
      }

      // Create a demo JSON based on user expertise and reference syllabus
      const demoJson = constructDemoJson(expertise, referenceSyllabus);
      console.log("Demo JSON structure created successfully");

      // Create a detailed prompt for the AI - properly stringify the reference syllabus
      let prompt2;
      if(goal.toLowerCase() === "dsa"){
        prompt2 = `generate a learning path for learning DSA in C++.`;
      }else{
        prompt2 = `generate a learning path for learning ${language} language.`;
      }

      const prompt = `${prompt2}. here is the demo JSON structure: ${JSON.stringify(demoJson, null, 2)} which you need to fill in by following the below instruction properly.
     #### **Role & Responsibility:**  
You are a **programming education expert** responsible for **modifying a reference syllabus** into a **personalized syllabus** based on the user’s expertise levels. **Strictly follow the step-by-step instructions** below for generating the syllabus.  

---
## **Step 1: Input Data & Understanding the Reference Syllabus**  
1. **Extract user-provided information:**  
   - **Reference syllabus:** A structured syllabus with topics and subtopics.  
   - **User expertise levels:** A list mapping topics to Expert, Familiar, or Beginner.  
   - **Goal & Language:** The user’s learning goal and the desired language of the syllabus.  

2. **For each topic in the user expertise list, retrieve the corresponding subtopics from the reference syllabus.**  

---

## **Step 2: Process Topics Based on Expertise Level**  

### **A. If a topic is marked as "Expert" (Create ONE Recap Topic with ONE Subtopic)**  
**Goal:** Condense all expert topics into **a single recap topic with one subtopic**.  

1. **Find all topics labeled as "Expert".**  
2. **Extract all subtopics** from these topics in the reference syllabus.  
3. **Combine all subtopics** into **one single subtopic** under a **new recap topic**.  
4. **Write a concise, cheat-sheet-style description** for this subtopic:  
   - **Summarize all key concepts** from the merged topics.  
   - Use **code examples** for quick recall.  
5. **Add challenges to the subtopic:**  
   - **3 Medium + 3 Hard challenges**.  
   - The **description field of each challenge** must provide **instructions for another LLM** on how to generate the challenge.  
   - **Source challenges from:** GeeksforGeeks (GFG), LeetCode, or InterviewBit.  
6. **Set the topic & subtopic names:**  
   - **Topic Name:** "Recap of: {topic_1}, {topic_2}, ...".  
   - **Sub-topic Name:** Same as the topic name.  

---

### **B. If a topic is marked as "Familiar" (Create a New Topic, Reduce Subtopics)**  
**Goal:** Retain the topic but **merge subtopics** to reduce the total number.  

1. **Identify the topic and retrieve all subtopics from the reference syllabus.**  
2. **Merge similar subtopics** to **reduce** the total number of subtopics (e.g., if the reference syllabus has **6 subtopics**, merge them into **~3 subtopics**).  
3. **Write descriptions for the new subtopics:**  
   - **Briefly recap basic concepts** with **code examples**.  
   - **Introduce some advanced concepts** to deepen understanding.  
4. **Add challenges to each subtopic:**  
   - **2 Easy + 1 Medium + 1 Hard challenge** per subtopic.  
   - The **description field of each challenge** must provide **instructions for another LLM** on how to generate the challenge.  
   - **Source challenges from:** GeeksforGeeks (GFG), LeetCode, or InterviewBit.  
5. **Set the topic & subtopic names:**  
   - **Topic Name:** Same as in the reference syllabus.  
   - **Sub-topic Names:** Generate new names based on merged subtopics.  

**Repeat this process for all topics marked as "Familiar".**  

---

### **C. If a topic is marked as "Beginner" (Retain All Subtopics as in the Reference Syllabus)**  
**Goal:** Keep all subtopics intact and provide **a full learning experience from basics to advanced concepts**.  

1. **Identify the topic and retrieve all subtopics from the reference syllabus.**  
2. **Copy all subtopics exactly** as they appear in the reference syllabus (**do not merge or skip any**).  
3. **Write descriptions for each subtopic:**  
   - **Teach from basics to advanced concepts**.  
   - **Provide clear explanations with code examples**.  
4. **Add challenges to each subtopic:**  
   - **3 Easy + 2 Medium challenges** per subtopic.  
   - The **description field of each challenge** must provide **instructions for another LLM** on how to generate the challenge.  
   - **Source challenges from:** GeeksforGeeks (GFG), LeetCode, or InterviewBit.  
5. **Set the topic & subtopic names:**  
   - **Topic Name & Sub-topic Names:** Copy exactly from the reference syllabus.  

**Repeat this process for all topics marked as "Beginner".**  

---

## **Step 3: Ensuring Correct JSON Output**  
1. **Ensure all topics and subtopics are structured correctly.**  
2. **Verify challenge difficulties are assigned correctly based on expertise level.**  
3. **Ensure descriptions for subtopics and challenges contain clear LLM instructions.**  
4. **Double-check that topic and subtopic naming conventions match the required format.**  

---

## **Final Notes (Strict Rules to Follow):**  
✅ **Topic Structuring:**  
- Expert topics → **Merged into ONE recap topic**.  
- Familiar topics → **Retained but with reduced subtopics**.  
- Beginner topics → **Retained fully with all subtopics**.  

✅ **Challenge Difficulty Levels:**  
- **Expert:** 3 Medium + 3 Hard 
- **Familiar:** 2 Easy + 1 Medium + 1 Hard  
- **Beginner:** 3 Easy + 2 Medium  

✅ **Challenge Sources:**  
- All challenges must come from **GeeksforGeeks (GFG), LeetCode, or InterviewBit**.  

✅ **Strict Naming Conventions:**  
- Expert topic name: "Recap of: {topic_1}, {topic_2}, ..." 
- Familiar & Beginner topic names: **Same as reference syllabus**.  
- Familiar sub-topic names: **New names based on merged subtopics**.  
- Beginner sub-topic names: **Copied exactly from reference syllabus**.  


      structure of the new syllabus:
       ### **JSON Output Format**
     
      Return a structured JSON object in the following format:
     
      {
        "language": "${referenceLang}",
        "topics": [
          {
            "id": Number,
            "name": "Topic Name",
            "description": "Brief description",
            "completed": false,
            "subtopics": [
              {
                "id": Number,
                "name": "Subtopic Name",
                "description": "Detailed technical description covering theory, syntax, implementation steps, and use cases.",
                "completed": false,
                "challenges": [
                  {
                    "id": Number,
                    "name": "Challenge Name",
                    "completed": false,
                    "difficulty": "string",
                    "description": "Challenge description with clear instructions and expected outcomes."
                  }
                ]
              }
            ]
          }
        ]
      }
      ---
      `;
      
      const systemprompt = `You are a **programming education expert** responsible for **modifying a reference syllabus** into a **personalized syllabus** based on the user’s expertise levels. **Strictly follow the step-by-step instructions** in user prompt generating the syllabus.`;
      
      // Log request details before calling API
      console.log("Azure OpenAI Request Details:");
      console.log("- Model:", modelName);
      console.log("- Deployment:", deployment);
      console.log("- System Prompt Length:", systemprompt.length);
      console.log("- User Prompt Length:", prompt.length);
      console.log("- Endpoint URL being used:", `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`);
      
      // Call Azure OpenAI API
      try {
        console.log("Sending request to Azure OpenAI...");
        const response = await openai.chat.completions.create({
          messages: [
            { role: "system", content: systemprompt },
            { role: "user", content: prompt }
          ],
         
          max_completion_tokens: 100000, // Increased max tokens to allow for more complete responses
          response_format: {type : "json_object"},
          model: modelName,
          reasoning_effort : "low"
        });
        
        console.log("Received successful response from Azure OpenAI");
        
        // Extract and parse the response
        const content = response.choices[0].message.content;
        
        // Log successful response info
        console.log("Response received with status:", response.status);
        console.log("Response ID:", response.id);
        console.log("Model used in response:", response.model);
        
        // Access properties directly from response, not response.body
        console.log("Model:", response);
        
        try {
          const parsedSyllabus = JSON.parse(content);
          console.log("Successfully generated syllabus structure");
          
          // Add subtopicid to all subtopics and challenges
          parsedSyllabus.topics.forEach((topic, topicIndex) => {
            if (topic.subtopics) {
              topic.subtopics.forEach((subtopic, subtopicIndex) => {
                // Add subtopicid to subtopic
                subtopic.subtopicId = `${referenceLang}_subtopic_${topicIndex + 1}_${subtopicIndex + 1}`;
                
                // Add subtopicid to each challenge
                if (subtopic.challenges) {
                  subtopic.challenges.forEach((challenge, challengeIndex) => {
                    challenge.subtopicId = `${referenceLang}_challenge_${topicIndex + 1}_${subtopicIndex + 1}_${challengeIndex + 1}`;
                  });
                }
              });
            }
          });
          
          console.log("Added subtopicid fields to syllabus");
          return parsedSyllabus;
        } catch (parseError) {
          console.error("Failed to parse AI response as JSON:", parseError);
          console.log("Raw AI response:", content);
          throw new Error("AI generated invalid JSON");
        }
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
        
        throw apiError;
      }
      
    } catch (error) {
      console.error("Error calling AI service:", error);
      console.error("Error type:", error.constructor.name);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  // Function to construct a demo JSON structure based on user expertise
  function constructDemoJson(expertise, referenceSyllabus) {
    if (!referenceSyllabus) {
      return { language: "Unknown", topics: [] };
    }
    
    // Group topics by expertise level
    const expertTopics = [];
    const familiarTopics = [];
    const beginnerTopics = [];
    
    // Process each topic in the expertise object
    Object.entries(expertise).forEach(([topicName, level]) => {
      if (level.toLowerCase() === "expert") {
        expertTopics.push(topicName);
      } else if (level.toLowerCase() === "familiar") {
        familiarTopics.push(topicName);
      } else { // Assuming "beginner" for any other value
        beginnerTopics.push(topicName);
      }
    });
    
    const demoTopics = [];
    let topicIdCounter = 1;
    
    // Create a combined "Recap" topic for all expert topics if any exist
    if (expertTopics.length > 0) {
      const recapName = `Recap of: ${expertTopics.join(", ")}`;
      
      // Find subtopics from reference syllabus for expert topics
      const expertSubtopics = [];
      let subtopicIdCounter = 1;
      
      expertTopics.forEach(expertTopic => {
        // Find matching topic in reference syllabus
        const refTopic = referenceSyllabus.topics.find(topic => 
          topic.name.toLowerCase().includes(expertTopic.toLowerCase()) || 
          expertTopic.toLowerCase().includes(topic.name.toLowerCase())
        );
        
        if (refTopic && refTopic.subtopics) {
          // Add all subtopics from reference topic
          refTopic.subtopics.forEach(refSubtopic => {
            expertSubtopics.push({
              id: subtopicIdCounter++,
              name: refSubtopic.name,
              description: "",
              completed: false,
              subtopicId: `${referenceSyllabus.language}_subtopic_1_${subtopicIdCounter-1}`,
              challenges: []
            });
          });
        }
      });
      
      // Add the recap topic
      demoTopics.push({
        id: topicIdCounter++,
        name: recapName,
        description: "",
        completed: false,
        level: "Expert",
        subtopics: expertSubtopics
      });
    }
    
    // Add familiar topics
    familiarTopics.forEach(familiarTopic => {
      const refTopic = referenceSyllabus.topics.find(topic => 
        topic.name.toLowerCase().includes(familiarTopic.toLowerCase()) || 
        familiarTopic.toLowerCase().includes(topic.name.toLowerCase())
      );
      
      if (refTopic) {
        const subtopics = [];
        let subtopicIdCounter = 1;
        
        if (refTopic.subtopics) {
          refTopic.subtopics.forEach(refSubtopic => {
            subtopics.push({
              id: subtopicIdCounter++,
              name: refSubtopic.name,
              description: "",
              completed: false,
              subtopicId: `${referenceSyllabus.language}_subtopic_${topicIdCounter}_${subtopicIdCounter-1}`,
              challenges: []
            });
          });
        }
        
        demoTopics.push({
          id: topicIdCounter++,
          name: refTopic.name,
          description: "",
          completed: false,
          level: "Familiar",
          subtopics: subtopics
        });
      }
    });
    
    // Add beginner topics
    beginnerTopics.forEach(beginnerTopic => {
      const refTopic = referenceSyllabus.topics.find(topic => 
        topic.name.toLowerCase().includes(beginnerTopic.toLowerCase()) || 
        beginnerTopic.toLowerCase().includes(topic.name.toLowerCase())
      );
      
      if (refTopic) {
        const subtopics = [];
        let subtopicIdCounter = 1;
        
        if (refTopic.subtopics) {
          refTopic.subtopics.forEach(refSubtopic => {
            subtopics.push({
              id: subtopicIdCounter++,
              name: refSubtopic.name,
              description: "",
              completed: false,
              subtopicId: `${referenceSyllabus.language}_subtopic_${topicIdCounter}_${subtopicIdCounter-1}`,
              challenges: []
            });
          });
        }
        
        demoTopics.push({
          id: topicIdCounter++,
          name: refTopic.name,
          description: "",
          completed: false,
          level: "Beginner",
          subtopics: subtopics
        });
      }
    });
    
    return {
      language: referenceSyllabus.language,
      topics: demoTopics
    };
  }



