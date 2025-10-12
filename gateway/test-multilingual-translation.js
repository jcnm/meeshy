/**
 * Script de test pour vérifier que les messages sont traduits
 * dans toutes les langues des participants d'une conversation
 * 
 * Usage: node test-multilingual-translation.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLanguageExtraction(conversationId = 'meeshy') {
  console.log('\n🧪 Test d\'extraction des langues de la conversation\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Récupérer les membres de la conversation
    console.log(`\n📊 Analyse de la conversation: ${conversationId}\n`);
    
    const members = await prisma.conversationMember.findMany({
      where: { 
        conversationId: conversationId,
        isActive: true 
      },
      include: {
        user: {
          select: {
            username: true,
            systemLanguage: true,
            regionalLanguage: true,
            customDestinationLanguage: true,
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: true,
            useCustomDestination: true
          }
        }
      }
    });
    
    // 2. Récupérer les participants anonymes
    const anonymousParticipants = await prisma.anonymousParticipant.findMany({
      where: { 
        conversationId: conversationId,
        isActive: true 
      },
      select: {
        displayName: true,
        language: true
      }
    });
    
    console.log(`👥 Participants authentifiés: ${members.length}`);
    console.log(`👻 Participants anonymes: ${anonymousParticipants.length}`);
    console.log(`📊 Total participants: ${members.length + anonymousParticipants.length}\n`);
    
    // 3. Extraire les langues (nouvelle logique)
    const languages = new Set();
    
    console.log('📝 Extraction des langues:\n');
    
    // Langues des utilisateurs authentifiés
    for (const member of members) {
      const user = member.user;
      console.log(`  👤 ${user.username}:`);
      
      // Toujours ajouter la langue système
      if (user.systemLanguage) {
        languages.add(user.systemLanguage);
        console.log(`     ✅ systemLanguage: ${user.systemLanguage} (TOUJOURS incluse)`);
      }
      
      // Langues additionnelles si autoTranslateEnabled
      if (user.autoTranslateEnabled) {
        console.log(`     🔄 autoTranslateEnabled: true`);
        
        if (user.translateToRegionalLanguage && user.regionalLanguage) {
          languages.add(user.regionalLanguage);
          console.log(`     ✅ regionalLanguage: ${user.regionalLanguage}`);
        }
        
        if (user.useCustomDestination && user.customDestinationLanguage) {
          languages.add(user.customDestinationLanguage);
          console.log(`     ✅ customDestinationLanguage: ${user.customDestinationLanguage}`);
        }
      } else {
        console.log(`     ⏸️  autoTranslateEnabled: false (langues additionnelles ignorées)`);
      }
      
      console.log('');
    }
    
    // Langues des participants anonymes
    for (const participant of anonymousParticipants) {
      if (participant.language) {
        languages.add(participant.language);
        console.log(`  👻 ${participant.displayName}:`);
        console.log(`     ✅ language: ${participant.language} (TOUJOURS incluse)\n`);
      }
    }
    
    // 4. Résultats
    const allLanguages = Array.from(languages);
    
    console.log('='.repeat(60));
    console.log('\n🎯 RÉSULTAT:\n');
    console.log(`  Langues uniques extraites: ${allLanguages.length}`);
    console.log(`  Langues: ${allLanguages.join(', ')}\n`);
    
    // 5. Simulation de traduction
    const sourceLanguage = 'fr'; // Message en français
    const filteredLanguages = allLanguages.filter(lang => lang !== sourceLanguage);
    
    console.log('📤 Simulation d\'envoi de message:\n');
    console.log(`  Langue source: ${sourceLanguage}`);
    console.log(`  Langues après filtrage: ${filteredLanguages.join(', ')}`);
    console.log(`  Nombre de traductions à générer: ${filteredLanguages.length}\n`);
    
    // 6. Vérifier un message récent
    const recentMessage = await prisma.message.findFirst({
      where: { conversationId },
      include: {
        translations: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (recentMessage) {
      console.log('📨 Analyse du dernier message:\n');
      console.log(`  ID: ${recentMessage.id}`);
      console.log(`  Contenu: ${recentMessage.content.substring(0, 50)}...`);
      console.log(`  Langue originale: ${recentMessage.originalLanguage}`);
      console.log(`  Traductions existantes: ${recentMessage.translations.length}`);
      
      if (recentMessage.translations.length > 0) {
        console.log(`  Langues traduites: ${recentMessage.translations.map(t => t.targetLanguage).join(', ')}\n`);
        
        // Comparer avec les langues attendues
        const expectedLangs = filteredLanguages.filter(lang => lang !== recentMessage.originalLanguage);
        const translatedLangs = recentMessage.translations.map(t => t.targetLanguage);
        const missingLangs = expectedLangs.filter(lang => !translatedLangs.includes(lang));
        
        if (missingLangs.length > 0) {
          console.log(`  ⚠️  ATTENTION: Traductions manquantes pour: ${missingLangs.join(', ')}`);
          console.log(`  ℹ️  Cela peut être normal si le message est récent et en cours de traduction\n`);
        } else {
          console.log(`  ✅ Toutes les traductions attendues sont présentes\n`);
        }
      } else {
        console.log(`  ℹ️  Aucune traduction trouvée (message récent ou en cours)\n`);
      }
    }
    
    console.log('='.repeat(60));
    console.log('\n✅ Test terminé avec succès\n');
    
    return {
      participantsCount: members.length + anonymousParticipants.length,
      languagesCount: allLanguages.length,
      languages: allLanguages
    };
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
if (require.main === module) {
  const conversationId = process.argv[2] || 'meeshy';
  
  console.log('🚀 Démarrage du test de traduction multilingue');
  console.log(`📍 Conversation: ${conversationId}\n`);
  
  testLanguageExtraction(conversationId)
    .then(result => {
      console.log('📊 Statistiques finales:');
      console.log(`  - Participants: ${result.participantsCount}`);
      console.log(`  - Langues: ${result.languagesCount}`);
      console.log(`  - Liste: ${result.languages.join(', ')}\n`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test échoué:', error.message);
      process.exit(1);
    });
}

module.exports = { testLanguageExtraction };

