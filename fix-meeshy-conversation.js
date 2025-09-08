const { PrismaClient } = require('./shared/prisma/client');
const prisma = new PrismaClient();

async function fixMeeshyConversation() {
  try {
    console.log('🔧 Correction de la conversation meeshy...');
    
    // Trouver l'utilisateur atabeth
    const atabeth = await prisma.user.findFirst({
      where: { username: 'atabeth' }
    });
    
    if (!atabeth) {
      console.log('❌ Utilisateur atabeth non trouvé');
      return;
    }
    
    console.log('✅ Utilisateur atabeth trouvé:', atabeth.id);
    
    // Vérifier si la conversation meeshy existe
    let meeshyConversation = await prisma.conversation.findFirst({
      where: { identifier: 'meeshy' }
    });
    
    if (!meeshyConversation) {
      console.log('🚀 Création de la conversation meeshy...');
      meeshyConversation = await prisma.conversation.create({
        data: {
          identifier: 'meeshy',
          name: 'Meeshy Global',
          description: 'Conversation globale Meeshy',
          type: 'GLOBAL',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('✅ Conversation meeshy créée:', meeshyConversation.id);
    } else {
      console.log('✅ Conversation meeshy trouvée:', meeshyConversation.id);
    }
    
    // Vérifier si atabeth est membre de la conversation meeshy
    const existingMember = await prisma.conversationMember.findFirst({
      where: {
        conversationId: meeshyConversation.id,
        userId: atabeth.id
      }
    });
    
    if (!existingMember) {
      console.log('🚀 Ajout d\'atabeth à la conversation meeshy...');
      await prisma.conversationMember.create({
        data: {
          conversationId: meeshyConversation.id,
          userId: atabeth.id,
          role: 'MEMBER',
          joinedAt: new Date(),
          isActive: true
        }
      });
      console.log('✅ Atabeth ajouté à la conversation meeshy');
    } else {
      console.log('✅ Atabeth est déjà membre de la conversation meeshy');
    }
    
    // Ajouter aussi admin et meeshy s'ils existent
    const admin = await prisma.user.findFirst({
      where: { username: 'admin' }
    });
    
    if (admin) {
      const adminMember = await prisma.conversationMember.findFirst({
        where: {
          conversationId: meeshyConversation.id,
          userId: admin.id
        }
      });
      
      if (!adminMember) {
        await prisma.conversationMember.create({
          data: {
            conversationId: meeshyConversation.id,
            userId: admin.id,
            role: 'ADMIN',
            joinedAt: new Date(),
            isActive: true
          }
        });
        console.log('✅ Admin ajouté à la conversation meeshy');
      }
    }
    
    const meeshyUser = await prisma.user.findFirst({
      where: { username: 'meeshy' }
    });
    
    if (meeshyUser) {
      const meeshyMember = await prisma.conversationMember.findFirst({
        where: {
          conversationId: meeshyConversation.id,
          userId: meeshyUser.id
        }
      });
      
      if (!meeshyMember) {
        await prisma.conversationMember.create({
          data: {
            conversationId: meeshyConversation.id,
            userId: meeshyUser.id,
            role: 'CREATOR',
            joinedAt: new Date(),
            isActive: true
          }
        });
        console.log('✅ Utilisateur meeshy ajouté à la conversation meeshy');
      }
    }
    
    console.log('🎉 Correction terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMeeshyConversation();
