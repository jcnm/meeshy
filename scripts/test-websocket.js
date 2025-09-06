#!/usr/bin/env node

/**
 * Script de test pour vérifier la connexion WebSocket Socket.IO
 * Usage: node scripts/test-websocket.js [URL]
 */

const { io } = require('socket.io-client');

const DEFAULT_URL = 'wss://gate.meeshy.me';
const URL = process.argv[2] || DEFAULT_URL;

console.log('🔍 Test de connexion WebSocket Socket.IO');
console.log(`📍 URL: ${URL}`);
console.log('─'.repeat(50));

// Configuration de test
const socket = io(URL, {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  reconnection: false,
  timeout: 10000,
  namespace: '/',
  auth: {
    testToken: 'test-connection'
  }
});

let connected = false;
let errorCount = 0;

// Gestionnaires d'événements
socket.on('connect', () => {
  connected = true;
  console.log('✅ Connexion établie avec succès');
  console.log(`   Socket ID: ${socket.id}`);
  console.log(`   Transport: ${socket.io.engine.transport.name}`);
  
  // Test d'envoi d'un message
  console.log('📤 Test d\'envoi de message...');
  socket.emit('authenticate', { testToken: 'test-connection' }, (response) => {
    console.log('📨 Réponse du serveur:', response);
  });
  
  // Fermer la connexion après 3 secondes
  setTimeout(() => {
    console.log('🔌 Fermeture de la connexion...');
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('connect_error', (error) => {
  errorCount++;
  console.error('❌ Erreur de connexion:', error.message);
  console.error('   Type:', error.type);
  console.error('   Description:', error.description);
  
  if (errorCount >= 3) {
    console.error('❌ Trop d\'erreurs, arrêt du test');
    process.exit(1);
  }
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Connexion fermée:', reason);
  if (connected) {
    console.log('✅ Test terminé avec succès');
    process.exit(0);
  }
});

socket.on('error', (error) => {
  console.error('❌ Erreur Socket.IO:', error);
});

// Timeout de sécurité
setTimeout(() => {
  if (!connected) {
    console.error('❌ Timeout: Impossible de se connecter dans les 15 secondes');
    socket.disconnect();
    process.exit(1);
  }
}, 15000);

console.log('⏳ Tentative de connexion...');
