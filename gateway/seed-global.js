const { PrismaClient } = require('../shared/prisma/prisma/client');
const prisma = new PrismaClient();

async function createGlobalConversation() {
  try {
    // Créer la conversation globale si elle n'existe pas
    const globalConv = await prisma.conversation.upsert({
      where: { id: 'any' },
      update: {},
      create: {
        id: 'any',
        type: 'global',
        title: 'Meeshy',
        description: 'Conversation globale pour tous les utilisateurs'
      }
    });
    
    console.log('✅ Conversation globale créée:', globalConv);
    
    // Vérifier les tables
    const conversations = await prisma.conversation.findMany();
    console.log('📋 Toutes les conversations:', conversations);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createGlobalConversation();
