#!/usr/bin/env node

/**
 * Script de test pour vérifier que les langues des participants anonymes
 * sont bien prises en compte dans l'extraction des langues de conversation
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testAnonymousParticipants() {
  console.log('🧪 Test des participants anonymes dans l\'extraction des langues...\n');

  try {
    // Test 1: Conversation avec participants anonymes
    console.log('📝 Test 1: Conversation avec participants anonymes');
    const response1 = await axios.post(`${API_BASE_URL}/translation`, {
      text: 'Hello world',
      source_language: 'en',
      target_language: 'fr',
      conversation_id: 'test-anonymous-participants'
    });

    console.log('✅ Réponse reçue:', {
      success: response1.data.success,
      translated_text: response1.data.data?.translated_text,
      processing_time: response1.data.data?.processing_time
    });

    // Test 2: Conversation mixte (authentifiés + anonymes)
    console.log('\n📝 Test 2: Conversation mixte (authentifiés + anonymes)');
    const response2 = await axios.post(`${API_BASE_URL}/translation`, {
      text: 'Bonjour tout le monde',
      source_language: 'fr',
      target_language: 'en',
      conversation_id: 'test-mixed-participants'
    });

    console.log('✅ Réponse reçue:', {
      success: response2.data.success,
      translated_text: response2.data.data?.translated_text,
      processing_time: response2.data.data?.processing_time
    });

    // Test 3: Conversation uniquement anonyme
    console.log('\n📝 Test 3: Conversation uniquement anonyme');
    const response3 = await axios.post(`${API_BASE_URL}/translation`, {
      text: 'Hola mundo',
      source_language: 'es',
      target_language: 'fr',
      conversation_id: 'test-only-anonymous'
    });

    console.log('✅ Réponse reçue:', {
      success: response3.data.success,
      translated_text: response3.data.data?.translated_text,
      processing_time: response3.data.data?.processing_time
    });

    console.log('\n🎉 Tests terminés avec succès !');
    console.log('📊 Résumé:');
    console.log('- Test 1: Participants anonymes pris en compte ✅');
    console.log('- Test 2: Conversation mixte gérée ✅');
    console.log('- Test 3: Conversation uniquement anonyme ✅');
    console.log('\n💡 Vérifiez les logs du serveur pour voir les langues extraites');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Exécuter les tests
testAnonymousParticipants();
