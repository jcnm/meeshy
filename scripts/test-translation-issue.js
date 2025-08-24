#!/usr/bin/env node

/**
 * Script de test pour diagnostiquer le problème de traduction
 * Vérifie si les messages existent dans la base de données
 */

const { PrismaClient } = require('../gateway/shared/prisma/client');

async function testTranslationIssue() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Test de diagnostic du problème de traduction...\n');
    
    // 1. Vérifier la connexion à la base de données
    console.log('1️⃣ Test de connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connexion à la base de données réussie\n');
    
    // 2. Compter le nombre total de messages
    console.log('2️⃣ Statistiques des messages...');
    const totalMessages = await prisma.message.count();
    console.log(`📊 Total des messages en base: ${totalMessages}`);
    
    // 3. Récupérer les 5 derniers messages
    console.log('\n3️⃣ 5 derniers messages:');
    const recentMessages = await prisma.message.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        originalLanguage: true,
        conversationId: true,
        createdAt: true,
        senderId: true
      }
    });
    
    recentMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ID: ${msg.id}`);
      console.log(`      Contenu: ${msg.content.substring(0, 50)}...`);
      console.log(`      Langue: ${msg.originalLanguage}`);
      console.log(`      Conversation: ${msg.conversationId}`);
      console.log(`      Créé: ${msg.createdAt}`);
      console.log(`      Expéditeur: ${msg.senderId || 'Anonyme'}`);
      console.log('');
    });
    
    // 4. Vérifier les conversations
    console.log('4️⃣ Conversations disponibles:');
    const conversations = await prisma.conversation.findMany({
      take: 3,
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        title: true,
        lastMessageAt: true,
        _count: {
          select: { messages: true }
        }
      }
    });
    
    conversations.forEach((conv, index) => {
      console.log(`   ${index + 1}. ID: ${conv.id}`);
      console.log(`      Titre: ${conv.title || 'Sans titre'}`);
      console.log(`      Messages: ${conv._count.messages}`);
      console.log(`      Dernier message: ${conv.lastMessageAt}`);
      console.log('');
    });
    
    // 5. Vérifier les traductions existantes
    console.log('5️⃣ Traductions existantes:');
    const translations = await prisma.messageTranslation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        messageId: true,
        sourceLanguage: true,
        targetLanguage: true,
        translatedContent: true,
        createdAt: true
      }
    });
    
    if (translations.length === 0) {
      console.log('   Aucune traduction trouvée en base');
    } else {
      translations.forEach((trans, index) => {
        console.log(`   ${index + 1}. Message: ${trans.messageId}`);
        console.log(`      ${trans.sourceLanguage} → ${trans.targetLanguage}`);
        console.log(`      Contenu: ${trans.translatedContent.substring(0, 50)}...`);
        console.log(`      Créé: ${trans.createdAt}`);
        console.log('');
      });
    }
    
    // 6. Test avec un message spécifique (si disponible)
    if (recentMessages.length > 0) {
      const testMessageId = recentMessages[0].id;
      console.log(`6️⃣ Test de récupération du message ${testMessageId}...`);
      
      const testMessage = await prisma.message.findUnique({
        where: { id: testMessageId },
        include: {
          conversation: {
            include: {
              members: true
            }
          },
          translations: true
        }
      });
      
      if (testMessage) {
        console.log('✅ Message trouvé:');
        console.log(`   Contenu: ${testMessage.content}`);
        console.log(`   Langue: ${testMessage.originalLanguage}`);
        console.log(`   Conversation: ${testMessage.conversationId}`);
        console.log(`   Traductions: ${testMessage.translations.length}`);
        console.log(`   Membres de la conversation: ${testMessage.conversation.members.length}`);
      } else {
        console.log('❌ Message non trouvé');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testTranslationIssue().catch(console.error);
