#!/usr/bin/env node

/**
 * Script de test pour vérifier que le frontend reçoit ses propres messages
 * Simule le comportement du frontend : envoie un message et vérifie qu'il le reçoit
 */

const io = require('socket.io-client');
const axios = require('axios');

// Configuration
const GATEWAY_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjNjQwNzFjNzE4MWQ1NTZjZWZjZTgiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzU3MzY4MTMyLCJleHAiOjE3NTc0NTQ1MzJ9.AqJRfP_OfKcLtsLsWR_wL6iNxz0mqaOgLaPzwL_glFA';

console.log('🧪 Test du flux de messages frontend');
console.log(`📡 Connexion à la gateway: ${GATEWAY_URL}`);

// Variables pour le test
let messageReceived = false;
let messageSent = false;
let testConversationId = null;

async function startTest() {
  try {
    // 1. Créer une conversation de test
    console.log('💬 Création d\'une conversation de test...');
    const conversationResponse = await axios.post(`${GATEWAY_URL}/conversations`, {
      title: 'Test Conversation Frontend Flow',
      description: 'Conversation pour test du flux de messages frontend',
      isPublic: false
    }, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    
    testConversationId = conversationResponse.data.data.id;
    console.log('✅ Conversation créée:', testConversationId);
    
    // 2. Créer une connexion Socket.IO
    const socket = io(GATEWAY_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        authToken: ADMIN_TOKEN,
        tokenType: 'jwt'
      }
    });

    socket.on('connect', () => {
      console.log('✅ Connecté à la gateway');
      
      // Rejoindre la conversation créée
      socket.emit('conversation:join', { conversationId: testConversationId });
      console.log(`👥 Rejoint la conversation: ${testConversationId}`);
      
      // Attendre un peu puis envoyer un message
      setTimeout(() => {
        const testMessage = {
          conversationId: testConversationId,
          content: 'Test message frontend flow - ' + new Date().toISOString(),
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
      if (message.content.includes('Test message frontend flow')) {
        console.log('✅ SUCCÈS: Le frontend a reçu son propre message !');
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Erreur Socket.IO:', error);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Déconnecté de la gateway');
    });

    // Vérification finale après 10 secondes
    setTimeout(() => {
      console.log('\n📊 Résultats du test:');
      console.log(`📤 Message envoyé: ${messageSent ? '✅' : '❌'}`);
      console.log(`📥 Message reçu: ${messageReceived ? '✅' : '❌'}`);
      
      if (messageSent && messageReceived) {
        console.log('🎉 TEST RÉUSSI: Le flux de messages fonctionne correctement !');
      } else {
        console.log('❌ TEST ÉCHOUÉ: Problème dans le flux de messages');
      }
      
      console.log('🧹 Fermeture de la connexion...');
      socket.disconnect();
      process.exit(0);
    }, 10000);

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Démarrer le test
startTest();
