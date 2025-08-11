#!/usr/bin/env node

/**
 * Test rapide d'envoi de message ZMQ au Gateway
 */

const { ZMQTranslationClient } = require('../gateway/src/services/zmq-translation-client');

async function testZMQDirect() {
    console.log('🧪 TEST DIRECT CLIENT ZMQ GATEWAY');
    console.log('================================');
    
    try {
        // Créer un client ZMQ similaire à celui utilisé par le Gateway
        const zmqClient = new ZMQTranslationClient();
        await zmqClient.initialize();
        
        console.log('✅ Client ZMQ initialisé');
        
        // Écouter les événements
        zmqClient.on('translationCompleted', (event) => {
            console.log('📥 Traduction reçue:', event);
        });
        
        zmqClient.on('translationError', (event) => {
            console.log('❌ Erreur reçue:', event);
        });
        
        // Envoyer une requête de traduction
        const request = {
            messageId: 'test-msg-123',
            text: 'Bonjour ZMQ !',
            sourceLanguage: 'fr',
            targetLanguages: ['en', 'es'],
            conversationId: 'test-conv-zmq',
            modelType: 'basic'
        };
        
        console.log('📤 Envoi requête ZMQ...');
        const taskId = await zmqClient.sendTranslationRequest(request);
        console.log(`✅ Requête envoyée avec taskId: ${taskId}`);
        
        // Attendre les résultats
        console.log('⏳ Attente des résultats...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        await zmqClient.close();
        
    } catch (error) {
        console.error('❌ Erreur test ZMQ:', error);
    }
}

testZMQDirect();
