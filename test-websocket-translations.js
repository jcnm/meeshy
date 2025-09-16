#!/usr/bin/env node

/**
 * Test simple de réception des traductions via WebSocket
 */

const io = require('socket.io-client');

// Configuration
const GATEWAY_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjNjQwNzFjNzE4MWQ1NTZjZWZjZTgiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzU3OTUzNTI2LCJleHAiOjE3NTgwMzk5MjZ9.YrjhHXJhLLhyYT8Kw2pZWM4mJc-JoQ_j0OvLd5xwqJQ';
const TEST_CONVERSATION_ID = '68bc64071c7181d556cefce5'; // Conversation existante d'après les logs

console.log('🚀 Test de réception des traductions en temps réel');
console.log('='.repeat(60));

let messageReceived = false;
let translationsReceived = [];

const socket = io(GATEWAY_URL, {
  auth: {
    authToken: ADMIN_TOKEN
  },
  extraHeaders: {
    'authorization': `Bearer ${ADMIN_TOKEN}`
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Connecté à la gateway');
  
  // Rejoindre la conversation de test
  socket.emit('conversation:join', { conversationId: TEST_CONVERSATION_ID });
  console.log(`👥 Rejoint la conversation: ${TEST_CONVERSATION_ID}`);
  
  // Attendre puis envoyer un message de test
  setTimeout(() => {
    const testMessage = {
      conversationId: TEST_CONVERSATION_ID,
      content: 'Test traductions en temps réel - ' + new Date().toISOString(),
      originalLanguage: 'fr',
      messageType: 'text'
    };
    
    console.log('📝 Envoi du message de test...');
    socket.emit('message:send', testMessage, (response) => {
      console.log('📨 Réponse du serveur:', response);
      
      if (response.success) {
        console.log('✅ Message envoyé avec succès, ID:', response.data?.messageId);
      } else {
        console.log('❌ Erreur lors de l\'envoi:', response.error);
      }
    });
  }, 2000);
});

// Écouter les nouveaux messages
socket.on('message:new', (message) => {
  console.log('\n🎉 Message reçu via broadcast:');
  console.log('  ID:', message.id);
  console.log('  Contenu:', message.content);
  console.log('  Langue originale:', message.originalLanguage);
  console.log('  Traductions incluses:', message.translations?.length || 0);
  
  if (message.translations && message.translations.length > 0) {
    console.log('  📋 Détail des traductions:');
    message.translations.forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.targetLanguage}: "${t.translatedContent}"`);
      console.log(`       Modèle: ${t.translationModel}, Cache: ${t.cacheKey}`);
    });
  } else {
    console.log('  ⚠️ Aucune traduction incluse dans le message initial');
  }
  
  messageReceived = true;
});

// Écouter les traductions asynchrones
socket.on('message:translation', (data) => {
  console.log('\n🌐 Traduction asynchrone reçue:');
  console.log('  Message ID:', data.messageId);
  console.log('  Nombre de traductions:', data.translations?.length || 0);
  
  if (data.translations) {
    data.translations.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.targetLanguage}: "${t.translatedContent}"`);
      console.log(`     Modèle: ${t.translationModel}, Confiance: ${t.confidenceScore}`);
    });
    
    translationsReceived.push(...data.translations);
  }
});

// Écouter les événements de traduction (ancienne API si elle existe encore)
socket.on('translation:complete', (data) => {
  console.log('\n🌟 Translation:complete reçu:');
  console.log('  Données:', JSON.stringify(data, null, 2));
});

socket.on('translation:received', (data) => {
  console.log('\n🌟 Translation:received reçu:');
  console.log('  Données:', JSON.stringify(data, null, 2));
});

socket.on('error', (error) => {
  console.error('❌ Erreur Socket.IO:', error);
});

socket.on('disconnect', () => {
  console.log('🔌 Déconnecté de la gateway');
});

// Récapitulatif après 15 secondes
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DU TEST:');
  console.log(`  Messages reçus: ${messageReceived ? 'OUI' : 'NON'}`);
  console.log(`  Traductions asynchrones reçues: ${translationsReceived.length}`);
  
  if (translationsReceived.length > 0) {
    console.log('  📋 Détail des traductions reçues:');
    translationsReceived.forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.targetLanguage}: "${t.translatedContent}"`);
    });
  }
  
  console.log('\n🧹 Fermeture de la connexion...');
  socket.disconnect();
  process.exit(0);
}, 15000);