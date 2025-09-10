#!/usr/bin/env node

/**
 * Script pour tester la route PATCH /links/:linkId
 */

const fetch = require('node-fetch');

async function testLinksPatch() {
  console.log('🧪 Test de la route PATCH /links/:linkId...\n');
  
  const baseUrl = 'http://localhost:3100';
  
  // Vous devrez remplacer ces valeurs par des vraies valeurs de test
  const testLinkId = 'mshy_68bda3fd2150b366cbd676a2.2509071725_ikeko4jf';
  const testToken = 'your-test-token-here';
  
  try {
    // Test 1: Vérifier que la route existe (devrait retourner 401 sans token)
    console.log('📋 Test 1: Vérification de l\'existence de la route...');
    const response1 = await fetch(`${baseUrl}/links/${testLinkId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Link Update'
      })
    });
    
    console.log(`   Status: ${response1.status}`);
    if (response1.status === 401) {
      console.log('   ✅ Route trouvée (401 Unauthorized comme attendu)');
    } else if (response1.status === 404) {
      console.log('   ❌ Route non trouvée (404 Not Found)');
    } else {
      console.log(`   ⚠️  Status inattendu: ${response1.status}`);
    }
    
    // Test 2: Vérifier la structure de la réponse d'erreur
    if (response1.status === 401) {
      const errorData = await response1.json();
      console.log('   Réponse d\'erreur:', JSON.stringify(errorData, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
  
  console.log('\n📋 Test 2: Vérification des routes disponibles...');
  try {
    // Test simple pour vérifier que le serveur répond
    const healthResponse = await fetch(`${baseUrl}/health`);
    console.log(`   Health check status: ${healthResponse.status}`);
  } catch (error) {
    console.error('   ❌ Serveur non accessible:', error.message);
  }
}

// Exécuter le test
if (require.main === module) {
  testLinksPatch();
}

module.exports = { testLinksPatch };
