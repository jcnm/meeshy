// Script pour nettoyer les doublons en utilisant UNIQUEMENT Prisma
const { PrismaClient } = require('./shared/prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  try {
    console.log('🚀 NETTOYAGE DES DOUBLONS AVEC PRISMA\n');
    
    // Étape 1: Trouver tous les messages qui ont des doublons
    console.log('1️⃣  Recherche des doublons...');
    
    const allTranslations = await prisma.messageTranslation.findMany({
      orderBy: [
        { messageId: 'asc' },
        { targetLanguage: 'asc' },
        { createdAt: 'desc' } // Plus récent en premier
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
    
    // Trouver les groupes avec doublons
    const duplicateGroups = Array.from(groups.entries())
      .filter(([key, translations]) => translations.length > 1);
    
    console.log(`📊 Groupes avec doublons: ${duplicateGroups.length}\n`);
    
    if (duplicateGroups.length === 0) {
      console.log('✅ Aucun doublon à nettoyer!\n');
      return;
    }
    
    // Étape 2: Supprimer les doublons (garder le plus récent)
    console.log('2️⃣  Suppression des doublons...');
    console.log(`   (Garder le plus récent, supprimer les autres)\n`);
    
    let deletedCount = 0;
    let processedCount = 0;
    
    for (const [key, translations] of duplicateGroups) {
      const [messageId, targetLanguage] = key.split('_');
      
      // Le premier est le plus récent (trié par createdAt desc)
      const toKeep = translations[0];
      const toDelete = translations.slice(1);
      
      if (processedCount < 5) {
        console.log(`   Message: ${messageId.substring(0, 12)}... | Langue: ${targetLanguage}`);
        console.log(`     ✅ Garder: ID ${toKeep.id.substring(0, 12)}... (${toKeep.createdAt.toISOString()})`);
        toDelete.forEach(t => {
          console.log(`     ❌ Supprimer: ID ${t.id.substring(0, 12)}... (${t.createdAt.toISOString()})`);
        });
      }
      
      // Supprimer les doublons
      for (const t of toDelete) {
        await prisma.messageTranslation.delete({
          where: { id: t.id }
        });
        deletedCount++;
      }
      
      processedCount++;
      
      if (processedCount % 50 === 0) {
        console.log(`   Progression: ${processedCount}/${duplicateGroups.length} groupes traités...`);
      }
    }
    
    console.log(`\n✅ ${deletedCount} doublons supprimés!\n`);
    
    // Étape 3: Vérification finale
    console.log('3️⃣  Vérification finale...');
    
    const remainingTranslations = await prisma.messageTranslation.findMany({});
    const remainingGroups = new Map();
    
    for (const translation of remainingTranslations) {
      const key = `${translation.messageId}_${translation.targetLanguage}`;
      
      if (!remainingGroups.has(key)) {
        remainingGroups.set(key, []);
      }
      
      remainingGroups.get(key).push(translation);
    }
    
    const remainingDuplicates = Array.from(remainingGroups.entries())
      .filter(([key, translations]) => translations.length > 1);
    
    console.log(`📊 Total de traductions après nettoyage: ${remainingTranslations.length}`);
    console.log(`📊 Groupes de doublons restants: ${remainingDuplicates.length}\n`);
    
    if (remainingDuplicates.length === 0) {
      console.log('✅ Aucun doublon restant!\n');
    } else {
      console.log(`⚠️  ${remainingDuplicates.length} groupes de doublons restants`);
      console.log(`   Relancez le script pour les supprimer.\n`);
    }
    
    console.log('='.repeat(60));
    console.log('✅ NETTOYAGE TERMINÉ!');
    console.log('='.repeat(60));
    console.log('');
    console.log('⚠️  IMPORTANT: L\'index unique doit être créé dans MongoDB');
    console.log('   pour empêcher les futurs doublons.');
    console.log('');
    console.log('Commande à exécuter dans mongosh:');
    console.log('  use meeshy');
    console.log('  db.MessageTranslation.createIndex(');
    console.log('    {messageId: 1, targetLanguage: 1},');
    console.log('    {unique: true, name: "message_target_language_unique"}');
    console.log('  )');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();

