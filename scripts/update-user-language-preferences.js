#!/usr/bin/env node

/**
 * Script pour mettre à jour les préférences de langue de l'utilisateur admin
 * afin de tester l'affichage des traductions
 */

const { PrismaClient } = require('../shared/prisma/client');

async function updateUserLanguagePreferences() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Mise à jour des préférences de langue de l\'utilisateur admin...\n');
    
    // 1. Afficher les préférences actuelles
    console.log('1️⃣ Préférences actuelles:');
    const currentUser = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        systemLanguage: true,
        regionalLanguage: true,
        customDestinationLanguage: true,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: true,
        useCustomDestination: true
      }
    });
    
    if (!currentUser) {
      console.log('❌ Utilisateur admin non trouvé');
      return;
    }
    
    console.log('   📊 Préférences actuelles:');
    console.log(`      Langue système: ${currentUser.systemLanguage}`);
    console.log(`      Langue régionale: ${currentUser.regionalLanguage}`);
    console.log(`      Langue personnalisée: ${currentUser.customDestinationLanguage}`);
    console.log(`      Traduction automatique: ${currentUser.autoTranslateEnabled}`);
    console.log(`      Traduire vers langue système: ${currentUser.translateToSystemLanguage}`);
    console.log(`      Traduire vers langue régionale: ${currentUser.translateToRegionalLanguage}`);
    console.log(`      Utiliser langue personnalisée: ${currentUser.useCustomDestination}\n`);
    
    // 2. Proposer des options de configuration
    console.log('2️⃣ Options de configuration pour tester les traductions:');
    console.log('   A) Préférer l\'espagnol (traductions disponibles)');
    console.log('   B) Préférer le français (nécessite nouvelles traductions)');
    console.log('   C) Préférer l\'allemand (nécessite nouvelles traductions)');
    console.log('   D) Activer la traduction vers la langue système');
    console.log('   E) Activer la traduction vers la langue régionale');
    console.log('   F) Restaurer les préférences par défaut\n');
    
    // 3. Appliquer la configuration A (espagnol)
    console.log('3️⃣ Application de la configuration A (espagnol)...');
    
    const updatedUser = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        customDestinationLanguage: 'es',
        useCustomDestination: true,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        autoTranslateEnabled: true
      },
      select: {
        id: true,
        username: true,
        systemLanguage: true,
        regionalLanguage: true,
        customDestinationLanguage: true,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: true,
        useCustomDestination: true
      }
    });
    
    console.log('   ✅ Préférences mises à jour:');
    console.log(`      Langue système: ${updatedUser.systemLanguage}`);
    console.log(`      Langue régionale: ${updatedUser.regionalLanguage}`);
    console.log(`      Langue personnalisée: ${updatedUser.customDestinationLanguage}`);
    console.log(`      Traduction automatique: ${updatedUser.autoTranslateEnabled}`);
    console.log(`      Traduire vers langue système: ${updatedUser.translateToSystemLanguage}`);
    console.log(`      Traduire vers langue régionale: ${updatedUser.translateToRegionalLanguage}`);
    console.log(`      Utiliser langue personnalisée: ${updatedUser.useCustomDestination}\n`);
    
    // 4. Vérifier les traductions disponibles
    console.log('4️⃣ Vérification des traductions disponibles:');
    const messagesWithTranslations = await prisma.message.findMany({
      where: {
        translations: {
          some: {
            targetLanguage: 'es'
          }
        }
      },
      include: {
        translations: {
          where: { targetLanguage: 'es' },
          select: {
            targetLanguage: true,
            translatedContent: true
          }
        }
      },
      take: 3
    });
    
    console.log(`   📊 ${messagesWithTranslations.length} messages avec traductions espagnoles trouvés`);
    messagesWithTranslations.forEach((msg, index) => {
      console.log(`   📝 Message ${index + 1}:`);
      console.log(`      Contenu original: ${msg.content.substring(0, 30)}...`);
      console.log(`      Traduction ES: ${msg.translations[0]?.translatedContent.substring(0, 30)}...`);
    });
    
    console.log('\n✅ Configuration terminée !');
    console.log('🔄 Maintenant, quand vous rechargez la conversation, les traductions espagnoles devraient s\'afficher.');
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la mise à jour
updateUserLanguagePreferences().catch(console.error);
