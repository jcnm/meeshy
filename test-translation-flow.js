#!/usr/bin/env node

/**
 * Script de test pour vérifier le flux complet des traductions
 * De la base de données jusqu'au frontend
 */

const { PrismaClient } = require('./shared/prisma/client');

async function testTranslationFlow() {
    console.log('🧪 Test du flux complet des traductions\n');

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL || 'file:./dev.db'
            }
        }
    });

    try {
        // 1. Vérifier les messages avec traductions dans la base
        console.log('1️⃣ Vérification des messages dans la base de données...');
        
        const messages = await prisma.message.findMany({
            take: 5,
            include: {
                translations: {
                    select: {
                        id: true,
                        targetLanguage: true,
                        translatedContent: true,
                        translationModel: true,
                        cacheKey: true,
                        confidenceScore: true,
                        sourceLanguage: true
                    }
                },
                sender: {
                    select: {
                        id: true,
                        username: true,
                        systemLanguage: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`📊 ${messages.length} messages trouvés dans la base`);
        
        messages.forEach((msg, index) => {
            console.log(`\n[${index + 1}] Message ${msg.id}:`);
            console.log(`  - Content: ${msg.content.substring(0, 50)}...`);
            console.log(`  - Original Language: ${msg.originalLanguage}`);
            console.log(`  - Sender: ${msg.sender?.username} (${msg.sender?.systemLanguage})`);
            console.log(`  - Translations: ${msg.translations.length}`);
            
            msg.translations.forEach((t, tIndex) => {
                console.log(`    [${tIndex}] ${t.sourceLanguage} → ${t.targetLanguage}: ${t.translatedContent.substring(0, 40)}...`);
                console.log(`        Model: ${t.translationModel}, Score: ${t.confidenceScore || 'N/A'}`);
            });
        });

        // 2. Simuler une requête API comme le frontend
        console.log('\n2️⃣ Simulation d\'une requête API frontend...');
        
        const conversationId = messages[0]?.conversationId;
        if (!conversationId) {
            console.log('❌ Aucune conversation trouvée');
            return;
        }

        // Requête identique à celle du frontend
        const apiMessages = await prisma.message.findMany({
            where: { conversationId },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        role: true
                    }
                },
                anonymousSender: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        language: true
                    }
                },
                readStatus: {
                    select: {
                        userId: true,
                        readAt: true
                    }
                },
                translations: {
                    select: {
                        id: true,
                        targetLanguage: true,
                        translatedContent: true,
                        translationModel: true,
                        cacheKey: true
                    }
                },
                replyTo: {
                    include: {
                        sender: {
                            select: {
                                id: true,
                                username: true,
                                displayName: true,
                                avatar: true
                            }
                        },
                        readStatus: {
                            select: {
                                userId: true,
                                readAt: true
                            }
                        },
                        translations: {
                            select: {
                                id: true,
                                targetLanguage: true,
                                translatedContent: true,
                                translationModel: true,
                                cacheKey: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            skip: 0
        });

        console.log(`📦 Format API: ${apiMessages.length} messages avec traductions`);
        
        apiMessages.slice(0, 3).forEach((msg, index) => {
            console.log(`\n[API-${index + 1}] Message ${msg.id}:`);
            console.log(`  - Content: ${msg.content.substring(0, 50)}...`);
            console.log(`  - Original Language: ${msg.originalLanguage}`);
            console.log(`  - API Translations: ${msg.translations.length}`);
            console.log(`  - Translation structure:`, msg.translations.map(t => ({
                targetLanguage: t.targetLanguage,
                contentPreview: t.translatedContent.substring(0, 30) + '...',
                model: t.translationModel
            })));
        });

        // 3. Vérifier la structure attendue par le frontend
        console.log('\n3️⃣ Vérification de la compatibilité frontend...');
        
        const frontendMessage = apiMessages[0];
        if (frontendMessage) {
            console.log('Structure message pour frontend:');
            console.log(`  - id: ${frontendMessage.id}`);
            console.log(`  - content: ${typeof frontendMessage.content}`);
            console.log(`  - originalLanguage: ${frontendMessage.originalLanguage}`);
            console.log(`  - translations: ${Array.isArray(frontendMessage.translations) ? 'ARRAY' : 'NOT_ARRAY'}`);
            console.log(`  - translations.length: ${frontendMessage.translations.length}`);
            
            if (frontendMessage.translations.length > 0) {
                const firstTranslation = frontendMessage.translations[0];
                console.log('  - Structure première traduction:');
                console.log(`    * targetLanguage: ${firstTranslation.targetLanguage}`);
                console.log(`    * translatedContent: ${typeof firstTranslation.translatedContent}`);
                console.log(`    * translationModel: ${firstTranslation.translationModel}`);
                console.log(`    * cacheKey: ${firstTranslation.cacheKey ? 'PRESENT' : 'MISSING'}`);
            }
        }

        console.log('\n✅ Test terminé avec succès');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Exécuter le test
testTranslationFlow().catch(console.error);