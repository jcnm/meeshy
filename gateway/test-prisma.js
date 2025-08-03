/**
 * Test simple du client Prisma 
 */

const { PrismaClient } = require('./libs');

async function testPrisma() {
  console.log('🔄 Test du client Prisma...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test de connexion - juste récupérer le nombre d'utilisateurs
    const userCount = await prisma.user.count();
    console.log(`✅ Connexion Prisma réussie - ${userCount} utilisateurs dans la DB`);
    
    // Test de structure - vérifier les modèles disponibles
    console.log('📊 Modèles Prisma disponibles:');
    console.log('- User:', typeof prisma.user);
    console.log('- Conversation:', typeof prisma.conversation);
    console.log('- Message:', typeof prisma.message);
    console.log('- MessageTranslation:', typeof prisma.messageTranslation);
    console.log('- ConversationMember:', typeof prisma.conversationMember);
    console.log('- Group:', typeof prisma.group);
    console.log('- FriendRequest:', typeof prisma.friendRequest);
    console.log('- Notification:', typeof prisma.notification);
    
    console.log('✅ Client Prisma fonctionne correctement !');
    
  } catch (error) {
    console.error('❌ Erreur Prisma:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();
