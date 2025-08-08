#!/usr/bin/env node

// Test simple de l'API frontend

const BASE_URL = 'http://localhost:3000';

async function testAuth() {
  console.log('🧪 Test d\'authentification...');
  
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@meeshy.com',
        password: 'password123'
      })
    });

    const data = await response.json();
    
    if (data.success && data.access_token) {
      console.log('✅ Authentification réussie');
      return data.access_token;
    } else {
      console.error('❌ Échec authentification:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur authentification:', error);
    return null;
  }
}

async function testConversations(token) {
  console.log('🧪 Test des conversations...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/conversations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (data.success && data.data) {
      console.log(`✅ ${data.data.length} conversations récupérées`);
      console.log('Première conversation:', data.data[0]?.title || 'Aucune');
      return true;
    } else {
      console.error('❌ Échec récupération conversations:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur récupération conversations:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Test de l\'API Meeshy...\n');
  
  const token = await testAuth();
  if (!token) {
    console.log('💥 Test arrêté - pas de token');
    return;
  }
  
  console.log('');
  await testConversations(token);
  
  console.log('\n🏁 Test terminé');
}

main().catch(console.error);
