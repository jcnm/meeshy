#!/usr/bin/env node

/**
 * Script de test pour envoyer un message et observer les logs de broadcast
 */

const io = require('socket.io-client');

// Configuration
const GATEWAY_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:3100';

console.log('🧪 Test d\'envoi de message temps réel');
console.log(`📡 Connexion à la gateway: ${GATEWAY_URL}`);

// Créer une connexion Socket.IO
const socket = io(GATEWAY_URL, {
  transports: ['websocket', 'polling'],
  auth: {
    // Token de test - vous devrez le remplacer par un vrai token
    sessionToken: 'test-token'
  }
});

socket.on('connect', () => {
  console.log('✅ Connecté à la gateway');
  
  // Rejoindre une conversation de test
  const testConversationId = 'test-conversation-123';
  socket.emit('conversation:join', { conversationId: testConversationId });
  
  console.log(`👥 Rejoint la conversation: ${testConversationId}`);
  
  // Attendre un peu puis envoyer un message
  setTimeout(() => {
    const testMessage = {
      conversationId: testConversationId,
      content: 'Test message pour debug broadcast',
      originalLanguage: 'fr',
      messageType: 'text'
    };
    
    console.log('📝 Envoi du message de test...');
    socket.emit('message:send', testMessage, (response) => {
      console.log('📨 Réponse du serveur:', response);
    });
  }, 2000);
});

socket.on('message:new', (message) => {
  console.log('🎉 Message reçu via broadcast:', {
    id: message.id,
    content: message.content,
    conversationId: message.conversationId,
    senderId: message.senderId
  });
});

socket.on('error', (error) => {
  console.error('❌ Erreur Socket.IO:', error);
});

socket.on('disconnect', () => {
  console.log('🔌 Déconnecté de la gateway');
});

// Nettoyer après 10 secondes
setTimeout(() => {
  console.log('🧹 Fermeture de la connexion...');
  socket.disconnect();
  process.exit(0);
}, 10000);
