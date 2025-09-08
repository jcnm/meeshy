#!/usr/bin/env node

/**
 * Script de nettoyage des messages de test de la base de données de production
 * Supprime les messages créés lors des tests de communication ZMQ
 */

const { PrismaClient } = require('@prisma/client');

async function cleanupTestMessages() {
    console.log('🧹 Nettoyage des messages de test de la base de données...\n');

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL || 'mongodb://localhost:27017/meeshy'
            }
        }
    });

    try {
        // Messages de test à supprimer (basés sur les tests effectués)
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
        const testMessages = await prisma.message.findMany({
            where: {
                OR: testMessagePatterns.map(pattern => ({
                    content: {
                        contains: pattern,
                        mode: 'insensitive'
                    }
                }))
            },
            include: {
                translations: true
            }
        });

        console.log(`📊 ${testMessages.length} messages de test trouvés`);

        if (testMessages.length === 0) {
            console.log('✅ Aucun message de test à supprimer');
            return;
        }

        // Afficher les messages trouvés
        console.log('\n📝 Messages de test trouvés:');
        testMessages.forEach((message, index) => {
            console.log(`   ${index + 1}. ID: ${message.id}`);
            console.log(`      Contenu: "${message.content}"`);
            console.log(`      Créé: ${message.createdAt}`);
            console.log(`      Traductions: ${message.translations.length}`);
            console.log('');
        });

        // Supprimer les traductions associées
        console.log('🗑️  Suppression des traductions associées...');
        let deletedTranslations = 0;
        
        for (const message of testMessages) {
            if (message.translations.length > 0) {
                const result = await prisma.messageTranslation.deleteMany({
                    where: {
                        messageId: message.id
                    }
                });
                deletedTranslations += result.count;
                console.log(`   ✅ ${result.count} traductions supprimées pour le message ${message.id}`);
            }
        }

        // Supprimer les messages
        console.log('\n🗑️  Suppression des messages de test...');
        const deletedMessages = await prisma.message.deleteMany({
            where: {
                OR: testMessagePatterns.map(pattern => ({
                    content: {
                        contains: pattern,
                        mode: 'insensitive'
                    }
                }))
            }
        });

        console.log(`✅ ${deletedMessages.count} messages supprimés`);
        console.log(`✅ ${deletedTranslations} traductions supprimées`);

        // Vérification finale
        console.log('\n🔍 Vérification finale...');
        const remainingTestMessages = await prisma.message.findMany({
            where: {
                OR: testMessagePatterns.map(pattern => ({
                    content: {
                        contains: pattern,
                        mode: 'insensitive'
                    }
                }))
            }
        });

        if (remainingTestMessages.length === 0) {
            console.log('✅ Nettoyage terminé avec succès - Aucun message de test restant');
        } else {
            console.log(`⚠️  ${remainingTestMessages.length} messages de test restants`);
        }

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Fonction pour lister les messages récents (pour vérification)
async function listRecentMessages() {
    console.log('📋 Liste des messages récents (derniers 10)...\n');

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL || 'mongodb://localhost:27017/meeshy'
            }
        }
    });

    try {
        const recentMessages = await prisma.message.findMany({
            take: 10,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                translations: true,
                user: {
                    select: {
                        username: true
                    }
                }
            }
        });

        if (recentMessages.length === 0) {
            console.log('📭 Aucun message trouvé');
            return;
        }

        recentMessages.forEach((message, index) => {
            console.log(`${index + 1}. ID: ${message.id}`);
            console.log(`   Utilisateur: ${message.user?.username || 'Anonyme'}`);
            console.log(`   Contenu: "${message.content}"`);
            console.log(`   Créé: ${message.createdAt}`);
            console.log(`   Traductions: ${message.translations.length}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Erreur lors de la récupération des messages:', error);
    } finally {
        await prisma.$disconnect();
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
