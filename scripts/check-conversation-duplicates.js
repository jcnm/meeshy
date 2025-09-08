#!/usr/bin/env node
/**
 * Script pour vérifier et nettoyer les doublons dans les conversations
 * Meeshy - Vérification des membres de conversation
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkConversationDuplicates() {
  console.log('🔍 Vérification des doublons dans les conversations...\n');

  try {
    // 1. Trouver tous les doublons potentiels
    const duplicates = await prisma.$queryRaw`
      SELECT 
        "conversationId", 
        "userId", 
        COUNT(*) as count
      FROM "ConversationMember"
      WHERE "isActive" = true
      GROUP BY "conversationId", "userId"
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      console.log('✅ Aucun doublon trouvé dans les conversations !');
      return;
    }

    console.log(`❌ ${duplicates.length} doublons trouvés :\n`);

    for (const duplicate of duplicates) {
      console.log(`  • Conversation ${duplicate.conversationId} - Utilisateur ${duplicate.userId} (${duplicate.count} entrées)`);
      
      // Récupérer les détails des doublons
      const members = await prisma.conversationMember.findMany({
        where: {
          conversationId: duplicate.conversationId,
          userId: duplicate.userId,
          isActive: true
        },
        include: {
          user: {
            select: {
              username: true,
              displayName: true
            }
          },
          conversation: {
            select: {
              title: true,
              identifier: true
            }
          }
        },
        orderBy: {
          joinedAt: 'asc'
        }
      });

      console.log(`    Utilisateur: ${members[0].user.username} (${members[0].user.displayName})`);
      console.log(`    Conversation: ${members[0].conversation.title || members[0].conversation.identifier}`);
      console.log(`    Entrées:`);
      
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        console.log(`      ${i + 1}. ID: ${member.id}, Rôle: ${member.role}, Rejoint: ${member.joinedAt.toISOString()}`);
      }

      // Garder la première entrée (la plus ancienne) et supprimer les autres
      const toKeep = members[0];
      const toDelete = members.slice(1);

      console.log(`    🧹 Nettoyage: Garder l'entrée ${toKeep.id}, supprimer ${toDelete.length} doublon(s)`);

      for (const member of toDelete) {
        await prisma.conversationMember.update({
          where: { id: member.id },
          data: { isActive: false }
        });
        console.log(`      ✅ Entrée ${member.id} désactivée`);
      }

      console.log('');
    }

    console.log('✅ Nettoyage des doublons terminé !');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des doublons:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
checkConversationDuplicates();
