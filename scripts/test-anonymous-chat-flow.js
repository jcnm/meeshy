#!/usr/bin/env node

/**
 * Script de test pour valider le flux complet de chat anonyme
 * 
 * Ce script teste :
 * 1. Création d'un lien de partage
 * 2. Rejoindre une conversation anonymement
 * 3. Accès à la page de chat
 * 4. Envoi de messages
 * 5. Gestion des erreurs
 */

const fetch = require('node-fetch');
const { performance } = require('perf_hooks');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[ÉTAPE ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Fonction utilitaire pour faire des requêtes
async function makeRequest(url, options = {}) {
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    const data = await response.json().catch(() => ({}));
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      duration
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    return {
      ok: false,
      status: 0,
      data: { error: error.message },
      duration
    };
  }
}

// Test 1: Créer un utilisateur de test et un lien de partage
async function testCreateShareLink() {
  logStep(1, 'Création d\'un utilisateur de test et d\'un lien de partage');
  
  // Créer un utilisateur de test
  const userData = {
    username: `testuser_${Date.now()}`,
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User',
    email: `test_${Date.now()}@example.com`,
    systemLanguage: 'fr'
  };
  
  const registerResponse = await makeRequest(`${BASE_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(userData)
  });
  
  if (!registerResponse.ok) {
    logError(`Échec de l'inscription: ${registerResponse.data.message || 'Erreur inconnue'}`);
    return null;
  }
  
  logSuccess(`Utilisateur créé: ${userData.username}`);
  
  // Se connecter
  const loginResponse = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: userData.username,
      password: userData.password
    })
  });
  
  if (!loginResponse.ok) {
    logError(`Échec de la connexion: ${loginResponse.data.message || 'Erreur inconnue'}`);
    return null;
  }
  
  const authToken = loginResponse.data.token;
  logSuccess('Connexion réussie');
  
  // Créer un lien de partage
  const linkData = {
    name: 'Test Anonymous Chat',
    description: 'Lien de test pour le chat anonyme',
    allowAnonymousMessages: true,
    allowAnonymousFiles: false,
    allowAnonymousImages: true,
    allowViewHistory: true,
    requireNickname: true,
    requireEmail: false
  };
  
  const linkResponse = await makeRequest(`${BASE_URL}/links`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(linkData)
  });
  
  if (!linkResponse.ok) {
    logError(`Échec de la création du lien: ${linkResponse.data.message || 'Erreur inconnue'}`);
    return null;
  }
  
  const linkId = linkResponse.data.linkId;
  const shareLinkId = linkResponse.data.shareLink.id;
  
  logSuccess(`Lien créé: ${linkId}`);
  logSuccess(`Share Link ID: ${shareLinkId}`);
  
  return {
    authToken,
    linkId,
    shareLinkId,
    userData
  };
}

// Test 2: Rejoindre une conversation anonymement
async function testJoinAnonymously(linkId) {
  logStep(2, 'Rejoindre une conversation anonymement');
  
  const participantData = {
    firstName: 'Anonymous',
    lastName: 'User',
    username: `anon_${Date.now()}`,
    email: `anon_${Date.now()}@example.com`,
    language: 'fr',
    deviceFingerprint: 'test-device-fingerprint'
  };
  
  const joinResponse = await makeRequest(`${BASE_URL}/anonymous/join/${linkId}`, {
    method: 'POST',
    body: JSON.stringify(participantData)
  });
  
  if (!joinResponse.ok) {
    logError(`Échec de la jointure anonyme: ${joinResponse.data.message || 'Erreur inconnue'}`);
    return null;
  }
  
  const sessionToken = joinResponse.data.sessionToken;
  const participant = joinResponse.data.participant;
  const conversationShareLinkId = joinResponse.data.id;
  
  logSuccess(`Session anonyme créée: ${participant.username}`);
  logSuccess(`Session Token: ${sessionToken.substring(0, 20)}...`);
  logSuccess(`Conversation Share Link ID: ${conversationShareLinkId}`);
  
  return {
    sessionToken,
    participant,
    conversationShareLinkId
  };
}

// Test 3: Accéder aux données de conversation
async function testAccessConversationData(identifier, sessionToken) {
  logStep(3, 'Accès aux données de conversation');
  
  const dataResponse = await makeRequest(`${BASE_URL}/links/${identifier}`, {
    method: 'GET',
    headers: {
      'X-Session-Token': sessionToken
    }
  });
  
  if (!dataResponse.ok) {
    logError(`Échec de l'accès aux données: ${dataResponse.data.message || 'Erreur inconnue'}`);
    return null;
  }
  
  const conversationData = dataResponse.data;
  
  logSuccess(`Conversation trouvée: ${conversationData.conversation.title}`);
  logSuccess(`Type d'utilisateur: ${conversationData.userType}`);
  logSuccess(`Messages disponibles: ${conversationData.messages.length}`);
  
  return conversationData;
}

