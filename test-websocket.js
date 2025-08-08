#!/usr/bin/env node

const WebSocket = require('ws');

// Test de connexion WebSocket simple
const wsUrl = 'ws://localhost:3000/ws';

console.log(`🧪 Test de connexion WebSocket sur: ${wsUrl}`);

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('✅ Connexion WebSocket réussie !');
  ws.close();
});

ws.on('close', function close(code, reason) {
  console.log(`🔒 Connexion WebSocket fermée: ${code} - ${reason}`);
  if (code === 4001) {
    console.log('❌ Erreur: Token d\'authentification requis');
  } else if (code === 4002) {
    console.log('❌ Erreur: Token d\'authentification invalide');
  }
});

ws.on('error', function error(err) {
  console.log('❌ Erreur WebSocket:', err.message);
});

// Timeout après 5 secondes
setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN) {
    console.log('⏰ Timeout: Connexion WebSocket échouée');
    ws.close();
  }
}, 5000);
