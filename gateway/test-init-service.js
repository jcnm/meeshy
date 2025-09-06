#!/usr/bin/env node

/**
 * Script de test pour le service d'initialisation amélioré
 * Ce script teste les nouvelles fonctionnalités du service d'initialisation
 */

const { PrismaClient } = require('./shared/prisma/client');
const { InitService } = require('./dist/services/init.service');

async function testInitService() {
  console.log('🧪 Test du service d\'initialisation amélioré...\n');
  
  const prisma = new PrismaClient();
  const initService = new InitService(prisma);
  
  try {
    // Test 1: Vérifier l'état actuel
    console.log('📋 Test 1: Vérification de l\'état actuel de la base de données');
    const shouldInit = await initService.shouldInitialize();
    console.log(`   Résultat: ${shouldInit ? 'Initialisation requise' : 'Base déjà initialisée'}\n`);
    
    // Test 2: Lister les utilisateurs existants
    console.log('👥 Test 2: Utilisateurs existants');
    const users = await prisma.user.findMany({
      select: {
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true
      }
    });
    
    if (users.length > 0) {
      console.log('   Utilisateurs trouvés:');
      users.forEach(user => {
        console.log(`   - ${user.username} (${user.firstName} ${user.lastName}) - ${user.role} - ${user.email}`);
      });
    } else {
      console.log('   Aucun utilisateur trouvé');
    }
    console.log('');
    
    // Test 3: Lister les conversations existantes
    console.log('💬 Test 3: Conversations existantes');
    const conversations = await prisma.conversation.findMany({
      select: {
        identifier: true,
        title: true,
        type: true,
        _count: {
          select: {
            members: true
          }
        }
      }
    });
    
    if (conversations.length > 0) {
      console.log('   Conversations trouvées:');
      conversations.forEach(conv => {
        console.log(`   - ${conv.identifier} (${conv.title}) - ${conv.type} - ${conv._count.members} membres`);
      });
    } else {
      console.log('   Aucune conversation trouvée');
    }
    console.log('');
    
    // Test 4: Simulation avec FORCE_DB_RESET
    console.log('🔄 Test 4: Simulation avec FORCE_DB_RESET=true');
    process.env.FORCE_DB_RESET = 'true';
    const shouldInitForce = await initService.shouldInitialize();
    console.log(`   Résultat avec FORCE_DB_RESET=true: ${shouldInitForce ? 'Initialisation forcée requise' : 'Base déjà initialisée'}`);
    
    // Remettre la variable à false
    process.env.FORCE_DB_RESET = 'false';
    console.log('');
    
    console.log('✅ Tests terminés avec succès');
    console.log('\n💡 Pour tester la réinitialisation complète:');
    console.log('   1. Définir FORCE_DB_RESET=true dans votre .env');
    console.log('   2. Redémarrer le service gateway');
    console.log('   3. Vérifier les logs pour confirmer la réinitialisation');
    console.log('\n💡 Pour personnaliser les utilisateurs, définir dans le .env.example');
    console.log('   Utilisateur Meeshy:');
    console.log('   - MEESHY_PASSWORD=monmotdepasse');
    console.log('   - MEESHY_EMAIL=mon@email.com');
    console.log('   - MEESHY_SYSTEM_LANGUAGE=fr');
    console.log('   - MEESHY_REGIONAL_LANGUAGE=fr');
    console.log('   - MEESHY_CUSTOM_DESTINATION_LANGUAGE=en');
    console.log('');
    console.log('   Utilisateur Admin :');
    console.log('   - ADMIN_PASSWORD=monmotdepasse');
    console.log('   - ADMIN_EMAIL=admin@email.com');
    console.log('   - ADMIN_SYSTEM_LANGUAGE=fr');
    console.log('   - ADMIN_REGIONAL_LANGUAGE=fr');
    console.log('   - ADMIN_CUSTOM_DESTINATION_LANGUAGE=en');
    console.log('');
    console.log('   Utilisateur André Tabeth :');
    console.log('   - ATABETH_USERNAME=monuser');
    console.log('   - ATABETH_PASSWORD=monmotdepasse');
    console.log('   - ATABETH_FIRST_NAME=Mon');
    console.log('   - ATABETH_LAST_NAME=Nom');
    console.log('   - ATABETH_EMAIL=mon@email.com');
    console.log('   - ATABETH_ROLE=ADMIN');
    console.log('   - ATABETH_SYSTEM_LANGUAGE=fr');
    console.log('   - ATABETH_REGIONAL_LANGUAGE=fr');
    console.log('   - ATABETH_CUSTOM_DESTINATION_LANGUAGE=en');
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testInitService().catch(console.error);
