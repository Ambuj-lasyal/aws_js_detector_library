/*
   AI Chatbot with conversation history storage supporting local Gemma3:4b and Deepseek-r1 models
*/

import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid"; // For generating conversation IDs

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --- MODEL CONFIGURATION ---
const MODEL_ENDPOINTS = {
  gemma3: {
    url: "http://localhost:11434/api/generate",
    ollamaModelName: "gemma3:4b",
    type: "ollama-generate",
  },
  deepseek: {
    url: "http://localhost:8001/v1/chat/completions",
    ollamaModelName: "deepseek-coder",
    type: "openai-compatible",
  },
};

// --- CONVERSATION STORAGE ---
const CONVERSATIONS_DIR = path.resolve(process.cwd(), "conversations");
const USER_PROFILES_PATH = path.resolve(process.cwd(), "user_profiles.json");

// Ensure conversations directory exists
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

// --- CHATBOT CONFIGURATION ---
const CHATBOT_CONFIG = {
  name: "AI Assistant",
  personality: "helpful, friendly, and knowledgeable",
  maxHistoryLength: 50, // Maximum number of messages to keep in memory
  systemPrompt: `You are a helpful AI assistant named AI Assistant. You have access to tools like web search and calculator. 
When you need to use a tool, respond with JSON format: {"tool": "tool_name", "args": {"arg1": "value1"}}
Otherwise, respond naturally in conversation. Keep responses concise but informative.
Available tools: web_search, calculator`,
};

// --- TOOLS REGISTRY ---
const tools = {
  web_search: async (query) => {
    console.log(`Executing web search for: "${query}"`);
    const SERP_API_KEY = process.env.SERP_API_KEY;
    const SEARCH_ENGINE_URL = "https://google.serper.dev/search";

    if (!SERP_API_KEY) {
      return `Error: SERP_API_KEY is not configured. Cannot perform search for "${query}".`;
    }

    try {
      const response = await axios.get(SEARCH_ENGINE_URL, {
        params: {
          api_key: SERP_API_KEY,
          q: query,
          engine: "google",
          num: 5,
        },
      });

      const data = response.data;
      let resultText = "";

      if (data.answerBox && data.answerBox.answer) {
        resultText += `**Answer:** ${data.answerBox.answer}\n`;
      }

      if (data.organic && data.organic.length > 0) {
        const snippets = data.organic
          .slice(0, 3)
          .map(
            (item, index) =>
              `${index + 1}. **${item.title}**\n${item.snippet}\n${item.link}`
          )
          .join("\n\n");
        if (resultText) resultText += "\n\n";
        resultText += `**Search Results:**\n\n${snippets}`;
      }

      return resultText || `No relevant results found for "${query}".`;
    } catch (error) {
      console.error(`Web search error for "${query}":`, error.message);
      return `Error performing web search: ${error.message}`;
    }
  },

  calculator: async (expression) => {
    console.log(`Calculating: "${expression}"`);
    try {
      const result = eval(expression);
      return `${expression} = ${result}`;
    } catch (e) {
      return `Error calculating "${expression}": ${e.message}`;
    }
  },
};

// --- USER PROFILE MANAGEMENT ---
function loadUserProfiles() {
  if (fs.existsSync(USER_PROFILES_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(USER_PROFILES_PATH, "utf-8"));
    } catch (e) {
      console.error("Error loading user profiles:", e);
    }
  }
  return {};
}

function saveUserProfiles(profiles) {
  try {
    fs.writeFileSync(USER_PROFILES_PATH, JSON.stringify(profiles, null, 2));
  } catch (e) {
    console.error("Error saving user profiles:", e);
  }
}

function getUserProfile(userId) {
  const profiles = loadUserProfiles();
  if (!profiles[userId]) {
    profiles[userId] = {
      id: userId,
      createdAt: new Date().toISOString(),
      conversations: [],
      preferences: {},
      totalMessages: 0,
    };
    saveUserProfiles(profiles);
  }
  return profiles[userId];
}

