#!/usr/bin/env node

/**
 * Script de test pour vérifier le flux complet d'envoi/réception de messages
 * Tests :
 * 1. Connexion utilisateur 1 et 2
 * 2. Envoi d'un message via API REST par utilisateur 1
 * 3. Vérification que utilisateur 2 reçoit le message via WebSocket
 */

const axios = require('axios');
const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:3000';

// Variables de test
let user1Token = '';
let user2Token = '';
let conversationId = '';
let user1Socket = null;
let user2Socket = null;

async function test() {
  console.log('🚀 Début du test de flux de messages...\n');

  try {
    // 1. Connexion des utilisateurs
    console.log('📡 1. Connexion des utilisateurs...');
    await loginUsers();
    
    // 2. Obtenir ou créer une conversation
    console.log('💬 2. Préparation de la conversation...');
    await setupConversation();
    
    // 3. Connexion WebSocket
    console.log('🔌 3. Connexion WebSocket...');
    await connectWebSockets();
    
    // 4. Test d'envoi de message
    console.log('📨 4. Test d\'envoi de message...');
    await testMessageSending();
    
    console.log('\n✅ Test terminé avec succès !');
    
  } catch (error) {
    console.error('\n❌ Erreur dans le test:', error.message);
    console.error('Détails:', error.response?.data || error);
  } finally {
    // Nettoyage des connexions
    if (user1Socket) user1Socket.disconnect();
    if (user2Socket) user2Socket.disconnect();
  }
}

async function loginUsers() {
  // Liste des utilisateurs à tester (basée sur la seed)
  const testUsers = [
    { username: 'Alice Martin', password: 'password123' },
    { username: 'Bob Johnson', password: 'password123' },
    { username: 'Carlos Rodriguez', password: 'password123' },
    { username: 'Diana Chen', password: 'password123' },
    { username: 'Emma Schmidt', password: 'password123' }
  ];

  let user1Connected = false;
  let user2Connected = false;

  // Essayer de se connecter avec différents utilisateurs
  for (let i = 0; i < testUsers.length && (!user1Connected || !user2Connected); i++) {
    const user = testUsers[i];
    
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/login`, {
        username: user.username,
        password: user.password
      });
      
      if (!user1Connected) {
        user1Token = response.data.access_token;
        user1Connected = true;
        console.log(`  ✅ Utilisateur 1 connecté (${user.username})`);
      } else if (!user2Connected) {
        user2Token = response.data.access_token;
        user2Connected = true;
        console.log(`  ✅ Utilisateur 2 connecté (${user.username})`);
      }
    } catch (error) {
      console.log(`  ⚠️ Échec connexion ${user.username}`);
    }
  }

  if (!user1Connected || !user2Connected) {
    throw new Error('Impossible de se connecter avec les utilisateurs existants');
  }
}

async function setupConversation() {
  // Obtenir les conversations existantes
  const conversationsResponse = await axios.get(`${BACKEND_URL}/conversations`, {
    headers: { Authorization: `Bearer ${user1Token}` }
  });
  
  const conversations = conversationsResponse.data;
  
  if (conversations.length > 0) {
    conversationId = conversations[0].id;
    console.log(`  ✅ Utilisation de la conversation existante: ${conversationId}`);
  } else {
    // Créer une nouvelle conversation
    const newConvResponse = await axios.post(`${BACKEND_URL}/conversations`, {
      name: 'Test Conversation',
      description: 'Conversation de test pour le flux de messages'
    }, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    
    conversationId = newConvResponse.data.id;
    console.log(`  ✅ Conversation créée: ${conversationId}`);
  }
}

async function connectWebSockets() {
  return new Promise((resolve, reject) => {
    let connectedCount = 0;
    const timeout = setTimeout(() => {
      reject(new Error('Timeout de connexion WebSocket'));
    }, 10000);

    // Connexion utilisateur 1
    user1Socket = io(BACKEND_URL, {
      auth: { token: user1Token },
      transports: ['websocket']
    });

    user1Socket.on('connect', () => {
      console.log('  ✅ Utilisateur 1 connecté via WebSocket');
      user1Socket.emit('joinConversation', { conversationId });
      connectedCount++;
      if (connectedCount === 2) {
        clearTimeout(timeout);
        resolve();
      }
    });

    user1Socket.on('connect_error', (error) => {
      console.log('  ❌ Erreur connexion WebSocket user1:', error.message);
    });

    // Connexion utilisateur 2
    user2Socket = io(BACKEND_URL, {
      auth: { token: user2Token },
      transports: ['websocket']
    });

    user2Socket.on('connect', () => {
      console.log('  ✅ Utilisateur 2 connecté via WebSocket');
      user2Socket.emit('joinConversation', { conversationId });
      connectedCount++;
      if (connectedCount === 2) {
        clearTimeout(timeout);
        resolve();
      }
    });

    user2Socket.on('connect_error', (error) => {
      console.log('  ❌ Erreur connexion WebSocket user2:', error.message);
    });
  });
}

async function testMessageSending() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout - message non reçu dans les 5 secondes'));
    }, 5000);

    // Écouter les nouveaux messages sur l'utilisateur 2
    user2Socket.on('newMessage', (messageEvent) => {
      console.log('  🎉 Message reçu via WebSocket:', messageEvent);
      console.log('    - Type:', messageEvent.type);
      console.log('    - Contenu:', messageEvent.message.content);
      console.log('    - Auteur:', messageEvent.message.userId);
      console.log('    - Conversation:', messageEvent.conversationId);
      
      clearTimeout(timeout);
      resolve();
    });

    // Envoyer un message via API REST avec l'utilisateur 1
    const messageContent = `Message de test - ${new Date().toISOString()}`;
    
    axios.post(`${BACKEND_URL}/conversations/${conversationId}/messages`, {
      content: messageContent
    }, {
      headers: { Authorization: `Bearer ${user1Token}` }
    })
    .then(response => {
      console.log('  ✅ Message envoyé via API REST');
      console.log('    - ID:', response.data.id);
      console.log('    - Contenu:', response.data.content);
    })
    .catch(error => {
      console.log('  ❌ Erreur envoi message:', error.response?.data || error.message);
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Gestion des signaux pour nettoyage
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du test...');
  if (user1Socket) user1Socket.disconnect();
  if (user2Socket) user2Socket.disconnect();
  process.exit(0);
});

// Démarrer le test
test();
