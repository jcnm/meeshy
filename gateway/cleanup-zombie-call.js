// Script pour nettoyer l'appel zombie
const { PrismaClient } = require('./shared/prisma/client');
const prisma = new PrismaClient();

async function cleanupZombieCall() {
  try {
    console.log('🔍 Recherche de l\'appel zombie...');

    const zombieCall = await prisma.callSession.findFirst({
      where: {
        conversationId: '68f363e590edd6635d292c87',
        status: {
          in: ['initiated', 'ringing', 'active']
        }
      }
    });

    if (!zombieCall) {
      console.log('✅ Aucun appel zombie trouvé');
      return;
    }

    console.log('🧟 Appel zombie trouvé:', zombieCall);

    // Marquer comme terminé
    await prisma.callSession.update({
      where: { id: zombieCall.id },
      data: {
        status: 'ended',
        endedAt: new Date(),
        duration: zombieCall.startedAt ? Math.floor((Date.now() - zombieCall.startedAt.getTime()) / 1000) : 0
      }
    });

    console.log('✅ Appel zombie nettoyé avec succès');
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupZombieCall();
