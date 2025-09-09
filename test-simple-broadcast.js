#!/usr/bin/env node

/**
 * Script de test simple pour tester le broadcast des messages
 */

const io = require('socket.io-client');

// Configuration
const GATEWAY_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjNjQwNzFjNzE4MWQ1NTZjZWZjZTgiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzU3MzY4MTMyLCJleHAiOjE3NTc0NTQ1MzJ9.AqJRfP_OfKcLtsLsWR_wL6iNxz0mqaOgLaPzwL_glFA';

console.log('🧪 Test simple de broadcast de messages');
console.log(`📡 Connexion à la gateway: ${GATEWAY_URL}`);

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
  
  // Rejoindre une conversation de test
  const testConversationId = 'test-conversation-broadcast';
  socket.emit('conversation:join', { conversationId: testConversationId });
  
  console.log(`👥 Rejoint la conversation: ${testConversationId}`);
  
  // Attendre un peu puis envoyer un message
  setTimeout(() => {
    const testMessage = {
      conversationId: testConversationId,
      content: 'Test message pour debug broadcast temps réel - ' + new Date().toISOString(),
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
    senderId: message.senderId,
    timestamp: new Date().toISOString()
  });
});

socket.on('error', (error) => {
  console.error('❌ Erreur Socket.IO:', error);
});

socket.on('disconnect', () => {
  console.log('🔌 Déconnecté de la gateway');
});

// Nettoyer après 15 secondes
setTimeout(() => {
  console.log('🧹 Fermeture de la connexion...');
  socket.disconnect();
  process.exit(0);
}, 15000);