function updateUserProfile(userId, updates) {
  const profiles = loadUserProfiles();
  if (profiles[userId]) {
    Object.assign(profiles[userId], updates);
    saveUserProfiles(profiles);
  }
}

// --- CONVERSATION MANAGEMENT ---
function loadConversation(conversationId) {
  const conversationPath = path.join(
    CONVERSATIONS_DIR,
    `${conversationId}.json`
  );
  if (fs.existsSync(conversationPath)) {
    try {
      return JSON.parse(fs.readFileSync(conversationPath, "utf-8"));
    } catch (e) {
      console.error(`Error loading conversation ${conversationId}:`, e);
    }
  }
  return null;
}

function saveConversation(conversation) {
  const conversationPath = path.join(
    CONVERSATIONS_DIR,
    `${conversation.id}.json`
  );
  try {
    fs.writeFileSync(conversationPath, JSON.stringify(conversation, null, 2));
  } catch (e) {
    console.error(`Error saving conversation ${conversation.id}:`, e);
  }
}

function createNewConversation(userId, title = "New Conversation") {
  const conversation = {
    id: uuidv4(),
    userId,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    model: "gemma3",
    totalMessages: 0,
  };

  // Add system message
  conversation.messages.push({
    role: "system",
    content: CHATBOT_CONFIG.systemPrompt,
    timestamp: new Date().toISOString(),
  });

  saveConversation(conversation);

  // Update user profile
  const profiles = loadUserProfiles();
  if (profiles[userId]) {
    profiles[userId].conversations.unshift(conversation.id);
    profiles[userId].conversations = profiles[userId].conversations.slice(
      0,
      10
    ); // Keep last 10 conversations
    saveUserProfiles(profiles);
  }

  return conversation;
}

function addMessageToConversation(conversationId, message) {
  const conversation = loadConversation(conversationId);
  if (!conversation) return null;

  message.timestamp = new Date().toISOString();
  conversation.messages.push(message);
  conversation.updatedAt = new Date().toISOString();
  conversation.totalMessages++;

  // Trim conversation history if too long
  if (conversation.messages.length > CHATBOT_CONFIG.maxHistoryLength) {
    // Keep system message and recent messages
    const systemMessage = conversation.messages[0];
    const recentMessages = conversation.messages.slice(
      -CHATBOT_CONFIG.maxHistoryLength + 1
    );
    conversation.messages = [systemMessage, ...recentMessages];
  }

  saveConversation(conversation);
  return conversation;
}

// --- LLM CALL FUNCTION ---
// --- LLM CALL FUNCTION ---
async function callLocalAgent(messages, modelKey = "gemma3") {
  const modelConfig = MODEL_ENDPOINTS[modelKey];
  if (!modelConfig) {
    throw new Error(`Model configuration not found for key: ${modelKey}`);
  }
  console.log("modelConfig", modelConfig);
  
  if (modelConfig.type === "ollama-generate") {
    const fullPrompt =
      messages
        .map((msg) => {
          if (msg.role === "system") return msg.content;
          if (msg.role === "user") return `User: ${msg.content}`;
          if (msg.role === "assistant") return `Assistant: ${msg.content}`;
          if (msg.role === "function")
            return `Tool result for ${msg.name}: ${msg.content}`;
          return "";
        })
        .join("\n\n") + "\n\nAssistant:";

    const payload = {
      model: modelConfig.ollamaModelName,
      prompt: fullPrompt,
      stream: false,
    };
    
    console.log("modelconfig.url", modelConfig.url);
    console.log("payload", payload);

    try {
      // Fixed: Properly await the axios call and handle the response
      const response = await axios.post(modelConfig.url, payload, {
        headers: { "Content-Type": "application/json" },
      });

      console.log("Full response:", response.data);
      
      // Check if response has the expected structure
      if (!response.data || !response.data.response) {
        console.error("Unexpected response structure:", response.data);
        throw new Error("Invalid response from Ollama server");
      }

      const content = response.data.response;
      console.log("Extracted content:", content);

      // Try to parse tool call
      try {
        const parsedContent = JSON.parse(content);
        if (parsedContent.tool && parsedContent.args) {
          console.log("Detected tool call:", parsedContent);
          return {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  function_call: {
                    name: parsedContent.tool,
                    arguments: JSON.stringify(parsedContent.args),
                  },
                },
              },
            ],
          };
        }
      } catch (e) {
        console.log("Content is not a tool call, treating as regular response");
      }

      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: content,
            },
          },
        ],
      };

    } catch (error) {
      console.error("AXIOS ERROR:", error.message);
      if (error.response) {
        console.error("ERROR STATUS:", error.response.status);
        console.error("ERROR DATA:", error.response.data);
      } else if (error.request) {
        console.error("ERROR REQUEST:", error.request);
      }
      throw error; // Re-throw to be handled by the calling function
    }

  } else {
    throw new Error("Unsupported model type: " + modelConfig.type);
  }
}
// --- API ENDPOINTS ---

