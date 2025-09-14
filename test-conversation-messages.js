#!/usr/bin/env node

/**
 * Script de test pour diagnostiquer le problème des messages dans les conversations
 */

const http = require('http');

const GATEWAY_URL = 'http://localhost:3000';

// Fonction pour faire une requête HTTP
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

async function loginWithTestAccount() {
  console.log('🔐 Connexion avec le compte test...');
  try {
    const loginData = JSON.stringify({
      username: 'test',
      password: 'password123'
    });
    
    const response = await makeRequest(`${GATEWAY_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    console.log(`✅ Login Status: ${response.status}`);
    if (response.status === 200 && response.data.success && response.data.data.token) {
      console.log('🎫 Token obtenu:', response.data.data.token.substring(0, 20) + '...');
      return response.data.data.token;
    } else {
      console.log('❌ Erreur login:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Erreur connexion:', error.message);
    return null;
  }
}

async function getConversations(token) {
  console.log('📋 Récupération des conversations...');
  try {
    const response = await makeRequest(`${GATEWAY_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`✅ Conversations Status: ${response.status}`);
    if (response.status === 200 && response.data.success && Array.isArray(response.data.data)) {
      console.log(`📊 Nombre de conversations: ${response.data.data.length}`);
      return response.data.data;
    } else {
      console.log('❌ Erreur conversations:', response.data);
      return [];
    }
  } catch (error) {
    console.log('❌ Erreur récupération conversations:', error.message);
    return [];
  }
}

async function getMessages(conversationId, token) {
  console.log(`💬 Récupération des messages pour la conversation ${conversationId}...`);
  try {
    const response = await makeRequest(`${GATEWAY_URL}/api/conversations/${conversationId}/messages?limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`✅ Messages Status: ${response.status}`);
    if (response.status === 200 && response.data.success) {
      const messages = response.data.data.messages;
      console.log('📊 Réponse messages:', typeof messages);
      if (Array.isArray(messages)) {
        console.log(`📋 Nombre de messages: ${messages.length}`);
        if (messages.length > 0) {
          const firstMessage = messages[0];
          console.log('📝 Premier message:', {
            id: firstMessage.id,
            content: firstMessage.content?.substring(0, 50) + '...',
            hasTranslations: !!firstMessage.translations,
            translationCount: firstMessage.translations?.length || 0,
            senderId: firstMessage.senderId,
            timestamp: firstMessage.timestamp
          });
        }
        return messages;
      } else {
        console.log('📋 Structure de données:', Object.keys(messages || {}));
        return messages;
      }
    } else {
      console.log('❌ Erreur messages:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Erreur récupération messages:', error.message);
    return null;
  }
}

async function testHealth() {
  console.log('🏥 Test de santé du Gateway...');
  try {
    const response = await makeRequest(`${GATEWAY_URL}/health`);
    console.log(`✅ Health Status: ${response.status}`);
    return response.status === 200;
  } catch (error) {
    console.log('❌ Erreur health:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Diagnostic des messages de conversation\n');
  
  // Test de santé
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n❌ Gateway non disponible, arrêt des tests');
    return;
  }
  
  // Connexion
  const token = await loginWithTestAccount();
  if (!token) {
    console.log('\n❌ Impossible de se connecter, arrêt des tests');
    return;
  }
  
  // Récupération des conversations
  const conversations = await getConversations(token);
  if (conversations.length === 0) {
    console.log('\n⚠️ Aucune conversation trouvée');
    return;
  }
  
  // Test des messages pour la première conversation
  const firstConversation = conversations[0];
  console.log(`\n🔍 Test avec la première conversation: ${firstConversation.id}`);
  console.log(`   Nom: ${firstConversation.name || firstConversation.title || 'Sans nom'}`);
  console.log(`   Participants: ${firstConversation.participants?.length || 0}`);
  
  const messages = await getMessages(firstConversation.id, token);
  
  console.log('\n📋 Résumé du diagnostic:');
  console.log(`   - Gateway: ${healthOk ? '✅' : '❌'}`);
  console.log(`   - Authentification: ${token ? '✅' : '❌'}`);
  console.log(`   - Conversations: ${conversations.length} trouvée(s)`);
  console.log(`   - Messages: ${messages ? (Array.isArray(messages) ? messages.length : 'Structure différente') : '❌ Erreur'}`);
  
  if (messages && Array.isArray(messages) && messages.length === 0) {
    console.log('\n💡 Suggestion: La conversation existe mais n\'a pas de messages');
    console.log('   Essayez d\'envoyer un message via l\'interface web');
  } else if (messages && !Array.isArray(messages)) {
    console.log('\n💡 Suggestion: La structure de réponse est différente de celle attendue');
    console.log('   Vérifiez l\'API et le format des données');
  }
}

main().catch(console.error);