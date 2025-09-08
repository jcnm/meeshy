#!/usr/bin/env node
/**
 * Script pour tester la robustesse de l'initialisation
 * Meeshy - Test de l'initialisation multiple
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testInitRobustness() {
  console.log('🧪 Test de la robustesse de l\'initialisation...\n');

  try {
    // 1. Vérifier l'état initial
    console.log('📋 État initial de la base de données:');
    
    const globalConversation = await prisma.conversation.findFirst({
      where: { identifier: 'meeshy' }
    });
    
    const bigbossUser = await prisma.user.findFirst({
      where: { username: 'meeshy' }
    });
    
    const adminUser = await prisma.user.findFirst({
      where: { username: 'admin' }
    });
    
    console.log(`  • Conversation globale "meeshy": ${globalConversation ? '✅ Existe' : '❌ Manquante'}`);
    console.log(`  • Utilisateur Bigboss "meeshy": ${bigbossUser ? '✅ Existe' : '❌ Manquant'}`);
    console.log(`  • Utilisateur Admin "admin": ${adminUser ? '✅ Existe' : '❌ Manquant'}`);

    // 2. Vérifier les appartenances aux conversations
    if (globalConversation && bigbossUser) {
      const bigbossMember = await prisma.conversationMember.findFirst({
        where: {
          conversationId: globalConversation.id,
          userId: bigbossUser.id
        }
      });
      console.log(`  • Bigboss membre de "meeshy": ${bigbossMember ? '✅ Oui' : '❌ Non'}`);
    }

    if (globalConversation && adminUser) {
      const adminMember = await prisma.conversationMember.findFirst({
        where: {
          conversationId: globalConversation.id,
          userId: adminUser.id
        }
      });
      console.log(`  • Admin membre de "meeshy": ${adminMember ? '✅ Oui' : '❌ Non'}`);
    }

    // 3. Tester la détection de doublons
    console.log('\n🔍 Test de détection de doublons:');
    
    if (globalConversation && bigbossUser) {
      const bigbossMembers = await prisma.conversationMember.findMany({
        where: {
          conversationId: globalConversation.id,
          userId: bigbossUser.id,
          isActive: true
        }
      });
      
      console.log(`  • Entrées Bigboss dans "meeshy": ${bigbossMembers.length}`);
      if (bigbossMembers.length > 1) {
        console.log('  ❌ DOUBLON DÉTECTÉ !');
        for (let i = 0; i < bigbossMembers.length; i++) {
          const member = bigbossMembers[i];
          console.log(`    ${i + 1}. ID: ${member.id}, Rôle: ${member.role}, Rejoint: ${member.joinedAt.toISOString()}`);
        }
      } else {
        console.log('  ✅ Aucun doublon détecté');
      }
    }

    if (globalConversation && adminUser) {
      const adminMembers = await prisma.conversationMember.findMany({
        where: {
          conversationId: globalConversation.id,
          userId: adminUser.id,
          isActive: true
        }
      });
      
      console.log(`  • Entrées Admin dans "meeshy": ${adminMembers.length}`);
      if (adminMembers.length > 1) {
        console.log('  ❌ DOUBLON DÉTECTÉ !');
        for (let i = 0; i < adminMembers.length; i++) {
          const member = adminMembers[i];
          console.log(`    ${i + 1}. ID: ${member.id}, Rôle: ${member.role}, Rejoint: ${member.joinedAt.toISOString()}`);
        }
      } else {
        console.log('  ✅ Aucun doublon détecté');
      }
    }

    // 4. Tester la contrainte unique (si elle existe)
    console.log('\n🧪 Test de la contrainte unique:');
    
    if (globalConversation && bigbossUser) {
      try {
        // Essayer de créer un doublon
        await prisma.conversationMember.create({
          data: {
            conversationId: globalConversation.id,
            userId: bigbossUser.id,
            role: 'MEMBER',
            joinedAt: new Date(),
            isActive: true
          }
        });
        
        console.log('  ❌ ERREUR: Doublon créé ! La contrainte unique ne fonctionne pas.');
        
        // Nettoyer le doublon
        const duplicates = await prisma.conversationMember.findMany({
          where: {
            conversationId: globalConversation.id,
            userId: bigbossUser.id,
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
            console.log(`  🧹 Doublon ${duplicate.id} nettoyé`);
          }
        }
        
      } catch (error) {
        if (error.code === 'P2002') {
          console.log('  ✅ SUCCÈS: La contrainte unique empêche la création de doublons !');
          console.log(`     Erreur attendue: ${error.message}`);
        } else {
          console.log(`  ❌ Erreur inattendue: ${error.message}`);
        }
      }
    }

    // 5. Résumé
    console.log('\n📊 Résumé du test:');
    const totalMembers = await prisma.conversationMember.count({
      where: { isActive: true }
    });
    const totalUsers = await prisma.user.count({
      where: { isActive: true }
    });
    const totalConversations = await prisma.conversation.count({
      where: { isActive: true }
    });
    
    console.log(`  • Total utilisateurs actifs: ${totalUsers}`);
    console.log(`  • Total conversations actives: ${totalConversations}`);
    console.log(`  • Total appartenances actives: ${totalMembers}`);

    console.log('\n✅ Test de robustesse terminé !');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
testInitRobustness();
