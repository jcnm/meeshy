#!/usr/bin/env node

/**
 * Script de test pour vérifier la réception des messages avec leurs traductions
 */

const io = require('socket.io-client');

// Configuration
const GATEWAY_URL = 'http://localhost:3000'\;
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjNjQwNzFjNzE4MWQ1NTZjZWZjZTgiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzU3Mzk2MDcxLCJleHAiOjE3NTc0ODI0NzF9.FXI_u1cLCvwNA8_PbzhcZJkCHZjfbTva0ue0Bi0Albw';
const TEST_CONVERSATION_ID = 'mshy_meeshy-20250115050701';

console.log('🚀 Test de réception des messages avec traductions');
console.log('='.repeat(60));

let messageReceived = false;
let translationsReceived = [];

const socket = io(GATEWAY_URL, {
  auth: {
    token: ADMIN_TOKEN
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
      content: 'Test traductions - ' + new Date().toISOString(),
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
socket.on('translation:complete', (data) => {
  console.log('\n🌐 Traductions asynchrones reçues:');
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

// Écouter les autres événements de traduction
socket.on('message:translated', (data) => {
  console.log('\n🔄 Événement message:translated reçu:', data);
});

socket.on('translation:status', (data) => {
  console.log('\n📊 Statut traduction:', data);
});

socket.on('error', (error) => {
  console.error('❌ Erreur Socket.IO:', error);
});

socket.on('disconnect', () => {
  console.log('🔌 Déconnecté de la gateway');
});

// Vérification finale après 15 secondes
setTimeout(() => {
  console.log('\n📊 Résultats du test:');
  console.log(`📤 Message reçu: ${messageReceived ? '✅' : '❌'}`);
  console.log(`🌐 Traductions reçues: ${translationsReceived.length}`);
  
  if (messageReceived && translationsReceived.length > 0) {
    console.log('🎉 TEST RÉUSSI: Messages et traductions fonctionnent !');
  } else if (messageReceived) {
    console.log('⚠️ TEST PARTIEL: Message reçu mais pas de traductions asynchrones');
  } else {
    console.log('❌ TEST ÉCHOUÉ: Problème dans le système de messages');
  }
  
  console.log('🧹 Fermeture de la connexion...');
  socket.disconnect();
  process.exit(0);
}, 15000);
