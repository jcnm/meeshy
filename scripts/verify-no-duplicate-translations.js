#!/usr/bin/env node

/**
 * Script de vérification des traductions en doublon
 * 
 * Ce script vérifie qu'il n'y a pas de traductions en doublon dans la base de données.
 * 
 * Usage: node scripts/verify-no-duplicate-translations.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyNoDuplicates() {
  console.log('🔍 Vérification des traductions en doublon...\n');

  try {
    // Récupérer toutes les traductions
    const allTranslations = await prisma.messageTranslation.findMany({
      select: {
        id: true,
        messageId: true,
        targetLanguage: true,
        createdAt: true
      },
      orderBy: [
        { messageId: 'asc' },
        { targetLanguage: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    console.log(`📊 Total de traductions: ${allTranslations.length}\n`);

    // Grouper par messageId + targetLanguage
    const groups = new Map();
    
    for (const translation of allTranslations) {
      const key = `${translation.messageId}_${translation.targetLanguage}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key).push(translation);
    }

    // Trouver les doublons
    const duplicates = Array.from(groups.entries())
      .filter(([key, translations]) => translations.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ Aucun doublon trouvé!\n');
      console.log('🎉 La base de données est propre.\n');
      return true;
    } else {
      console.log(`❌ ${duplicates.length} groupes de doublons trouvés:\n`);
      
      for (const [key, translations] of duplicates) {
        const [messageId, targetLanguage] = key.split('_');
        console.log(`   📝 Message: ${messageId}`);
        console.log(`   🌐 Langue: ${targetLanguage}`);
        console.log(`   🔢 Nombre de traductions: ${translations.length}`);
        console.log('');
      }
      
      console.log('⚠️  Exécutez le script de nettoyage pour supprimer les doublons.');
      console.log('   node scripts/cleanup-duplicate-translations.js\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    return false;
  }
}

async function checkIndex() {
  console.log('🔍 Vérification de l\'index unique...\n');
  
  try {
    // Tester la contrainte unique en essayant de créer un doublon (qui devrait échouer)
    const testMessageId = 'test_' + Date.now();
    const testTargetLanguage = 'en';
    
    // Créer la première traduction
    const translation1 = await prisma.messageTranslation.create({
      data: {
        messageId: testMessageId,
        sourceLanguage: 'fr',
        targetLanguage: testTargetLanguage,
        translatedContent: 'Test translation 1',
        translationModel: 'test',
        cacheKey: `${testMessageId}_fr_${testTargetLanguage}_1`
      }
    });
    
    console.log('✅ Première traduction de test créée\n');
    
    // Essayer de créer un doublon (devrait échouer avec l'index unique)
    try {
      await prisma.messageTranslation.create({
        data: {
          messageId: testMessageId,
          sourceLanguage: 'fr',
          targetLanguage: testTargetLanguage,
          translatedContent: 'Test translation 2 (duplicate)',
          translationModel: 'test',
          cacheKey: `${testMessageId}_fr_${testTargetLanguage}_2`
        }
      });
      
      // Si on arrive ici, l'index unique ne fonctionne pas
      console.log('⚠️  L\'index unique ne fonctionne pas correctement!\n');
      console.log('   Une traduction en doublon a pu être créée.\n');
      console.log('   Vérifiez que l\'index MongoDB a été créé:\n');
      console.log('   db.MessageTranslation.createIndex(');
      console.log('     { messageId: 1, targetLanguage: 1 },');
      console.log('     { unique: true, name: "message_target_language_unique" }');
      console.log('   )\n');
      
      // Nettoyer les traductions de test
      await prisma.messageTranslation.deleteMany({
        where: { messageId: testMessageId }
      });
      
      return false;
      
    } catch (duplicateError) {
      // C'est le comportement attendu!
      if (duplicateError.code === 'P2002' || duplicateError.message?.includes('unique')) {
        console.log('✅ L\'index unique fonctionne correctement!\n');
        console.log('   La création de doublons est bien empêchée.\n');
        
        // Nettoyer la traduction de test
        await prisma.messageTranslation.delete({
          where: { id: translation1.id }
        });
        
        return true;
      } else {
        throw duplicateError;
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test de l\'index:', error);
    return false;
  }
}

async function getStats() {
  console.log('📊 Statistiques des traductions\n');
  
  try {
    // Compter les traductions par langue
    const allTranslations = await prisma.messageTranslation.findMany({
      select: {
        targetLanguage: true
      }
    });
    
    const byLanguage = new Map();
    for (const t of allTranslations) {
      const count = byLanguage.get(t.targetLanguage) || 0;
      byLanguage.set(t.targetLanguage, count + 1);
    }
    
    console.log('   Traductions par langue:');
    for (const [lang, count] of Array.from(byLanguage.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${lang}: ${count}`);
    }
    console.log('');
    
    // Compter les messages avec traductions
    const messagesWithTranslations = await prisma.message.findMany({
      include: {
        _count: {
          select: { translations: true }
        }
      }
    });
    
    const messagesWithTranslationsCount = messagesWithTranslations.filter(m => m._count.translations > 0).length;
    const avgTranslationsPerMessage = messagesWithTranslations
      .map(m => m._count.translations)
      .reduce((a, b) => a + b, 0) / messagesWithTranslations.length;
    
    console.log(`   Messages avec traductions: ${messagesWithTranslationsCount}/${messagesWithTranslations.length}`);
    console.log(`   Moyenne de traductions par message: ${avgTranslationsPerMessage.toFixed(2)}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des statistiques:', error);
  }
}

async function main() {
  console.log('=' .repeat(70));
  console.log('🔍 VÉRIFICATION DES TRADUCTIONS');
  console.log('=' .repeat(70));
  console.log('');

  try {
    // Étape 1: Vérifier les doublons
    const noDuplicates = await verifyNoDuplicates();
    
    console.log('=' .repeat(70));
    console.log('');
    
    // Étape 2: Vérifier l'index unique
    const indexWorks = await checkIndex();
    
    console.log('=' .repeat(70));
    console.log('');
    
    // Étape 3: Afficher les statistiques
    await getStats();
    
    console.log('=' .repeat(70));
    
    // Résumé final
    if (noDuplicates && indexWorks) {
      console.log('');
      console.log('✅ TOUT EST OK!');
      console.log('');
      console.log('   ✓ Aucun doublon dans la base de données');
      console.log('   ✓ L\'index unique fonctionne correctement');
      console.log('   ✓ Les futurs doublons seront automatiquement prévenus');
      console.log('');
    } else {
      console.log('');
      console.log('⚠️  DES PROBLÈMES ONT ÉTÉ DÉTECTÉS');
      console.log('');
      if (!noDuplicates) {
        console.log('   ✗ Des doublons existent dans la base de données');
        console.log('     → Exécutez: node scripts/cleanup-duplicate-translations.js');
      }
      if (!indexWorks) {
        console.log('   ✗ L\'index unique ne fonctionne pas');
        console.log('     → Créez l\'index MongoDB manuellement');
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
main();

