// Real SMS Integration for Emergency Call Center
// Add this to your existing server.ts file

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Add these to your existing interfaces
interface FeedRequest {
  id: string;
  phoneNumber: string;
  timestamp: string;
  status: 'pending' | 'active' | 'completed';
}

// Global state for managing active feeds and SSE connections
const activeFeeds = new Map<string, FeedRequest>();
const sseClients = new Set<any>();

// aFreeSMS Configuration
const AFREE_SMS_CONFIG = {
  apiUrl: 'https://www.afreesms.com/api/send.php',
  // You may need to register at afreesms.com for better reliability
  // Alternative: https://textbelt.com/text (paid but reliable)
};

// Real SMS Sending Function using aFreeSMS
async function sendSMSReal(phoneNumber: string, message: string): Promise<boolean> {
  try {
    console.log(`📱 Sending SMS to ${phoneNumber}: ${message}`);
    
    // Method 1: aFreeSMS direct API
    const response = await fetch(AFREE_SMS_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'number': phoneNumber,
        'message': message,
        'device': '0', // Use default device
      }).toString()
    });

    const responseText = await response.text();
    console.log('SMS API Response:', responseText);

    if (response.ok && !responseText.includes('error')) {
      console.log(`✅ SMS sent successfully to ${phoneNumber}`);
      return true;
    } else {
      console.error(`❌ SMS failed to ${phoneNumber}: ${responseText}`);
      return false;
    }
  } catch (error) {
    console.error('SMS sending error:', error);
    return false;
  }
}

// Alternative SMS method using TextBelt (more reliable, requires API key)
async function sendSMSTextBelt(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phoneNumber,
        message: message,
        key: process.env.TEXTBELT_API_KEY || 'textbelt', // Use 'textbelt' for one free message per day
      })
    });

    const result = await response.json();
    console.log('TextBelt Response:', result);

    if (result.success) {
      console.log(`✅ SMS sent successfully to ${phoneNumber} via TextBelt`);
      return true;
    } else {
      console.error(`❌ SMS failed via TextBelt: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('TextBelt SMS error:', error);
    return false;
  }
}

// Choose SMS provider (fallback to TextBelt if aFreeSMS fails)
async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  // Try aFreeSMS first
  let success = await sendSMSReal(phoneNumber, message);
  
  if (!success) {
    console.log('aFreeSMS failed, trying TextBelt...');
    success = await sendSMSTextBelt(phoneNumber, message);
  }
  
  return success;
}

// Broadcast SSE message to all connected dashboard clients
function broadcastSSE(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  console.log('Broadcasting SSE:', data);
  
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      console.error('SSE broadcast error:', error);
      sseClients.delete(client);
    }
  });
}

// ADD THESE ROUTES TO YOUR EXISTING EXPRESS APP:

// 1. Request Feed Route with Real SMS
app.post('/request-feed', async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const feedId = uuidv4();
  const serverDomain = req.get('host') || 'localhost:3000';
  const protocol = req.secure ? 'https' : 'http';
  const confirmationUrl = `${protocol}://${serverDomain}/confirmation?id=${feedId}`;
  
  // Store feed request
  activeFeeds.set(feedId, {
    id: feedId,
    phoneNumber,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });

  // Send real SMS with confirmation link
  const smsMessage = `🚨 Emergency Services: Please click this link to share your camera for assistance: ${confirmationUrl}`;
  
  try {
    console.log(`Sending SMS request for feed ID: ${feedId}`);
    const smsSent = await sendSMS(phoneNumber, smsMessage);
    
    if (smsSent) {
      res.json({ 
        success: true, 
        id: feedId,
        message: 'SMS sent successfully',
        confirmationUrl // Include for testing
      });
      
      console.log(`✅ Feed request ${feedId} - SMS sent to ${phoneNumber}`);
    } else {
      activeFeeds.delete(feedId);
      res.status(500).json({ 
        error: 'Failed to send SMS. Please check the phone number and try again.',
        id: feedId 
      });
    }
  } catch (error) {
    activeFeeds.delete(feedId);
    console.error('SMS service error:', error);
    res.status(500).json({ 
      error: 'SMS service temporarily unavailable',
      details: error.message 
    });
  }
});

// 2. SSE Endpoint for Real-time Dashboard Updates
app.get('/feed-events', (req: Request, res: Response) => {
  console.log('New SSE connection from dashboard');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Add client to active connections
  sseClients.add(res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Dashboard connected' })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE client disconnected');
    sseClients.delete(res);
  });

  req.on('error', (err) => {
    console.error('SSE connection error:', err);
    sseClients.delete(res);
  });
});

// 3. Enhanced /videoconfirmationUpdate route for real-time feed activation
app.post('/videoconfirmationUpdate', (req: Request, res: Response) => {
  const feedId = req.body.id || req.query.id;
  console.log(`Video confirmation update for feed: ${feedId}`);
  
  if (feedId && activeFeeds.has(feedId)) {
    // Update feed status
    const feed = activeFeeds.get(feedId);
    if (feed) {
      feed.status = 'active';
      activeFeeds.set(feedId, feed);
    }

    // Broadcast to all connected dashboard clients
    broadcastSSE({
      id: feedId,
      status: 'video_ready',
      timestamp: new Date().toISOString(),
      message: 'Video feed is now live'
    });

    console.log(`🎥 Video feed ${feedId} is now LIVE - broadcasting to dashboard`);
    
    res.json({ 
      success: true, 
      videoId: feedId,
      message: 'Feed activated and dashboard notified'
    });
  } else {
    console.warn(`Feed ${feedId} not found in active feeds`);
    res.json({ 
      success: false, 
      videoId: feedId,
      message: 'Feed not found'
    });
  }
});

// 4. Enhanced CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 5. Health check endpoint
app.get('/ping', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    activeFeeds: activeFeeds.size,
    connectedDashboards: sseClients.size,
    timestamp: new Date().toISOString()
  });
});

// 6. Feed management endpoints
app.get('/active-feeds', (req: Request, res: Response) => {
  const feeds = Array.from(activeFeeds.values());
  res.json({
    feeds,
    count: feeds.length,
    connectedDashboards: sseClients.size
  });
});

app.delete('/feed/:id', (req: Request, res: Response) => {
  const feedId = req.params.id;
  
  if (activeFeeds.has(feedId)) {
    activeFeeds.delete(feedId);
    
    // Broadcast disconnect event
    broadcastSSE({
      id: feedId,
      status: 'disconnected',
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Feed disconnected' });
  } else {
    res.status(404).json({ error: 'Feed not found' });
  }
});

// 7. Test SMS endpoint (for development)
app.post('/test-sms', async (req: Request, res: Response) => {
  const { phoneNumber, message } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number required' });
  }
  
  const testMessage = message || 'Test message from Emergency Call Center';
  const success = await sendSMS(phoneNumber, testMessage);
  
  res.json({ 
    success, 
    message: success ? 'Test SMS sent' : 'SMS failed',
    phoneNumber 
  });
});

console.log('🚀 Real SMS integration active');
console.log('📱 SMS will be sent via aFreeSMS + TextBelt fallback');
console.log('📺 Live feeds will auto-appear in dashboard via SSE');
console.log('🔗 Test endpoints: /ping, /active-feeds, /test-sms');

// Important: Make sure to install required packages:
// npm install node-fetch uuid @types/uuid