#!/usr/bin/env node
/**
 * Script pour simuler une initialisation multiple
 * Meeshy - Test de l'initialisation répétée
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simulateMultipleInit() {
  console.log('🔄 Simulation d\'initialisation multiple...\n');

  try {
    // 1. État initial
    console.log('📋 État initial:');
    await logCurrentState();

    // 2. Simuler une première initialisation
    console.log('\n🚀 Simulation initialisation #1:');
    await simulateInit();

    // 3. Vérifier l'état après la première initialisation
    console.log('\n📋 État après initialisation #1:');
    await logCurrentState();

    // 4. Simuler une deuxième initialisation
    console.log('\n🚀 Simulation initialisation #2:');
    await simulateInit();

    // 5. Vérifier l'état après la deuxième initialisation
    console.log('\n📋 État après initialisation #2:');
    await logCurrentState();

    // 6. Simuler une troisième initialisation
    console.log('\n🚀 Simulation initialisation #3:');
    await simulateInit();

    // 7. Vérifier l'état final
    console.log('\n📋 État final:');
    await logCurrentState();

    console.log('\n✅ Simulation terminée !');

  } catch (error) {
    console.error('❌ Erreur lors de la simulation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function logCurrentState() {
  try {
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

    if (globalConversation && bigbossUser) {
      const bigbossMembers = await prisma.conversationMember.findMany({
        where: {
          conversationId: globalConversation.id,
          userId: bigbossUser.id,
          isActive: true
        }
      });
      console.log(`  • Entrées Bigboss dans "meeshy": ${bigbossMembers.length}`);
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
    }

  } catch (error) {
    console.error('  ❌ Erreur lors de la vérification:', error.message);
  }
}

async function simulateInit() {
  try {
    // Simuler la logique d'initialisation
    console.log('  🔍 Vérification de la conversation globale "meeshy"...');
    
    let globalConversation = await prisma.conversation.findFirst({
      where: { identifier: 'meeshy' }
    });

    if (!globalConversation) {
      console.log('  🆕 Création de la conversation globale "meeshy"...');
      globalConversation = await prisma.conversation.create({
        data: {
          identifier: 'meeshy',
          title: 'Meeshy Global',
          description: 'Conversation globale Meeshy',
          type: 'global',
          isActive: true,
          createdAt: new Date()
        }
      });
      console.log('  ✅ Conversation globale créée');
    } else {
      console.log('  ✅ Conversation globale existe déjà');
    }

    // Simuler la création de l'utilisateur Bigboss
    console.log('  🔍 Vérification de l\'utilisateur Bigboss "meeshy"...');
    
    let bigbossUser = await prisma.user.findFirst({
      where: { username: 'meeshy' }
    });

    if (!bigbossUser) {
      console.log('  🆕 Création de l\'utilisateur Bigboss "meeshy"...');
      bigbossUser = await prisma.user.create({
        data: {
          username: 'meeshy',
          password: 'hashed_password',
          firstName: 'Meeshy',
          lastName: 'Sama',
          email: 'meeshy@meeshy.me',
          role: 'BIGBOSS',
          systemLanguage: 'en',
          regionalLanguage: 'fr',
          customDestinationLanguage: 'pt',
          isActive: true,
          createdAt: new Date()
        }
      });
      console.log('  ✅ Utilisateur Bigboss créé');
    } else {
      console.log('  ✅ Utilisateur Bigboss existe déjà');
    }

    // Simuler l'ajout de l'utilisateur Bigboss à la conversation
    console.log('  🔍 Vérification de l\'appartenance Bigboss à "meeshy"...');
    
    const existingMember = await prisma.conversationMember.findFirst({
      where: {
        conversationId: globalConversation.id,
        userId: bigbossUser.id
      }
    });

    if (!existingMember) {
      console.log('  🆕 Ajout de l\'utilisateur Bigboss à la conversation "meeshy"...');
      await prisma.conversationMember.create({
        data: {
          conversationId: globalConversation.id,
          userId: bigbossUser.id,
          role: 'CREATOR',
          joinedAt: new Date(),
          isActive: true
        }
      });
      console.log('  ✅ Utilisateur Bigboss ajouté à la conversation');
    } else {
      console.log('  ✅ Utilisateur Bigboss est déjà membre de la conversation');
    }

  } catch (error) {
    console.error('  ❌ Erreur lors de la simulation:', error.message);
  }
}

// Exécuter le script
simulateMultipleInit();
