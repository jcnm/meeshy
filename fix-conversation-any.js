/**
 * Script pour corriger la conversation "any" en ajoutant tous les utilisateurs comme membres
 */

const { PrismaClient } = require('./shared/prisma/prisma/client');

const prisma = new PrismaClient();

async function fixConversationAny() {
  console.log('🔧 Correction de la conversation "any"...');

  try {
    // Vérifier si la conversation "any" existe
    const conversation = await prisma.conversation.findUnique({
      where: { id: 'any' }
    });

    if (!conversation) {
      console.log('❌ La conversation "any" n\'existe pas');
      return;
    }

    console.log('✅ Conversation "any" trouvée');

    // Récupérer tous les utilisateurs
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, username: true }
    });

    console.log(`👥 ${allUsers.length} utilisateurs trouvés`);

    // Vérifier les membres existants de la conversation "any"
    const existingMembers = await prisma.conversationMember.findMany({
      where: { conversationId: 'any' },
      include: { user: { select: { email: true, username: true } } }
    });

    console.log(`👤 ${existingMembers.length} membres actuels dans la conversation "any"`);

    // Trouver les utilisateurs qui ne sont pas encore membres
    const existingUserIds = new Set(existingMembers.map(m => m.userId));
    const usersToAdd = allUsers.filter(user => !existingUserIds.has(user.id));

    console.log(`➕ ${usersToAdd.length} utilisateurs à ajouter`);

    if (usersToAdd.length === 0) {
      console.log('✅ Tous les utilisateurs sont déjà membres de la conversation "any"');
      return;
    }

    // Ajouter les utilisateurs manquants
    await prisma.conversationMember.createMany({
      data: usersToAdd.map(user => ({
        conversationId: 'any',
        userId: user.id,
        role: 'MEMBER',
        joinedAt: new Date()
      }))
    });

    console.log(`✅ ${usersToAdd.length} nouveaux membres ajoutés à la conversation "any"`);

    // Vérification finale
    const finalMembers = await prisma.conversationMember.findMany({
      where: { conversationId: 'any' },
      include: { user: { select: { email: true, username: true } } }
    });

    console.log(`🎉 Total final: ${finalMembers.length} membres dans la conversation "any"`);
    console.log('Membres:');
    finalMembers.forEach(member => {
      console.log(`  - ${member.user.username} (${member.user.email})`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixConversationAny();
