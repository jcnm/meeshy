#!/usr/bin/env node

/**
 * Script de diagnostic pour tester le chargement des traductions
 * Vérifie si les traductions sont bien présentes dans la base de données
 * et si elles sont correctement chargées par l'API
 */

const { PrismaClient } = require('../shared/prisma/client');

async function testTranslationLoading() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Diagnostic du chargement des traductions...\n');
    
    // 1. Vérifier les messages avec traductions dans la base
    console.log('1️⃣ Vérification des messages avec traductions dans la base de données:');
    const messagesWithTranslations = await prisma.message.findMany({
      where: {
        translations: {
          some: {}
        }
      },
      include: {
        translations: {
          select: {
            id: true,
            targetLanguage: true,
            translatedContent: true,
            translationModel: true,
            createdAt: true
          }
        },
        sender: {
          select: {
            id: true,
            username: true
          }
        }
      },
      take: 5
    });
    
    console.log(`   📊 ${messagesWithTranslations.length} messages avec traductions trouvés`);
    
    messagesWithTranslations.forEach((msg, index) => {
      console.log(`   📝 Message ${index + 1}:`);
      console.log(`      ID: ${msg.id}`);
      console.log(`      Conversation: ${msg.conversationId}`);
      console.log(`      Contenu: ${msg.content.substring(0, 50)}...`);
      console.log(`      Langue originale: ${msg.originalLanguage}`);
      console.log(`      Expéditeur: ${msg.sender?.username || 'Anonyme'}`);
      console.log(`      Traductions: ${msg.translations.length}`);
      msg.translations.forEach(t => {
        console.log(`        - ${t.targetLanguage}: ${t.translatedContent.substring(0, 30)}...`);
      });
      console.log('');
    });
    
    // 2. Vérifier les traductions orphelines
    console.log('2️⃣ Vérification des traductions orphelines:');
    const orphanTranslations = await prisma.messageTranslation.findMany({
      where: {
        messageId: {
          notIn: (await prisma.message.findMany({ select: { id: true } })).map(m => m.id)
        }
      }
    });
    
    console.log(`   📊 ${orphanTranslations.length} traductions orphelines trouvées`);
    
    // 3. Statistiques générales
    console.log('3️⃣ Statistiques générales:');
    const totalMessages = await prisma.message.count();
    const totalTranslations = await prisma.messageTranslation.count();
    const messagesWithAnyTranslation = await prisma.message.count({
      where: {
        translations: {
          some: {}
        }
      }
    });
    
    console.log(`   📊 Total messages: ${totalMessages}`);
    console.log(`   📊 Total traductions: ${totalTranslations}`);
    console.log(`   📊 Messages avec traductions: ${messagesWithAnyTranslation}`);
    console.log(`   📊 Ratio: ${((messagesWithAnyTranslation / totalMessages) * 100).toFixed(2)}%`);
    
    // 4. Test de l'API de chargement des messages
    console.log('\n4️⃣ Test de l\'API de chargement des messages:');
    
    // Simuler une requête à l'API
    const testMessages = await prisma.message.findMany({
      where: {
        isDeleted: false
      },
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
      take: 10
    });
    
    console.log(`   📊 ${testMessages.length} messages chargés via l'API simulée`);
    
    // Debug: Afficher les détails des premiers messages
    if (testMessages.length > 0) {
      console.log('   🔍 Détails des premiers messages:');
      testMessages.slice(0, 3).forEach((msg, index) => {
        console.log(`      Message ${index + 1}:`);
        console.log(`        ID: ${msg.id}`);
        console.log(`        Conversation: ${msg.conversationId}`);
        console.log(`        Contenu: ${msg.content.substring(0, 30)}...`);
        console.log(`        Traductions: ${msg.translations?.length || 0}`);
        if (msg.translations && msg.translations.length > 0) {
          msg.translations.forEach(t => {
            console.log(`          - ${t.targetLanguage}: ${t.translatedContent.substring(0, 20)}...`);
          });
        }
      });
    }
    
    const messagesWithApiTranslations = testMessages.filter(msg => msg.translations.length > 0);
    console.log(`   📊 ${messagesWithApiTranslations.length} messages avec traductions dans la réponse API`);
    
    if (messagesWithApiTranslations.length > 0) {
      console.log('   📝 Exemple de message avec traductions:');
      const example = messagesWithApiTranslations[0];
      console.log(`      ID: ${example.id}`);
      console.log(`      Contenu: ${example.content.substring(0, 50)}...`);
      console.log(`      Traductions API: ${example.translations.length}`);
      example.translations.forEach(t => {
        console.log(`        - ${t.targetLanguage}: ${t.translatedContent.substring(0, 30)}...`);
      });
    }
    
    // 5. Vérifier les langues de traduction
    console.log('\n5️⃣ Analyse des langues de traduction:');
    const languageStats = await prisma.messageTranslation.groupBy({
      by: ['targetLanguage'],
      _count: {
        targetLanguage: true
      },
      orderBy: {
        _count: {
          targetLanguage: 'desc'
        }
      }
    });
    
    console.log('   📊 Répartition par langue cible:');
    languageStats.forEach(stat => {
      console.log(`      ${stat.targetLanguage}: ${stat._count.targetLanguage} traductions`);
    });
    
    console.log('\n✅ Diagnostic terminé');
    
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le diagnostic
testTranslationLoading().catch(console.error);
