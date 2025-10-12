// Script de debug simple pour voir ce qui se passe vraiment
const { PrismaClient } = require('./shared/prisma/client');

const prisma = new PrismaClient();

async function debugTranslations() {
  try {
    // Prendre un message au hasard qui devrait avoir des traductions
    const messageWithTranslations = await prisma.message.findFirst({
      where: {
        translations: {
          some: {}
        }
      },
      include: {
        translations: true
      }
    });
    
    if (!messageWithTranslations) {
      console.log('❌ Aucun message avec traductions trouvé');
      return;
    }
    
    console.log('📨 Message:', messageWithTranslations.id.substring(0, 12) + '...');
    console.log('📊 Nombre de traductions retournées par Prisma:', messageWithTranslations.translations.length);
    console.log('');
    
    // Afficher chaque traduction
    messageWithTranslations.translations.forEach((t, idx) => {
      console.log(`[${idx + 1}] ID: ${t.id.substring(0, 12)}... | Langue: ${t.targetLanguage} | Contenu: "${t.translatedContent.substring(0, 40)}..."`);
    });
    
    console.log('');
    
    // Créer un Set pour voir les IDs uniques
    const uniqueIds = new Set(messageWithTranslations.translations.map(t => t.id));
    console.log(`📊 IDs uniques: ${uniqueIds.size}`);
    
    if (uniqueIds.size !== messageWithTranslations.translations.length) {
      console.log('❌ PROBLÈME: Moins d\'IDs uniques que de traductions!');
      console.log('Prisma retourne le même document plusieurs fois.\n');
    } else {
      console.log('✅ Tous les IDs sont uniques dans ce message\n');
    }
    
    // Vérifier les langues
    const languageGroups = new Map();
    messageWithTranslations.translations.forEach(t => {
      if (!languageGroups.has(t.targetLanguage)) {
        languageGroups.set(t.targetLanguage, []);
      }
      languageGroups.get(t.targetLanguage).push(t);
    });
    
    console.log('📊 Groupes par langue:');
    for (const [lang, translations] of languageGroups) {
      console.log(`  ${lang}: ${translations.length} traduction(s)`);
      if (translations.length > 1) {
        console.log(`    ❌ DOUBLON pour la langue ${lang}!`);
        translations.forEach((t, idx) => {
          console.log(`      [${idx + 1}] ID: ${t.id.substring(0, 12)}... - ${t.createdAt.toISOString()}`);
        });
      }
    }
    console.log('');
    
    // Maintenant vérifier en base directement
    console.log('🔍 Vérification directe en base pour ce message...');
    const directTranslations = await prisma.messageTranslation.findMany({
      where: {
        messageId: messageWithTranslations.id
      },
      orderBy: {
        targetLanguage: 'asc'
      }
    });
    
    console.log(`📊 Traductions en base (requête directe): ${directTranslations.length}`);
    
    const directUniqueIds = new Set(directTranslations.map(t => t.id));
    console.log(`📊 IDs uniques (requête directe): ${directUniqueIds.size}`);
    
    if (directUniqueIds.size !== directTranslations.length) {
      console.log('❌ PROBLÈME CRITIQUE: La requête directe retourne des doublons!');
    } else {
      console.log('✅ La requête directe retourne tous des IDs uniques');
    }
    
    console.log('');
    console.log('📋 Comparaison include vs direct:');
    console.log(`  Include: ${messageWithTranslations.translations.length} traductions`);
    console.log(`  Direct:  ${directTranslations.length} traductions`);
    
    if (messageWithTranslations.translations.length !== directTranslations.length) {
      console.log('  ❌ DIFFÉRENCE détectée!');
    } else {
      console.log('  ✅ Même nombre');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTranslations();