// Start new conversation
app.post("/chat/new", async (req, res) => {
  const { userId = "default_user", title, model = "gemma3" } = req.body;

  if (!MODEL_ENDPOINTS[model]) {
    return res.status(400).json({
      error: `Invalid model: ${model}. Available: ${Object.keys(
        MODEL_ENDPOINTS
      ).join(", ")}`,
    });
  }

  const userProfile = getUserProfile(userId);
  const conversation = createNewConversation(userId, title);
  conversation.model = model;
  saveConversation(conversation);

  res.json({
    conversationId: conversation.id,
    message: `Hello! I'm ${CHATBOT_CONFIG.name}. How can I help you today?`,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      createdAt: conversation.createdAt,
    },
  });
});

// Send message to conversation
app.post("/chat/message", async (req, res) => {
  const { conversationId, message, userId = "default_user" } = req.body;
  console.log("we are herereerereee");
  if (!conversationId || !message) {
    return res
      .status(400)
      .json({ error: "conversationId and message are required" });
  }

  let conversation = loadConversation(conversationId);
  console.log(
    "conversation this is conversiona jskdlafjlksdajfsda fskdlajl",
    conversation
  );
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Add user message
  addMessageToConversation(conversationId, {
    role: "user",
    content: message,
  });

  // Reload conversation to get updated messages
  conversation = loadConversation(conversationId);
  let messages = [...conversation.messages];

  let finalResponse = "";
  const steps = [];
  let done = false;
  const maxSteps = 5;
  console.log("before entering the while loop");
  // Agent processing loop
  while (!done && steps.length < maxSteps) {
    try {
      console.log("messages");
      const apiRes = await callLocalAgent(messages, conversation.model);
      console.log("apiRes", apiRes);
      const msg = apiRes.choices[0].message;
      console.log("msg", msg);
      if (msg.function_call) {
        const { name, arguments: argsJson } = msg.function_call;
        let args;
        console.log("msg.function_call", msg.function_call);
        try {
          args = JSON.parse(argsJson);
        } catch (e) {
          console.error(`Error parsing function arguments for ${name}:`, e);
          messages.push({
            role: "function",
            name,
            content: `Error: Could not parse function arguments. Please provide valid JSON.`,
          });
          continue;
        }
        console.log("args", args);
        if (tools[name]) {
          console.log(`Using tool: ${name} with args:`, args);
          const result = await tools[name](...Object.values(args));

          messages.push(msg, { role: "function", name, content: result });
          steps.push({ action: name, args, result });
        } else {
          messages.push(msg, {
            role: "function",
            name,
            content: `Error: Tool "${name}" not found.`,
          });
        }
      } else {
        messages.push(msg);
        if (msg.content) {
          finalResponse = msg.content;
          done = true;
        }
      }
    } catch (error) {
      console.error("Error during chat processing:", error.message);
      finalResponse =
        "I apologize, but I encountered an error processing your request. Please try again.";
      console.log("Error details:", error);
      done = true;
    }
  }

  if (!finalResponse) {
    finalResponse =
      "I'm having trouble processing your request right now. Could you please rephrase or try again?";
  }

  // Add assistant response to conversation
  console.log("finalResponse", finalResponse);
  addMessageToConversation(conversationId, {
    role: "assistant",
    content: finalResponse,
  });
  console.log("why why why");
  // Update user profile
  const userProfile = getUserProfile(userId);
  userProfile.totalMessages++;
  updateUserProfile(userId, userProfile);

  res.json({
    response: finalResponse,
    conversationId,
    steps: steps.length > 0 ? steps : undefined,
  });
});

