#!/usr/bin/env node

/**
 * Script de test complet pour Meeshy
 * Exécute tous les tests de communication ZMQ
 */

const { testTranslationAPI, testInfoEndpoint, testHealthEndpoint } = require('./test-api-rest');
const { testWebSocketCommunication } = require('./test-websocket');
const config = require('./test-config');

async function runCompleteTests() {
    console.log('🚀 Tests Complets Meeshy - Communication ZMQ');
    console.log('=============================================\n');

    const results = {
        info: false,
        health: false,
        api: false,
        websocket: false
    };

    try {
        // Test 1: Endpoint d'information
        console.log('📊 Test 1/4: Endpoint d\'information');
        console.log('-----------------------------------');
        await testInfoEndpoint();
        results.info = true;
        console.log('✅ Test d\'information: RÉUSSI\n');

        // Test 2: Endpoint de santé
        console.log('🏥 Test 2/4: Endpoint de santé');
        console.log('-----------------------------');
        await testHealthEndpoint();
        results.health = true;
        console.log('✅ Test de santé: RÉUSSI\n');

        // Test 3: API REST de traduction
        console.log('🧪 Test 3/4: API REST de traduction');
        console.log('-----------------------------------');
        await testTranslationAPI();
        results.api = true;
        console.log('✅ Test API REST: RÉUSSI\n');

        // Test 4: Communication WebSocket
        console.log('🔌 Test 4/4: Communication WebSocket');
        console.log('------------------------------------');
        await testWebSocketCommunication();
        results.websocket = true;
        console.log('✅ Test WebSocket: RÉUSSI\n');

    } catch (error) {
        console.error('❌ Erreur lors des tests:', error.message);
    }

    // Résumé des résultats
    console.log('📋 Résumé des Tests');
    console.log('===================');
    console.log(`📊 Endpoint d'information: ${results.info ? '✅ RÉUSSI' : '❌ ÉCHEC'}`);
    console.log(`🏥 Endpoint de santé: ${results.health ? '✅ RÉUSSI' : '❌ ÉCHEC'}`);
    console.log(`🧪 API REST de traduction: ${results.api ? '✅ RÉUSSI' : '❌ ÉCHEC'}`);
    console.log(`🔌 Communication WebSocket: ${results.websocket ? '✅ RÉUSSI' : '❌ ÉCHEC'}`);

    const successCount = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;

    console.log(`\n📈 Résultat Global: ${successCount}/${totalTests} tests réussis`);

    if (successCount === totalTests) {
        console.log('🎉 Tous les tests sont passés ! La communication ZMQ fonctionne parfaitement.');
        console.log('\n✅ Fonctionnalités validées:');
        console.log('   - Communication ZMQ Gateway ↔ Translator');
        console.log('   - Traduction ML en temps réel');
        console.log('   - API REST fonctionnelle');
        console.log('   - WebSocket avec traduction automatique');
        console.log('   - Confiance élevée (>0.9)');
        console.log('   - Modèle ML (pas de fallback)');
    } else {
        console.log('⚠️  Certains tests ont échoué. Vérifiez la configuration.');
        process.exit(1);
    }
}

// Fonction pour tester la connectivité réseau
async function testNetworkConnectivity() {
    console.log('🌐 Test de connectivité réseau...\n');
    
    const https = require('https');
    
    try {
        const response = await new Promise((resolve, reject) => {
            const req = https.request(`${config.gateway.url}/health`, {
                method: 'GET',
                rejectUnauthorized: config.https.rejectUnauthorized,
                timeout: 5000
            }, (res) => {
                resolve(res.statusCode);
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Timeout')));
            req.end();
        });

        if (response === 200) {
            console.log('✅ Connectivité réseau: OK');
            return true;
        } else {
            console.log(`❌ Connectivité réseau: Erreur HTTP ${response}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Connectivité réseau: ${error.message}`);
        return false;
    }
}

// Fonction principale
async function main() {
    console.log('🔍 Vérification préliminaire...\n');
    
    const networkOk = await testNetworkConnectivity();
    if (!networkOk) {
        console.log('❌ Impossible de se connecter au serveur. Vérifiez:');
        console.log('   - La connectivité réseau');
        console.log('   - L\'état des services Docker');
        console.log('   - La configuration des domaines');
        process.exit(1);
    }

    console.log('\n🚀 Lancement des tests complets...\n');
    await runCompleteTests();
}

// Exécution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runCompleteTests, testNetworkConnectivity };
