#!/usr/bin/env node

/**
 * Script de nettoyage des messages de test avec MongoDB direct
 * Supprime les messages créés lors des tests de communication ZMQ
 */

const { MongoClient } = require('mongodb');

async function cleanupTestMessages() {
    console.log('🧹 Nettoyage des messages de test de la base de données...\n');

    // URL de connexion MongoDB
    const mongoUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/meeshy';
    
    const client = new MongoClient(mongoUrl);

    try {
        await client.connect();
        console.log('✅ Connecté à MongoDB');

        const db = client.db('meeshy');
        const messagesCollection = db.collection('Message');
        const translationsCollection = db.collection('MessageTranslation');

        // Patterns de messages de test
        const testMessagePatterns = [
            'Hello world from REST API test',
            'Good morning, how are you?',
            'Bonjour, comment allez-vous?',
            'Hello world from WebSocket test',
            'This is a test message for ZMQ communication',
            'Ceci est un message de test pour la communication ZMQ',
            'Este es un mensaje de prueba para la comunicación ZMQ'
        ];

        console.log('🔍 Recherche des messages de test...');
        
        // Rechercher les messages correspondant aux patterns de test
        const testMessages = await messagesCollection.find({
            $or: testMessagePatterns.map(pattern => ({
                content: { $regex: pattern, $options: 'i' }
            }))
        }).toArray();

        console.log(`📊 ${testMessages.length} messages de test trouvés`);

        if (testMessages.length === 0) {
            console.log('✅ Aucun message de test à supprimer');
            return;
        }

        // Afficher les messages trouvés
        console.log('\n📝 Messages de test trouvés:');
        testMessages.forEach((message, index) => {
            console.log(`   ${index + 1}. ID: ${message._id}`);
            console.log(`      Contenu: "${message.content}"`);
            console.log(`      Créé: ${message.createdAt}`);
            console.log('');
        });

        // Supprimer les traductions associées
        console.log('🗑️  Suppression des traductions associées...');
        let deletedTranslations = 0;
        
        for (const message of testMessages) {
            const result = await translationsCollection.deleteMany({
                messageId: message._id
            });
            deletedTranslations += result.deletedCount;
            console.log(`   ✅ ${result.deletedCount} traductions supprimées pour le message ${message._id}`);
        }

        // Supprimer les messages
        console.log('\n🗑️  Suppression des messages de test...');
        const deletedMessages = await messagesCollection.deleteMany({
            $or: testMessagePatterns.map(pattern => ({
                content: { $regex: pattern, $options: 'i' }
            }))
        });

        console.log(`✅ ${deletedMessages.deletedCount} messages supprimés`);
        console.log(`✅ ${deletedTranslations} traductions supprimées`);

        // Vérification finale
        console.log('\n🔍 Vérification finale...');
        const remainingTestMessages = await messagesCollection.find({
            $or: testMessagePatterns.map(pattern => ({
                content: { $regex: pattern, $options: 'i' }
            }))
        }).toArray();

        if (remainingTestMessages.length === 0) {
            console.log('✅ Nettoyage terminé avec succès - Aucun message de test restant');
        } else {
            console.log(`⚠️  ${remainingTestMessages.length} messages de test restants`);
        }

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        throw error;
    } finally {
        await client.close();
    }
}

// Fonction pour lister les messages récents
async function listRecentMessages() {
    console.log('📋 Liste des messages récents (derniers 10)...\n');

    const mongoUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/meeshy';
    const client = new MongoClient(mongoUrl);

    try {
        await client.connect();
        const db = client.db('meeshy');
        const messagesCollection = db.collection('Message');

        const recentMessages = await messagesCollection.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();

        if (recentMessages.length === 0) {
            console.log('📭 Aucun message trouvé');
            return;
        }

        recentMessages.forEach((message, index) => {
            console.log(`${index + 1}. ID: ${message._id}`);
            console.log(`   Contenu: "${message.content}"`);
            console.log(`   Créé: ${message.createdAt}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Erreur lors de la récupération des messages:', error);
    } finally {
        await client.close();
    }
}

// Fonction principale
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--list') || args.includes('-l')) {
        await listRecentMessages();
    } else {
        await cleanupTestMessages();
    }
}

// Exécution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { cleanupTestMessages, listRecentMessages };
