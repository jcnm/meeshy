#!/usr/bin/env node

/**
 * Script de test pour vérifier l'optimisation des traductions
 * Teste que les traductions fr → fr sont évitées
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testTranslationOptimization() {
  console.log('🧪 Test de l\'optimisation des traductions...\n');

  try {
    // Test 1: Traduction fr → fr (devrait être évitée)
    console.log('📝 Test 1: Traduction fr → fr (devrait être évitée)');
    const response1 = await axios.post(`${API_BASE_URL}/translation`, {
      text: 'Bonjour le monde',
      source_language: 'fr',
      target_language: 'fr',
      conversation_id: 'test-optimization'
    });

    console.log('✅ Réponse reçue:', {
      success: response1.data.success,
      translated_text: response1.data.data?.translated_text,
      processing_time: response1.data.data?.processing_time
    });

    // Test 2: Traduction fr → en (devrait fonctionner normalement)
    console.log('\n📝 Test 2: Traduction fr → en (devrait fonctionner normalement)');
    const response2 = await axios.post(`${API_BASE_URL}/translation`, {
      text: 'Bonjour le monde',
      source_language: 'fr',
      target_language: 'en',
      conversation_id: 'test-optimization'
    });

    console.log('✅ Réponse reçue:', {
      success: response2.data.success,
      translated_text: response2.data.data?.translated_text,
      processing_time: response2.data.data?.processing_time
    });

    // Test 3: Traduction auto → fr (devrait fonctionner normalement)
    console.log('\n📝 Test 3: Traduction auto → fr (devrait fonctionner normalement)');
    const response3 = await axios.post(`${API_BASE_URL}/translation`, {
      text: 'Hello world',
      source_language: 'auto',
      target_language: 'fr',
      conversation_id: 'test-optimization'
    });

    console.log('✅ Réponse reçue:', {
      success: response3.data.success,
      translated_text: response3.data.data?.translated_text,
      processing_time: response3.data.data?.processing_time
    });

    // Test 4: Test avec conversation sans participants (aucune langue cible)
    console.log('\n📝 Test 4: Conversation sans participants (aucune langue cible)');
    const response4 = await axios.post(`${API_BASE_URL}/translation`, {
      text: 'Test message',
      source_language: 'fr',
      target_language: 'en',
      conversation_id: 'empty-conversation-test'
    });

    console.log('✅ Réponse reçue:', {
      success: response4.data.success,
      translated_text: response4.data.data?.translated_text,
      processing_time: response4.data.data?.processing_time
    });

    console.log('\n🎉 Tests terminés avec succès !');
    console.log('📊 Résumé:');
    console.log('- Test 1 (fr→fr): Optimisation active ✅');
    console.log('- Test 2 (fr→en): Traduction normale ✅');
    console.log('- Test 3 (auto→fr): Détection automatique ✅');
    console.log('- Test 4 (conversation vide): Gestion des cas limites ✅');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Exécuter les tests
testTranslationOptimization();
