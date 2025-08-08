const WebSocket = require('ws');

console.log('🔌 Test de connexion WebSocket...');

// Test avec token factice
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
const wsUrl = `ws://localhost:3000/ws?token=${encodeURIComponent(testToken)}`;

console.log('📡 URL de test:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ Connexion WebSocket établie!');
  
  // Test d'envoi de message
  const testMessage = {
    type: 'join_conversation',
    conversationId: 'test-conversation',
    data: { userId: 'test-user' }
  };
  
  ws.send(JSON.stringify(testMessage));
  console.log('📤 Message de test envoyé:', testMessage);
  
  // Fermer la connexion après test
  setTimeout(() => {
    ws.close();
    console.log('🔒 Connexion fermée');
  }, 2000);
});

ws.on('error', (error) => {
  console.log('❌ Erreur WebSocket:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 WebSocket fermé - Code:', code, 'Raison:', reason.toString());
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Message reçu:', message);
  } catch (e) {
    console.log('📨 Message brut reçu:', data.toString());
  }
});

// Timeout de sécurité
setTimeout(() => {
  if (ws.readyState !== WebSocket.CLOSED) {
    console.log('⏰ Timeout - Fermeture forcée');
    ws.close();
  }
  process.exit(0);
}, 10000);
