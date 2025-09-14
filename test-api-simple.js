#!/usr/bin/env node

// Test simple des APIs Gateway
const API_BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Test simple API Gateway\n');

  try {
    // Test santé
    console.log('1. Test de santé...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    console.log('Status:', healthResponse.status);
    if (healthResponse.ok) {
      const health = await healthResponse.text();
      console.log('Health:', health);
    }

    // Test utilisateurs
    console.log('\n2. Test utilisateurs...');
    const usersResponse = await fetch(`${API_BASE_URL}/users`);
    console.log('Status:', usersResponse.status);
    if (usersResponse.ok) {
      const users = await usersResponse.json();
      console.log('Users count:', users.length);
    } else {
      console.log('Error text:', await usersResponse.text());
    }

    // Test conversations
    console.log('\n3. Test conversations...');
    const convResponse = await fetch(`${API_BASE_URL}/conversations`);
    console.log('Status:', convResponse.status);
    if (convResponse.ok) {
      const conversations = await convResponse.json();
      console.log('Conversations count:', conversations.length);
      if (conversations.length > 0) {
        console.log('First conversation ID:', conversations[0].id);
      }
    } else {
      console.log('Error text:', await convResponse.text());
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();