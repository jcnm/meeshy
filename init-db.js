const { PrismaClient } = require('./shared/prisma/client');
const prisma = new PrismaClient();

async function initDatabase() {
  try {
    console.log('🔧 Initialisation de la base de données...');
    
    // Vérifier si des utilisateurs existent déjà
    const userCount = await prisma.user.count();
    console.log(`📊 Nombre d'utilisateurs existants: ${userCount}`);
    
    if (userCount === 0) {
      console.log('🚀 Création des utilisateurs par défaut...');
      
      // Créer l'utilisateur atabeth
      const atabeth = await prisma.user.create({
        data: {
          username: 'atabeth',
          email: 'atabeth@meeshy.me',
          password: 'IUaAasGtFD8QrXixxdWz',
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('✅ Utilisateur atabeth créé:', atabeth.id);
      
      // Créer l'utilisateur admin
      const admin = await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@meeshy.me',
          password: 'admin123',
          role: 'ADMIN',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('✅ Utilisateur admin créé:', admin.id);
      
      // Créer l'utilisateur meeshy
      const meeshy = await prisma.user.create({
        data: {
          username: 'meeshy',
          email: 'meeshy@meeshy.me',
          password: 'meeshy123',
          role: 'BIGBOSS',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('✅ Utilisateur meeshy créé:', meeshy.id);
      
      // Créer la conversation globale meeshy
      const globalConversation = await prisma.conversation.create({
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
      console.log('✅ Conversation globale meeshy créée:', globalConversation.id);
      
      // Ajouter tous les utilisateurs à la conversation meeshy
      const users = [atabeth, admin, meeshy];
      for (const user of users) {
        const role = user.username === 'meeshy' ? 'CREATOR' :
                    user.username === 'admin' ? 'ADMIN' : 'MEMBER';
        
        await prisma.conversationMember.create({
          data: {
            conversationId: globalConversation.id,
            userId: user.id,
            role: role,
            joinedAt: new Date(),
            isActive: true
          }
        });
        console.log(`✅ Utilisateur ${user.username} ajouté à la conversation meeshy avec le rôle ${role}`);
      }
      
      console.log('🎉 Initialisation terminée avec succès !');
    } else {
      console.log('ℹ️ La base de données contient déjà des utilisateurs');
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initDatabase();
