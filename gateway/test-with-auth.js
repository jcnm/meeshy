#!/usr/bin/env node

/**
 * Script de test avec authentification pour envoyer un message et observer les logs de broadcast
 */

const io = require('socket.io-client');
const axios = require('axios');

// Configuration
const GATEWAY_URL = 'http://localhost:3000';

async function testWithAuth() {
  try {
    console.log('🧪 Test d\'envoi de message temps réel avec authentification');
    console.log(`📡 Connexion à la gateway: ${GATEWAY_URL}`);
    
    // 1. Se connecter avec les identifiants admin
    console.log('🔐 Connexion avec les identifiants admin...');
    const loginResponse = await axios.post(`${GATEWAY_URL}/auth/login`, {
      email: 'admin@meeshy.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Token obtenu:', token.substring(0, 20) + '...');
    
    // 2. Créer une conversation de test
    console.log('💬 Création d\'une conversation de test...');
    const conversationResponse = await axios.post(`${GATEWAY_URL}/conversations`, {
      title: 'Test Conversation',
      description: 'Conversation pour test broadcast',
      isPublic: false
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const conversationId = conversationResponse.data.data.id;
    console.log('✅ Conversation créée:', conversationId);
    
    // 3. Se connecter via Socket.IO avec le token
    console.log('🔌 Connexion Socket.IO...');
    const socket = io(GATEWAY_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        sessionToken: token
      }
    });
    
    socket.on('connect', () => {
      console.log('✅ Connecté à la gateway via Socket.IO');
      
      // Rejoindre la conversation
      socket.emit('conversation:join', { conversationId });
      console.log(`👥 Rejoint la conversation: ${conversationId}`);
      
      // Attendre un peu puis envoyer un message
      setTimeout(() => {
        const testMessage = {
          conversationId: conversationId,
          content: 'Test message pour debug broadcast temps réel',
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
    
    // Nettoyer après 15 secondes
    setTimeout(() => {
      console.log('🧹 Fermeture de la connexion...');
      socket.disconnect();
      process.exit(0);
    }, 15000);
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.response?.data || error.message);
    process.exit(1);
  }
}

testWithAuth();
