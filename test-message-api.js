#!/usr/bin/env node

/**
 * Script de test pour vérifier l'API des messages
 */

const https = require('https');
const http = require('http');

// Configuration
const GATEWAY_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:3100';

// Fonction pour faire une requête HTTP
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
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
    req.setTimeout(5000, () => reject(new Error('Timeout')));
    req.end();
  });
}

async function testGatewayHealth() {
  console.log('🔍 Test de santé du Gateway...');
  try {
    const response = await makeRequest(`${GATEWAY_URL}/health`);
    console.log(`✅ Gateway Health: ${response.status} ${response.status === 200 ? 'OK' : 'ERROR'}`);
    if (response.status !== 200) {
      console.log('❌ Données de réponse:', response.data);
    }
    return response.status === 200;
  } catch (error) {
    console.log('❌ Erreur Gateway Health:', error.message);
    return false;
  }
}

async function testFrontendAccess() {
  console.log('🔍 Test d\'accès au Frontend...');
  try {
    const response = await makeRequest(`${FRONTEND_URL}`);
    console.log(`✅ Frontend Access: ${response.status} ${response.status === 200 ? 'OK' : 'ERROR'}`);
    return response.status === 200;
  } catch (error) {
    console.log('❌ Erreur Frontend Access:', error.message);
    return false;
  }
}

async function testConversationsAPI() {
  console.log('🔍 Test de l\'API Conversations...');
  try {
    // Test sans authentification d'abord
    const response = await makeRequest(`${GATEWAY_URL}/api/conversations`);
    console.log(`✅ Conversations API: ${response.status}`);
    
    if (response.status === 200) {
      console.log('📊 Données conversations:', typeof response.data, Array.isArray(response.data) ? response.data.length : 'N/A');
      if (Array.isArray(response.data) && response.data.length > 0) {
        const firstConv = response.data[0];
        console.log('📋 Première conversation:', {
          id: firstConv.id,
          name: firstConv.name || firstConv.title,
          messageCount: firstConv.messageCount || 0,
          participants: firstConv.participants?.length || 0
        });
        return firstConv.id;
      }
    } else {
      console.log('❌ Réponse erreur:', response.data);
    }
    return null;
  } catch (error) {
    console.log('❌ Erreur Conversations API:', error.message);
    return null;
  }
}

async function testMessagesAPI(conversationId) {
  if (!conversationId) {
    console.log('⏭️ Pas de conversation disponible pour tester les messages');
    return;
  }
  
  console.log(`🔍 Test de l'API Messages pour conversation ${conversationId}...`);
  try {
    const response = await makeRequest(`${GATEWAY_URL}/api/conversations/${conversationId}/messages?limit=3`);
    console.log(`✅ Messages API: ${response.status}`);
    
    if (response.status === 200) {
      console.log('📊 Données messages:', typeof response.data, Array.isArray(response.data) ? response.data.length : 'N/A');
      if (Array.isArray(response.data) && response.data.length > 0) {
        const firstMessage = response.data[0];
        console.log('📋 Premier message:', {
          id: firstMessage.id,
          content: firstMessage.content?.substring(0, 50) + '...',
          hasTranslations: !!firstMessage.translations,
          translationCount: firstMessage.translations?.length || 0
        });
      }
    } else {
      console.log('❌ Réponse erreur messages:', response.data);
    }
  } catch (error) {
    console.log('❌ Erreur Messages API:', error.message);
  }
}

async function main() {
  console.log('🚀 Test de diagnostic Meeshy API\n');
  
  const gatewayOk = await testGatewayHealth();
  const frontendOk = await testFrontendAccess();
  
  if (!gatewayOk) {
    console.log('\n❌ Gateway non disponible, arrêt des tests');
    return;
  }
  
  const conversationId = await testConversationsAPI();
  await testMessagesAPI(conversationId);
  
  console.log('\n✅ Tests terminés');
  console.log('\n💡 Pour tester l\'affichage des messages:');
  console.log('   1. Ouvrez http://localhost:3100 dans votre navigateur');
  console.log('   2. Connectez-vous ou créez un compte');
  console.log('   3. Ouvrez une conversation');
  console.log('   4. Vérifiez la console du navigateur pour les logs');
}

main().catch(console.error);
