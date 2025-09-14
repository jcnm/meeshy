#!/usr/bin/env node

const http = require('http');

const GATEWAY_URL = 'http://localhost:3000';

function makeRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Timeout')));
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

async function testConversationsFinal() {
  console.log('🔍 Test final des conversations...');
  
  try {
    // Connexion
    const loginData = JSON.stringify({
      username: 'test',
      password: 'password123'
    });
    
    const loginResponse = await makeRequest(`${GATEWAY_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    if (loginResponse.status !== 200 || !loginResponse.data.success) {
      console.log('❌ Erreur de connexion:', loginResponse.data);
      return;
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Connecté avec succès');
    
    // Test de l'API conversations avec le bon endpoint
    const convResponse = await makeRequest(`${GATEWAY_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`📊 Status: ${convResponse.status}`);
    
    if (convResponse.status === 200 && convResponse.data.success) {
      const conversations = convResponse.data.data;
      console.log(`📋 Nombre de conversations: ${conversations.length}`);
      
      conversations.forEach((conv, index) => {
        console.log(`\n📝 Conversation ${index + 1}:`);
        console.log('   ID:', conv.id);
        console.log('   Title:', conv.title);
        console.log('   Type:', conv.type);
        console.log('   Members:', conv.members ? conv.members.length : 'N/A');
        console.log('   UnreadCount:', conv.unreadCount);
        console.log('   IsActive:', conv.isActive);
      });
      
      console.log('\n✅ SUCCESS: Les conversations sont disponibles via l\'API');
      console.log('🎯 Le frontend devrait maintenant afficher ces conversations');
      
    } else {
      console.log('❌ Erreur API:', convResponse.data);
    }
    
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

async function main() {
  console.log('🚀 Test final des conversations\n');
  await testConversationsFinal();
}

main().catch(console.error);