// Get conversation history
app.get("/chat/history/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const conversation = loadConversation(conversationId);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  res.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      totalMessages: conversation.totalMessages,
    },
    messages: conversation.messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
  });
});

// Get user's conversations
app.get("/chat/conversations/:userId", (req, res) => {
  const { userId } = req.params;
  const userProfile = getUserProfile(userId);

  const conversations = userProfile.conversations
    .map((id) => loadConversation(id))
    .filter((conv) => conv !== null)
    .map((conv) => ({
      id: conv.id,
      title: conv.title,
      model: conv.model,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      totalMessages: conv.totalMessages,
      lastMessage:
        conv.messages.length > 1
          ? conv.messages[conv.messages.length - 1].content?.substring(0, 100) +
            "..."
          : "New conversation",
    }));

  res.json({
    userId,
    totalConversations: conversations.length,
    conversations,
  });
});

// Delete conversation
app.delete("/chat/conversation/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const { userId = "default_user" } = req.body;

  const conversation = loadConversation(conversationId);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Remove from filesystem
  const conversationPath = path.join(
    CONVERSATIONS_DIR,
    `${conversationId}.json`
  );
  try {
    fs.unlinkSync(conversationPath);
  } catch (e) {
    console.error("Error deleting conversation file:", e);
  }

  // Remove from user profile
  const profiles = loadUserProfiles();
  if (profiles[userId]) {
    profiles[userId].conversations = profiles[userId].conversations.filter(
      (id) => id !== conversationId
    );
    saveUserProfiles(profiles);
  }

  res.json({ message: "Conversation deleted successfully" });
});

// Update conversation title
app.put("/chat/conversation/:conversationId/title", (req, res) => {
  const { conversationId } = req.params;
  const { title } = req.body;
  console.log(
    `Updating title for conversation ${conversationId} to "${title}"`
  );

  const conversation = loadConversation(conversationId);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  conversation.title = title;
  conversation.updatedAt = new Date().toISOString();
  saveConversation(conversation);

  res.json({ message: "Title updated successfully", title });
});

// Get available models
app.get("/chat/models", (req, res) => {
  const models = Object.keys(MODEL_ENDPOINTS).map((key) => ({
    key,
    name: MODEL_ENDPOINTS[key].ollamaModelName,
    type: MODEL_ENDPOINTS[key].type,
  }));

  res.json({ models });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    chatbot: CHATBOT_CONFIG.name,
    models: Object.keys(MODEL_ENDPOINTS),
    uptime: process.uptime(),
  });
});

app.listen(3000, () => {
  console.log(`🤖 ${CHATBOT_CONFIG.name} server listening on port 3000`);
  console.log(`📁 Conversations stored in: ${CONVERSATIONS_DIR}`);
  console.log(`👥 User profiles stored in: ${USER_PROFILES_PATH}`);
  console.log(
    `🔧 Available models: ${Object.keys(MODEL_ENDPOINTS).join(", ")}`
  );
});
