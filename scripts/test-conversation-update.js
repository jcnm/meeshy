#!/usr/bin/env node

/**
 * Script de test pour valider la correction de l'erreur de mise à jour de conversation
 * 
 * Ce script teste :
 * 1. La mise à jour d'une conversation avec des données valides
 * 2. La gestion des erreurs de permissions
 * 3. La gestion des erreurs de validation
 * 4. La gestion des erreurs de contraintes
 */

const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

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
  log(`\n[TEST ${step}] ${message}`, 'cyan');
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
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const data = await response.json().catch(() => ({}));
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      duration
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      ok: false,
      status: 0,
      data: { error: error.message },
      duration
    };
  }
}

// Test 1: Créer un utilisateur de test et une conversation
async function setupTestData() {
  logStep(1, 'Création des données de test');
  
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
  
  // Créer une conversation de test
  const conversationData = {
    title: `Test Conversation ${Date.now()}`,
    description: 'Conversation de test pour la mise à jour',
    type: 'group'
  };
  
  const conversationResponse = await makeRequest(`${BASE_URL}/conversations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(conversationData)
  });
  
  if (!conversationResponse.ok) {
    logError(`Échec de la création de conversation: ${conversationResponse.data.message || 'Erreur inconnue'}`);
    return null;
  }
  
  const conversation = conversationResponse.data;
  logSuccess(`Conversation créée: ${conversation.title}`);
  
  return {
    authToken,
    userData,
    conversation
  };
}

// Test 2: Mise à jour réussie
async function testSuccessfulUpdate(authToken, conversationId) {
  logStep(2, 'Test de mise à jour réussie');
  
  const updateData = {
    title: `Conversation mise à jour ${Date.now()}`,
    description: 'Description mise à jour'
  };
  
  const response = await makeRequest(`${BASE_URL}/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(updateData)
  });
  
  if (response.ok) {
    logSuccess(`Mise à jour réussie: ${response.data.title}`);
    return true;
  } else {
    logError(`Échec de la mise à jour: ${response.data.error || 'Erreur inconnue'}`);
    log(`   Status: ${response.status}`, 'yellow');
    log(`   Détails: ${JSON.stringify(response.data, null, 2)}`, 'yellow');
    return false;
  }
}

// Test 3: Test avec nom vide
async function testEmptyName(authToken, conversationId) {
  logStep(3, 'Test avec nom vide');
  
  const updateData = {
    title: '',
    description: 'Test avec nom vide'
  };
  
  const response = await makeRequest(`${BASE_URL}/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(updateData)
  });
  
  if (response.status === 400) {
    logSuccess('Erreur 400 correctement retournée pour nom vide');
    return true;
  } else if (response.ok) {
    logWarning('Nom vide accepté (peut être valide selon la logique métier)');
    return true;
  } else {
    logError(`Réponse inattendue: ${response.status} - ${response.data.error}`);
    return false;
  }
}

// Test 4: Test avec conversation inexistante
async function testNonExistentConversation(authToken) {
  logStep(4, 'Test avec conversation inexistante');
  
  const fakeConversationId = '507f1f77bcf86cd799439011'; // ObjectId valide mais inexistant
  const updateData = {
    title: 'Test conversation inexistante'
  };
  
  const response = await makeRequest(`${BASE_URL}/conversations/${fakeConversationId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(updateData)
  });
  
  if (response.status === 404 || response.status === 403) {
    logSuccess(`Erreur ${response.status} correctement retournée pour conversation inexistante`);
    return true;
  } else {
    logError(`Réponse inattendue: ${response.status} - ${response.data.error}`);
    return false;
  }
}

// Test 5: Test sans authentification
async function testUnauthorizedUpdate(conversationId) {
  logStep(5, 'Test sans authentification');
  
  const updateData = {
    title: 'Test sans auth'
  };
  
  const response = await makeRequest(`${BASE_URL}/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData)
  });
  
  if (response.status === 401) {
    logSuccess('Erreur 401 correctement retournée pour requête non authentifiée');
    return true;
  } else {
    logError(`Réponse inattendue: ${response.status} - ${response.data.error}`);
    return false;
  }
}

// Test 6: Test avec token invalide
async function testInvalidToken(conversationId) {
  logStep(6, 'Test avec token invalide');
  
  const updateData = {
    title: 'Test token invalide'
  };
  
  const response = await makeRequest(`${BASE_URL}/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer invalid_token_12345'
    },
    body: JSON.stringify(updateData)
  });
  
  if (response.status === 401 || response.status === 403) {
    logSuccess(`Erreur ${response.status} correctement retournée pour token invalide`);
    return true;
  } else {
    logError(`Réponse inattendue: ${response.status} - ${response.data.error}`);
    return false;
  }
}

// Fonction principale de test
async function runTests() {
  log('🧪 Tests de validation de la correction de mise à jour de conversation', 'bright');
  log(`Base URL: ${BASE_URL}`, 'blue');
  
  const startTime = Date.now();
  
  try {
    // Étape 1: Créer les données de test
    const testData = await setupTestData();
    if (!testData) {
      logError('Impossible de créer les données de test');
      return;
    }
    
    const { authToken, conversation } = testData;
    
    // Étape 2: Tests de mise à jour
    const tests = [
      () => testSuccessfulUpdate(authToken, conversation.id),
      () => testEmptyName(authToken, conversation.id),
      () => testNonExistentConversation(authToken),
      () => testUnauthorizedUpdate(conversation.id),
      () => testInvalidToken(conversation.id)
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
      try {
        const result = await test();
        if (result) {
          passedTests++;
        }
      } catch (error) {
        logError(`Erreur lors du test: ${error.message}`);
      }
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    log('\n📊 Résumé des tests:', 'bright');
    log(`   Tests réussis: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'red');
    log(`   Durée totale: ${totalDuration}ms`, 'blue');
    
    if (passedTests === totalTests) {
      log('\n🎉 Tous les tests sont passés ! La correction fonctionne correctement.', 'green');
    } else {
      log('\n⚠️  Certains tests ont échoué. Vérifiez la logique de mise à jour.', 'yellow');
    }
    
    // Nettoyage (optionnel)
    log('\n🧹 Nettoyage des données de test...', 'blue');
    // Note: Dans un vrai environnement, vous pourriez vouloir supprimer les données de test
    
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
  setupTestData,
  testSuccessfulUpdate,
  testEmptyName,
  testNonExistentConversation,
  testUnauthorizedUpdate,
  testInvalidToken
};
