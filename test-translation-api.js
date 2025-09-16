#!/usr/bin/env node

/**
 * Test des traductions via API REST
 */

const fetch = require('node-fetch');

const GATEWAY_URL = 'http://localhost:3000';
const CONVERSATION_ID = 'mshy_meeshy-20250115050701';

async function testTranslationAPI() {
    console.log('🚀 Test des traductions via API REST');
    console.log('='.repeat(60));
    
    try {
        // 1. Envoyer un message via API REST
        console.log('📝 Envoi d\'un message de test...');
        
        const messageData = {
            conversationId: CONVERSATION_ID,
            content: 'Test de traduction API - ' + new Date().toISOString(),
            originalLanguage: 'fr',
            messageType: 'text'
        };
        
        const sendResponse = await fetch(`${GATEWAY_URL}/conversations/${CONVERSATION_ID}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        });
        
        const sendResult = await sendResponse.json();
        console.log('📨 Réponse envoi message:', sendResult);
        
        if (!sendResult.success || !sendResult.data?.id) {
            console.error('❌ Erreur envoi message:', sendResult.error);
            return;
        }
        
        const messageId = sendResult.data.id;
        console.log('✅ Message envoyé, ID:', messageId);
        
        // 2. Attendre un peu pour les traductions asynchrones
        console.log('⏳ Attente des traductions asynchrones...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 3. Récupérer le message avec ses traductions
        console.log('📖 Récupération du message avec traductions...');
        
        const getResponse = await fetch(`${GATEWAY_URL}/conversations/${CONVERSATION_ID}/messages`);
        const getResult = await getResponse.json();
        
        if (!getResult.success) {
            console.error('❌ Erreur récupération messages:', getResult.error);
            return;
        }
        
        // Trouver notre message
        const ourMessage = getResult.data.find(msg => msg.id === messageId);
        
        if (!ourMessage) {
            console.error('❌ Message non trouvé dans la liste');
            return;
        }
        
        console.log('✅ Message récupéré:');
        console.log('  ID:', ourMessage.id);
        console.log('  Contenu:', ourMessage.content);
        console.log('  Langue originale:', ourMessage.originalLanguage);
        console.log('  Traductions:', ourMessage.translations?.length || 0);
        
        if (ourMessage.translations && ourMessage.translations.length > 0) {
            console.log('  📋 Détail des traductions:');
            ourMessage.translations.forEach((t, i) => {
                console.log(`    ${i + 1}. ${t.targetLanguage}: "${t.translatedContent}"`);
                console.log(`       Modèle: ${t.translationModel}, Confiance: ${t.confidenceScore}`);
            });
        } else {
            console.log('  ⚠️ Aucune traduction trouvée');
        }
        
        // 4. Test de traduction manuelle
        console.log('\n🌐 Test de traduction manuelle...');
        
        const translateResponse = await fetch(`${GATEWAY_URL}/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message_id: messageId,
                target_language: 'en',
                model_type: 'medium'
            })
        });
        
        const translateResult = await translateResponse.json();
        console.log('🌐 Résultat traduction manuelle:', translateResult);
        
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
}

testTranslationAPI();