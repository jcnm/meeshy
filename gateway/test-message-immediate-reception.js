#!/usr/bin/env node

/**
 * Script de test pour vérifier que l'expéditeur reçoit immédiatement son message
 */

const io = require('socket.io-client');

// Configuration
const GATEWAY_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjNjQwNzFjNzE4MWQ1NTZjZWZjZTgiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzU3Mzk2MDcxLCJleHAiOjE3NTc0ODI0NzF9.FXI_u1cLCvwNA8_PbzhcZJkCHZjfbTva0ue0Bi0Albw';

console.log('🧪 Test de réception immédiate des messages');
console.log(`📡 Connexion à la gateway: ${GATEWAY_URL}`);

// Variables pour le test
let messageReceived = false;
let messageSent = false;
let testConversationId = '68bfbc62493b8a92fc4d6ee1'; // ID de la conversation créée précédemment

// Créer une connexion Socket.IO
const socket = io(GATEWAY_URL, {
  transports: ['websocket', 'polling'],
  auth: {
    authToken: ADMIN_TOKEN,
    tokenType: 'jwt'
  }
});

socket.on('connect', () => {
  console.log('✅ Connecté à la gateway');
  
  // Rejoindre la conversation de test
  socket.emit('conversation:join', { conversationId: testConversationId });
  console.log(`👥 Rejoint la conversation: ${testConversationId}`);
  
  // Attendre un peu puis envoyer un message
  setTimeout(() => {
    const testMessage = {
      conversationId: testConversationId,
      content: 'Test message réception immédiate - ' + new Date().toISOString(),
      originalLanguage: 'fr',
      messageType: 'text'
    };
    
    console.log('📝 Envoi du message de test...');
    messageSent = true;
    socket.emit('message:send', testMessage, (response) => {
      console.log('📨 Réponse du serveur:', response);
      
      if (response.success) {
        console.log('✅ Message envoyé avec succès');
      } else {
        console.log('❌ Erreur lors de l\'envoi:', response.error);
      }
    });
  }, 2000);
});

socket.on('message:new', (message) => {
  console.log('🎉 Message reçu via broadcast:', {
    id: message.id,
    content: message.content,
    conversationId: message.conversationId,
    senderId: message.senderId,
    timestamp: new Date().toISOString()
  });
  
  messageReceived = true;
  
  // Vérifier si c'est notre message
  if (message.content.includes('Test message réception immédiate')) {
    console.log('✅ SUCCÈS: L\'expéditeur a reçu son propre message immédiatement !');
  }
});

socket.on('error', (error) => {
  console.error('❌ Erreur Socket.IO:', error);
});

socket.on('disconnect', () => {
  console.log('🔌 Déconnecté de la gateway');
});

// Vérification finale après 8 secondes
setTimeout(() => {
  console.log('\n📊 Résultats du test:');
  console.log(`📤 Message envoyé: ${messageSent ? '✅' : '❌'}`);
  console.log(`📥 Message reçu: ${messageReceived ? '✅' : '❌'}`);
  
  if (messageSent && messageReceived) {
    console.log('🎉 TEST RÉUSSI: La réception immédiate des messages fonctionne !');
  } else {
    console.log('❌ TEST ÉCHOUÉ: Problème dans la réception immédiate des messages');
  }
  
  console.log('🧹 Fermeture de la connexion...');
  socket.disconnect();
  process.exit(0);
}, 8000);
