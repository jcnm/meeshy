#!/usr/bin/env node
/**
 * Script pour tester la prévention des doublons dans les conversations
 * Meeshy - Test de la prévention des doublons
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDuplicatePrevention() {
  console.log('🧪 Test de la prévention des doublons dans les conversations...\n');

  try {
    // 1. Trouver une conversation de test
    const testConversation = await prisma.conversation.findFirst({
      where: {
        identifier: 'meeshy'
      }
    });

    if (!testConversation) {
      console.log('❌ Aucune conversation de test trouvée');
      return;
    }

    console.log(`📋 Conversation de test: ${testConversation.title || testConversation.identifier} (ID: ${testConversation.id})`);

    // 2. Trouver un utilisateur de test
    const testUser = await prisma.user.findFirst({
      where: {
        isActive: true
      }
    });

    if (!testUser) {
      console.log('❌ Aucun utilisateur de test trouvé');
      return;
    }

    console.log(`👤 Utilisateur de test: ${testUser.username} (ID: ${testUser.id})`);

    // 3. Vérifier si l'utilisateur est déjà membre
    const existingMember = await prisma.conversationMember.findFirst({
      where: {
        conversationId: testConversation.id,
        userId: testUser.id,
        isActive: true
      }
    });

    if (existingMember) {
      console.log(`✅ L'utilisateur est déjà membre (ID: ${existingMember.id})`);
      
      // 4. Tester la prévention de doublon
      console.log('\n🧪 Test de la prévention de doublon...');
      
      try {
        // Essayer d'ajouter l'utilisateur à nouveau
        await prisma.conversationMember.create({
          data: {
            conversationId: testConversation.id,
            userId: testUser.id,
            role: 'MEMBER',
            joinedAt: new Date(),
            isActive: true
          }
        });
        
        console.log('❌ ERREUR: Un doublon a été créé ! La contrainte unique ne fonctionne pas.');
        
        // Nettoyer le doublon créé
        const duplicates = await prisma.conversationMember.findMany({
          where: {
            conversationId: testConversation.id,
            userId: testUser.id,
            isActive: true
          },
          orderBy: {
            joinedAt: 'asc'
          }
        });

        if (duplicates.length > 1) {
          const toDelete = duplicates.slice(1);
          for (const duplicate of toDelete) {
            await prisma.conversationMember.update({
              where: { id: duplicate.id },
              data: { isActive: false }
            });
            console.log(`🧹 Doublon ${duplicate.id} nettoyé`);
          }
        }
        
      } catch (error) {
        if (error.code === 'P2002') {
          console.log('✅ SUCCÈS: La contrainte unique empêche la création de doublons !');
          console.log(`   Erreur attendue: ${error.message}`);
        } else {
          console.log(`❌ Erreur inattendue: ${error.message}`);
        }
      }
    } else {
      console.log('ℹ️  L\'utilisateur n\'est pas encore membre de cette conversation');
      
      // 5. Ajouter l'utilisateur une première fois
      console.log('\n➕ Ajout de l\'utilisateur à la conversation...');
      
      const newMember = await prisma.conversationMember.create({
        data: {
          conversationId: testConversation.id,
          userId: testUser.id,
          role: 'MEMBER',
          joinedAt: new Date(),
          isActive: true
        }
      });
      
      console.log(`✅ Utilisateur ajouté (ID: ${newMember.id})`);
      
      // 6. Tester la prévention de doublon
      console.log('\n🧪 Test de la prévention de doublon...');
      
      try {
        // Essayer d'ajouter l'utilisateur à nouveau
        await prisma.conversationMember.create({
          data: {
            conversationId: testConversation.id,
            userId: testUser.id,
            role: 'MEMBER',
            joinedAt: new Date(),
            isActive: true
          }
        });
        
        console.log('❌ ERREUR: Un doublon a été créé ! La contrainte unique ne fonctionne pas.');
        
      } catch (error) {
        if (error.code === 'P2002') {
          console.log('✅ SUCCÈS: La contrainte unique empêche la création de doublons !');
          console.log(`   Erreur attendue: ${error.message}`);
        } else {
          console.log(`❌ Erreur inattendue: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Test de prévention des doublons terminé !');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
testDuplicatePrevention();
