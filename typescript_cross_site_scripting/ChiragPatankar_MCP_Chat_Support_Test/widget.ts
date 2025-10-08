import express from 'express';
import { database } from '../db/database';

const router = express.Router();

// Get widget configuration
router.get('/config/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Get tenant info
    const tenant = await database.get(
      'SELECT id, name, plan FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get widget configuration
    const config = await database.get(
      'SELECT config FROM widget_configs WHERE tenant_id = ?',
      [tenantId]
    );

    const defaultConfig = {
      theme: {
        primaryColor: '#6366f1',
        backgroundColor: '#ffffff',
        textColor: '#374151',
        borderRadius: '12px'
      },
      position: {
        bottom: '20px',
        right: '20px'
      },
      size: 'medium',
      welcome: {
        title: `Hi! I'm ${tenant.name}'s AI assistant`,
        message: 'How can I help you today?',
        showAvatar: true
      },
      features: {
        fileUpload: false,
        typing: true,
        ratings: true
      }
    };

    const widgetConfig = config ? 
      { ...defaultConfig, ...JSON.parse(config.config) } : 
      defaultConfig;

    res.json({
      tenantId,
      config: widgetConfig
    });
  } catch (error) {
    console.error('Get widget config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get widget script
router.get('/script/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Verify tenant exists
    const tenant = await database.get(
      'SELECT id FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const script = `
(function() {
  // MCP Chat Widget
  const TENANT_ID = '${tenantId}';
  const API_URL = '${process.env.FRONTEND_URL || 'http://localhost:3001'}/api';
  
  // Create widget container
  const widget = document.createElement('div');
  widget.id = 'mcp-chat-widget';
  widget.style.cssText = \`
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    height: 500px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    z-index: 10000;
    display: none;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 1px solid #e5e7eb;
  \`;

  // Create chat button
  const button = document.createElement('div');
  button.id = 'mcp-chat-button';
  button.style.cssText = \`
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 50%;
    cursor: pointer;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    transition: transform 0.2s ease;
  \`;
  
  button.innerHTML = \`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  \`;

  button.onmouseover = () => button.style.transform = 'scale(1.05)';
  button.onmouseout = () => button.style.transform = 'scale(1)';

  // Widget header
  const header = document.createElement('div');
  header.style.cssText = \`
    padding: 16px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border-radius: 12px 12px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  \`;
  
  header.innerHTML = \`
    <div>
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Chat Support</h3>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">We're here to help!</p>
    </div>
    <button id="mcp-close-btn" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 4px;">×</button>
  \`;

  // Messages container
  const messages = document.createElement('div');
  messages.id = 'mcp-messages';
  messages.style.cssText = \`
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  \`;

  // Input container
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = \`
    padding: 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 8px;
  \`;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type your message...';
  input.style.cssText = \`
    flex: 1;
    padding: 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    outline: none;
    font-size: 14px;
  \`;

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.style.cssText = \`
    padding: 12px 16px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  \`;

  // Assemble widget
  inputContainer.appendChild(input);
  inputContainer.appendChild(sendBtn);
  widget.appendChild(header);
  widget.appendChild(messages);
  widget.appendChild(inputContainer);

  // Add to page
  document.body.appendChild(button);
  document.body.appendChild(widget);

  // Session management
  let sessionToken = null;
  let isVisible = false;

  // Toggle widget
  function toggleWidget() {
    isVisible = !isVisible;
    widget.style.display = isVisible ? 'flex' : 'none';
    button.style.display = isVisible ? 'none' : 'flex';
    
    if (isVisible && !sessionToken) {
      initializeSession();
    }
  }

  // Initialize chat session
  async function initializeSession() {
    try {
      const response = await fetch(\`\${API_URL}/chat/sessions\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          domain: window.location.hostname,
          userAgent: navigator.userAgent
        })
      });
      
      const data = await response.json();
      sessionToken = data.sessionToken;
      
      // Add welcome message
      addMessage('ai', 'Hello! How can I help you today?');
    } catch (error) {
      console.error('Failed to initialize session:', error);
      addMessage('ai', 'Sorry, I\\'m having trouble connecting. Please try again later.');
    }
  }

  // Send message
  async function sendMessage(message) {
    if (!sessionToken || !message.trim()) return;

    addMessage('user', message);
    input.value = '';
    
    // Show typing indicator
    const typingEl = addMessage('ai', 'Typing...', true);
    
    try {
      const response = await fetch(\`\${API_URL}/chat/messages\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          message,
          tenantId: TENANT_ID
        })
      });
      
      const data = await response.json();
      
      // Remove typing indicator
      typingEl.remove();
      
      // Add AI response
      addMessage('ai', data.response);
      
    } catch (error) {
      typingEl.remove();
      addMessage('ai', 'Sorry, I encountered an error. Please try again.');
    }
  }

  // Add message to chat
  function addMessage(sender, text, isTyping = false) {
    const messageEl = document.createElement('div');
    messageEl.style.cssText = \`
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.4;
      \${sender === 'user' ? 
        'background: #6366f1; color: white; align-self: flex-end; margin-left: auto;' : 
        'background: #f3f4f6; color: #374151; align-self: flex-start;'
      }
      \${isTyping ? 'opacity: 0.7; font-style: italic;' : ''}
    \`;
    
    messageEl.textContent = text;
    messages.appendChild(messageEl);
    messages.scrollTop = messages.scrollHeight;
    
    return messageEl;
  }

  // Event listeners
  button.onclick = toggleWidget;
  header.querySelector('#mcp-close-btn').onclick = toggleWidget;
  sendBtn.onclick = () => sendMessage(input.value);
  input.onkeypress = (e) => {
    if (e.key === 'Enter') sendMessage(input.value);
  };

  console.log('MCP Chat Widget loaded successfully');
})();
`;

    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
  } catch (error) {
    console.error('Get widget script error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 