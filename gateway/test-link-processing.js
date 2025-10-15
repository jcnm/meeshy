/**
 * Script de test pour vérifier le traitement des liens dans les messages
 */

const { PrismaClient } = require('../shared/prisma/client');
const { MessagingService } = require('./src/services/MessagingService');
const { TranslationService } = require('./src/services/TranslationService');

const prisma = new PrismaClient();

async function testLinkProcessing() {
  console.log('🧪 Test de traitement des liens dans les messages\n');

  try {
    const translationService = new TranslationService(prisma);
    const messagingService = new MessagingService(prisma, translationService);

    // 1. Trouver ou créer une conversation de test
    let conversation = await prisma.conversation.findFirst({
      where: { type: 'direct' }
    });

    if (!conversation) {
      console.log('❌ Aucune conversation trouvée. Créez une conversation d\'abord.');
      return;
    }

    console.log(`✅ Conversation trouvée: ${conversation.id}\n`);

    // 2. Trouver un utilisateur de test
    const user = await prisma.user.findFirst();
    
    if (!user) {
      console.log('❌ Aucun utilisateur trouvé.');
      return;
    }

    console.log(`✅ Utilisateur trouvé: ${user.username} (${user.id})\n`);

    // 3. Envoyer un message avec un lien
    const messageContent = 'Regarde ce site cool: https://www.example.com et aussi https://github.com/nodejs/node';
    
    console.log(`📝 Envoi du message: "${messageContent}"\n`);

    const request = {
      conversationId: conversation.id,
      content: messageContent,
      originalLanguage: 'fr',
      messageType: 'text'
    };

    const response = await messagingService.handleMessage(
      request,
      user.id,
      true
    );

    if (response.success && response.data) {
      console.log('✅ Message envoyé avec succès!\n');
      console.log(`📩 Message ID: ${response.data.id}`);
      console.log(`📝 Contenu original: ${messageContent}`);
      console.log(`🔗 Contenu modifié: ${response.data.content}\n`);

      // Vérifier si des liens de tracking ont été créés
      const trackingLinks = await prisma.trackingLink.findMany({
        where: { messageId: response.data.id }
      });

      if (trackingLinks.length > 0) {
        console.log(`✅ ${trackingLinks.length} lien(s) de tracking créé(s):\n`);
        trackingLinks.forEach((link, index) => {
          console.log(`   ${index + 1}. m+${link.token} → ${link.originalUrl}`);
        });
      } else {
        console.log('⚠️  Aucun lien de tracking créé.');
      }

      // Vérifier que le contenu a été modifié
      if (response.data.content.includes('m+')) {
        console.log('\n✅ Le contenu du message contient bien les liens Meeshy (m+)');
      } else {
        console.log('\n⚠️  Le contenu du message ne contient pas de liens Meeshy');
      }

    } else {
      console.log('❌ Erreur lors de l\'envoi du message:', response.error);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLinkProcessing();