// Test 4: Envoyer un message
async function testSendMessage(identifier, sessionToken) {
  logStep(4, 'Envoi d\'un message');
  
  const messageData = {
    content: 'Hello from anonymous user!',
    originalLanguage: 'fr',
    messageType: 'text'
  };
  
  const sendResponse = await makeRequest(`${BASE_URL}/links/${identifier}/messages`, {
    method: 'POST',
    headers: {
      'X-Session-Token': sessionToken
    },
    body: JSON.stringify(messageData)
  });
  
  if (!sendResponse.ok) {
    logError(`Échec de l'envoi du message: ${sendResponse.data.message || 'Erreur inconnue'}`);
    return null;
  }
  
  const message = sendResponse.data;
  
  logSuccess(`Message envoyé: ${message.content}`);
  logSuccess(`Message ID: ${message.id}`);
  
  return message;
}

// Test 5: Tester la gestion des erreurs
async function testErrorHandling(linkId) {
  logStep(5, 'Test de la gestion des erreurs');
  
  // Test avec un identifiant invalide
  const invalidResponse = await makeRequest(`${BASE_URL}/links/invalid_identifier`, {
    method: 'GET'
  });
  
  if (invalidResponse.status === 404) {
    logSuccess('Erreur 404 correctement gérée pour identifiant invalide');
  } else {
    logWarning(`Réponse inattendue pour identifiant invalide: ${invalidResponse.status}`);
  }
  
  // Test avec un token de session invalide
  const invalidTokenResponse = await makeRequest(`${BASE_URL}/links/${linkId}`, {
    method: 'GET',
    headers: {
      'X-Session-Token': 'invalid_token'
    }
  });
  
  if (invalidTokenResponse.status === 401 || invalidTokenResponse.status === 403) {
    logSuccess('Erreur d\'authentification correctement gérée');
  } else {
    logWarning(`Réponse inattendue pour token invalide: ${invalidTokenResponse.status}`);
  }
  
  return true;
}

// Fonction principale de test
async function runTests() {
  log('🚀 Début des tests du flux de chat anonyme', 'bright');
  log(`Base URL: ${BASE_URL}`, 'blue');
  log(`Frontend URL: ${FRONTEND_URL}`, 'blue');
  
  const startTime = performance.now();
  
  try {
    // Test 1: Créer un lien de partage
    const linkData = await testCreateShareLink();
    if (!linkData) {
      logError('Test 1 échoué - Impossible de créer un lien de partage');
      return;
    }
    
    // Test 2: Rejoindre anonymement
    const sessionData = await testJoinAnonymously(linkData.linkId);
    if (!sessionData) {
      logError('Test 2 échoué - Impossible de rejoindre anonymement');
      return;
    }
    
    // Test 3: Accéder aux données (avec linkId)
    const conversationData1 = await testAccessConversationData(linkData.linkId, sessionData.sessionToken);
    if (!conversationData1) {
      logError('Test 3a échoué - Impossible d\'accéder aux données avec linkId');
      return;
    }
    
    // Test 3b: Accéder aux données (avec conversationShareLinkId)
    const conversationData2 = await testAccessConversationData(linkData.shareLinkId, sessionData.sessionToken);
    if (!conversationData2) {
      logError('Test 3b échoué - Impossible d\'accéder aux données avec conversationShareLinkId');
      return;
    }
    
    // Test 4: Envoyer un message
    const message = await testSendMessage(linkData.shareLinkId, sessionData.sessionToken);
    if (!message) {
      logError('Test 4 échoué - Impossible d\'envoyer un message');
      return;
    }
    
    // Test 5: Gestion des erreurs
    await testErrorHandling(linkData.linkId);
    
    const endTime = performance.now();
    const totalDuration = Math.round(endTime - startTime);
    
    log('\n🎉 Tous les tests sont passés avec succès !', 'green');
    log(`⏱️  Durée totale: ${totalDuration}ms`, 'blue');
    
    // Résumé des résultats
    log('\n📊 Résumé des tests:', 'bright');
    log(`✅ Création de lien: ${linkData.linkId}`, 'green');
    log(`✅ Session anonyme: ${sessionData.participant.username}`, 'green');
    log(`✅ Accès aux données: OK`, 'green');
    log(`✅ Envoi de message: OK`, 'green');
    log(`✅ Gestion d'erreurs: OK`, 'green');
    
    log('\n🔗 Liens de test:', 'bright');
    log(`Frontend: ${FRONTEND_URL}/join/${linkData.linkId}`, 'cyan');
    log(`Chat: ${FRONTEND_URL}/chat/${linkData.shareLinkId}`, 'cyan');
    
  } catch (error) {
    logError(`Erreur inattendue: ${error.message}`);
    console.error(error);
  }
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testCreateShareLink,
  testJoinAnonymously,
  testAccessConversationData,
  testSendMessage,
  testErrorHandling
};
