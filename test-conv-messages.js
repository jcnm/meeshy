#!/usr/bin/env node

const API_BASE_URL = 'http://localhost:3000';

async function testConversations() {
  console.log('🔐 Test conversations directement\n');

  try {
    // Login rapide
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    if (!loginResponse.ok) {
      console.log('Login failed:', loginResponse.status);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('✅ Login success');

    // Test conversations
    const convResponse = await fetch(`${API_BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Conversations status:', convResponse.status);
    
    if (convResponse.ok) {
      const conversations = await convResponse.json();
      console.log('Conversations data type:', typeof conversations);
      console.log('Is array:', Array.isArray(conversations));
      
      if (Array.isArray(conversations)) {
        console.log('Conversations count:', conversations.length);
        if (conversations.length > 0) {
          const conv = conversations[0];
          console.log('First conversation:', { id: conv.id, type: conv.type });
          
          // Test messages
          const msgResponse = await fetch(`${API_BASE_URL}/conversations/${conv.id}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          console.log('Messages status:', msgResponse.status);
          if (msgResponse.ok) {
            const messages = await msgResponse.json();
            console.log('Messages type:', typeof messages);
            console.log('Messages is array:', Array.isArray(messages));
            if (Array.isArray(messages)) {
              console.log('Messages count:', messages.length);
              if (messages.length > 0) {
                console.log('First message:', { id: messages[0].id, content: messages[0].content });
              }
            } else {
              console.log('Messages structure:', Object.keys(messages));
            }
          } else {
            console.log('Messages error:', await msgResponse.text());
          }
        }
      } else {
        console.log('Conversations structure:', Object.keys(conversations));
      }
    } else {
      console.log('Conversations error:', await convResponse.text());
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testConversations();