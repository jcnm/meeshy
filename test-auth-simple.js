#!/usr/bin/env node

// Test simple avec fetch natif
const API_BASE_URL = 'http://localhost:3000';

async function testWithAuth() {
  console.log('🔐 Test avec authentification (fetch natif)\n');

  try {
    // Test login
    console.log('1. Tentative de login...');
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    console.log('Login status:', loginResponse.status);
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('Login data:', loginData);
      
      if (loginData.token) {
        const token = loginData.token;
        console.log('Token reçu:', token.substring(0, 20) + '...');
        
        // Test conversations
        console.log('\n2. Test conversations avec authentification...');
        const convResponse = await fetch(`${API_BASE_URL}/conversations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Conversations status:', convResponse.status);
        if (convResponse.ok) {
          const conversations = await convResponse.json();
          console.log('Nombre de conversations:', conversations.length);
          
          if (conversations.length > 0) {
            const conv = conversations[0];
            console.log('Première conversation:', conv.id, conv.type || 'direct');
            
            // Test messages
            console.log('\n3. Test messages...');
            const messagesResponse = await fetch(`${API_BASE_URL}/conversations/${conv.id}/messages`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log('Messages status:', messagesResponse.status);
            if (messagesResponse.ok) {
              const messages = await messagesResponse.json();
              console.log('Messages:', messages);
              console.log('Nombre de messages:', Array.isArray(messages) ? messages.length : 'Not array');
            } else {
              console.log('Messages error:', await messagesResponse.text());
            }
          }
        } else {
          console.log('Conversations error:', await convResponse.text());
        }
      }
    } else {
      console.log('Login error:', await loginResponse.text());
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWithAuth();