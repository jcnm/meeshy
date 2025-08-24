#!/usr/bin/env node

/**
 * Script de test pour simuler la requête de traduction du frontend
 */

const axios = require('axios');

async function testTranslationRequest() {
  try {
    console.log('🧪 Test de requête de traduction...\n');
    
    // Utiliser un message qui existe dans la base (d'après le diagnostic précédent)
    const messageId = 'cmepp9c6y000hs9nlyqnvab75'; // "Je suis Français..."
    const targetLanguage = 'es';
    
    console.log(`📤 Envoi de la requête de traduction:`);
    console.log(`   Message ID: ${messageId}`);
    console.log(`   Langue cible: ${targetLanguage}`);
    console.log(`   URL: http://localhost:3001/translate`);
    console.log('');
    
    const requestBody = {
      message_id: messageId,
      target_language: targetLanguage,
      model_type: 'basic'
    };
    
    console.log('📋 Corps de la requête:', JSON.stringify(requestBody, null, 2));
    console.log('');
    
    const response = await axios.post('http://localhost:3001/translate', requestBody, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Réponse reçue:');
    console.log('   Status:', response.status);
    console.log('   Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur lors du test:');
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   Erreur de connexion:', error.message);
    } else {
      console.error('   Erreur:', error.message);
    }
  }
}

// Exécuter le test
testTranslationRequest().catch(console.error);
