#!/usr/bin/env node

/**
 * Script de test pour vérifier la synchronisation des messages
 * entre l'API REST et les WebSockets
 */

const axios = require('axios');
const { io } = require('socket.io-client');

const BACKEND_URL = 'http://localhost:3000';
const WS_URL = 'http://localhost:3000';

// Utilisateurs de test (correspond aux utilisateurs seed)
const USERS = {
  alice: { id: '1', username: 'alice', email: 'alice@example.com' },
  bob: { id: '2', username: 'bob', email: 'bob@example.com' }
};

let aliceToken = null;
let bobToken = null;
let testConversationId = null;

// Fonction pour se connecter
async function login(username, password = 'password123') {
  try {
    const response = await axios.post(`${BACKEND_URL}/auth/login`, {
      username,
      password
    });
    console.log(`✅ Connexion réussie pour ${username}`);
    return response.data.access_token;
  } catch (error) {
    console.error(`❌ Erreur de connexion pour ${username}:`, error.response?.data);
    return null;
  }
}

// Fonction pour créer une conversation
async function createConversation(token, participantId) {
  try {
    const response = await axios.post(`${BACKEND_URL}/conversations`, {
      participantIds: [participantId],
      name: 'Test Conversation'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Conversation créée:`, response.data.id);
    return response.data.id;
  } catch (error) {
    console.error(`❌ Erreur création conversation:`, error.response?.data);
    return null;
  }
}

// Fonction pour envoyer un message via API REST
async function sendMessage(token, conversationId, content) {
  try {
    const response = await axios.post(`${BACKEND_URL}/conversations/${conversationId}/messages`, {
      content,
      type: 'text'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Message envoyé via REST API:`, response.data.id);
    return response.data;
  } catch (error) {
    console.error(`❌ Erreur envoi message:`, error.response?.data);
    return null;
  }
}

// Créer une connexion WebSocket
function createWebSocketConnection(token, username) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      auth: { token },
      timeout: 5000
    });

    socket.on('connect', () => {
      console.log(`🔌 WebSocket connecté pour ${username}`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error(`❌ Erreur connexion WebSocket pour ${username}:`, error);
      reject(error);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket déconnecté pour ${username}`);
    });

    socket.on('newMessage', (messageEvent) => {
      console.log(`📨 ${username} a reçu un nouveau message WebSocket:`, {
        messageId: messageEvent.message.id,
        content: messageEvent.message.content,
        conversationId: messageEvent.conversationId
      });
    });
  });
}

// Test principal
async function runTest() {
  console.log('🚀 Début du test de synchronisation des messages...\n');

  // Étape 1: Connexion des utilisateurs
  console.log('📝 Étape 1: Connexion des utilisateurs');
  aliceToken = await login('alice');
  bobToken = await login('bob');
  
  if (!aliceToken || !bobToken) {
    console.error('❌ Impossible de se connecter aux utilisateurs');
    return;
  }
  console.log('');

  // Étape 2: Création d'une conversation
  console.log('📝 Étape 2: Création d\'une conversation');
  testConversationId = await createConversation(aliceToken, USERS.bob.id);
  
  if (!testConversationId) {
    console.error('❌ Impossible de créer la conversation');
    return;
  }
  console.log('');

  // Étape 3: Connexion WebSocket
  console.log('📝 Étape 3: Connexion WebSocket');
  let aliceSocket, bobSocket;
  
  try {
    [aliceSocket, bobSocket] = await Promise.all([
      createWebSocketConnection(aliceToken, 'Alice'),
      createWebSocketConnection(bobToken, 'Bob')
    ]);
  } catch (error) {
    console.error('❌ Erreur connexion WebSocket:', error);
    return;
  }
  console.log('');

  // Étape 4: Rejoindre la conversation
  console.log('📝 Étape 4: Rejoindre la conversation WebSocket');
  aliceSocket.emit('joinConversation', { conversationId: testConversationId });
  bobSocket.emit('joinConversation', { conversationId: testConversationId });
  
  // Attendre un peu pour que les connexions se stabilisent
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('');

  // Étape 5: Test d'envoi de message
  console.log('📝 Étape 5: Envoi de message via API REST');
  console.log('Alice envoie un message...');
  
  const message = await sendMessage(aliceToken, testConversationId, 'Hello Bob, ceci est un test de synchronisation!');
  
  if (!message) {
    console.error('❌ Impossible d\'envoyer le message');
    return;
  }

  // Attendre un peu pour voir si Bob reçoit le message
  console.log('⏳ Attente de la réception du message par Bob...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  // Étape 6: Test dans l'autre sens
  console.log('📝 Étape 6: Test dans l\'autre sens');
  console.log('Bob envoie un message...');
  
  const message2 = await sendMessage(bobToken, testConversationId, 'Hello Alice, j\'ai reçu ton message!');
  
  if (!message2) {
    console.error('❌ Impossible d\'envoyer le message de Bob');
    return;
  }

  console.log('⏳ Attente de la réception du message par Alice...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  // Nettoyage
  console.log('🧹 Nettoyage des connexions...');
  aliceSocket.disconnect();
  bobSocket.disconnect();
  
  console.log('✅ Test terminé!');
}

// Lancer le test
runTest().catch(console.error);
