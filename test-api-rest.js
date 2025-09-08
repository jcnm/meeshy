#!/usr/bin/env node

/**
 * Script de test pour l'API REST de traduction
 * Teste la communication ZMQ entre Gateway et Translator
 */

const https = require('https');
const config = require('./test-config');

// Configuration depuis le fichier centralisé
const GATEWAY_URL = config.gateway.url;
const JWT_TOKEN = config.auth.jwtToken;
const CONVERSATION_ID = config.conversations.meeshy.id;

// Fonction pour faire une requête HTTPS
function makeRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const jsonBody = JSON.parse(body);
                    resolve({ status: res.statusCode, data: jsonBody });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Test de l'API de traduction
async function testTranslationAPI() {
    console.log('🧪 Test de l\'API REST de traduction...\n');

    const testCases = [
        {
            name: 'Traduction EN → FR',
            text: 'Hello world from REST API test',
            sourceLanguage: 'en',
            targetLanguage: 'fr'
        },
        {
            name: 'Traduction EN → ES',
            text: 'Good morning, how are you?',
            sourceLanguage: 'en',
            targetLanguage: 'es'
        },
        {
            name: 'Traduction FR → EN',
            text: 'Bonjour, comment allez-vous?',
            sourceLanguage: 'fr',
            targetLanguage: 'en'
        }
    ];

    for (const testCase of testCases) {
        console.log(`📝 Test: ${testCase.name}`);
        console.log(`   Texte: "${testCase.text}"`);
        console.log(`   Langue: ${testCase.sourceLanguage} → ${testCase.targetLanguage}`);

        try {
            const startTime = Date.now();
            
            const response = await makeRequest(`${GATEWAY_URL}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${JWT_TOKEN}`
                },
                rejectUnauthorized: config.https.rejectUnauthorized
            }, {
                text: testCase.text,
                source_language: testCase.sourceLanguage,
                target_language: testCase.targetLanguage,
                conversation_id: CONVERSATION_ID
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            if (response.status === 200 && response.data.success) {
                const result = response.data.data;
                console.log(`   ✅ Succès (${duration}ms)`);
                console.log(`   📄 Traduit: "${result.translated_text}"`);
                console.log(`   🎯 Confiance: ${result.confidence}`);
                console.log(`   🤖 Modèle: ${result.model_used}`);
                console.log(`   ⏱️  Temps ML: ${result.processing_time}s`);
                
                // Vérifier que c'est bien une traduction ZMQ (pas fallback)
                if (result.confidence > 0.9 && result.model_used !== 'fallback') {
                    console.log(`   🚀 Communication ZMQ: ✅`);
                } else {
                    console.log(`   ⚠️  Mode fallback détecté`);
                }
            } else {
                console.log(`   ❌ Erreur (${response.status}):`, response.data);
            }
        } catch (error) {
            console.log(`   ❌ Exception:`, error.message);
        }

        console.log(''); // Ligne vide
    }
}

// Test de l'endpoint d'information
async function testInfoEndpoint() {
    console.log('📊 Test de l\'endpoint d\'information...\n');

    try {
        const response = await makeRequest(`${GATEWAY_URL}/info`, {
            method: 'GET',
                rejectUnauthorized: config.https.rejectUnauthorized
        });

        if (response.status === 200) {
            const info = response.data;
            console.log('✅ Endpoint /info accessible');
            console.log(`   📋 Nom: ${info.name}`);
            console.log(`   🔢 Version: ${info.version}`);
            console.log(`   🌍 Environnement: ${info.environment}`);
            console.log(`   🏗️  Architecture: ${JSON.stringify(info.architecture, null, 2)}`);
            console.log(`   🔗 Endpoints: ${JSON.stringify(info.endpoints, null, 2)}`);
            console.log(`   🌐 Langues supportées: ${info.supportedLanguages.join(', ')}`);
        } else {
            console.log(`❌ Erreur (${response.status}):`, response.data);
        }
    } catch (error) {
        console.log(`❌ Exception:`, error.message);
    }

    console.log('');
}

// Test de l'endpoint de santé
async function testHealthEndpoint() {
    console.log('🏥 Test de l\'endpoint de santé...\n');

    try {
        const response = await makeRequest(`${GATEWAY_URL}/health`, {
            method: 'GET',
                rejectUnauthorized: config.https.rejectUnauthorized
        });

        if (response.status === 200) {
            const health = response.data;
            console.log('✅ Endpoint /health accessible');
            console.log(`   📊 Statut: ${health.status}`);
            console.log(`   🕐 Timestamp: ${health.timestamp}`);
            console.log(`   🌍 Environnement: ${health.environment}`);
            console.log(`   🔢 Version: ${health.version}`);
            console.log(`   ⏱️  Uptime: ${health.uptime}s`);
            console.log(`   🏥 Services:`);
            Object.entries(health.services).forEach(([service, status]) => {
                console.log(`      - ${service}: ${status.status}`);
            });
        } else {
            console.log(`❌ Erreur (${response.status}):`, response.data);
        }
    } catch (error) {
        console.log(`❌ Exception:`, error.message);
    }

    console.log('');
}

// Fonction principale
async function main() {
    console.log('🚀 Test de l\'API REST Meeshy');
    console.log('================================\n');

    await testInfoEndpoint();
    await testHealthEndpoint();
    await testTranslationAPI();

    console.log('✅ Tests terminés');
}

// Exécution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testTranslationAPI, testInfoEndpoint, testHealthEndpoint };
