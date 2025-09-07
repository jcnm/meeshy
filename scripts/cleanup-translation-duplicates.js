#!/usr/bin/env node

/**
 * Script de nettoyage des doublons de traductions en base de données
 * 
 * Ce script :
 * 1. Identifie les traductions en double
 * 2. Garde la traduction la plus récente pour chaque (messageId, targetLanguage)
 * 3. Supprime les doublons
 * 4. Affiche un rapport de nettoyage
 */

const { PrismaClient } = require('@prisma/client');

// Configuration
const prisma = new PrismaClient();

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[ÉTAPE ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Fonction pour identifier les doublons
async function identifyDuplicates() {
  logStep(1, 'Identification des doublons de traductions');
  
  try {
    const duplicates = await prisma.$queryRaw`
      SELECT 
        "messageId",
        "targetLanguage",
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY "createdAt" DESC) as translation_ids,
        ARRAY_AGG("translatedContent" ORDER BY "createdAt" DESC) as contents,
        ARRAY_AGG("createdAt" ORDER BY "createdAt" DESC) as timestamps
      FROM "MessageTranslation"
      GROUP BY "messageId", "targetLanguage"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    log(`Trouvé ${duplicates.length} groupes de traductions en double`, duplicates.length > 0 ? 'yellow' : 'green');
    
    return duplicates;
  } catch (error) {
    logError(`Erreur lors de l'identification des doublons: ${error.message}`);
    return [];
  }
}

// Fonction pour nettoyer les doublons
async function cleanupDuplicates(duplicates, dryRun = true) {
  logStep(2, dryRun ? 'Simulation du nettoyage (DRY RUN)' : 'Nettoyage des doublons');
  
  let totalToDelete = 0;
  let totalKept = 0;
  
  try {
    for (const duplicate of duplicates) {
      const { messageId, targetLanguage, count, translation_ids, contents, timestamps } = duplicate;
      
      log(`\n📝 Message ${messageId} -> ${targetLanguage}:`, 'blue');
      log(`   Total: ${count} traductions`, 'blue');
      
      // Garder la première (la plus récente car triée par createdAt DESC)
      const keepId = translation_ids[0];
      const deleteIds = translation_ids.slice(1);
      
      log(`   À conserver: ${keepId} (${timestamps[0]})`, 'green');
      log(`   À supprimer: ${deleteIds.join(', ')}`, 'red');
      
      // Vérifier si les contenus sont identiques
      const uniqueContents = [...new Set(contents)];
      if (uniqueContents.length === 1) {
        log(`   Contenu identique: "${uniqueContents[0].substring(0, 50)}..."`, 'green');
      } else {
        log(`   Contenus différents:`, 'yellow');
        uniqueContents.forEach((content, index) => {
          log(`     ${index + 1}: "${content.substring(0, 50)}..."`, 'yellow');
        });
      }
      
      if (!dryRun) {
        // Supprimer les doublons
        const deleteResult = await prisma.messageTranslation.deleteMany({
          where: {
            id: {
              in: deleteIds
            }
          }
        });
        
        log(`   ✅ ${deleteResult.count} traductions supprimées`, 'green');
      }
      
      totalToDelete += deleteIds.length;
      totalKept += 1;
    }
    
    if (dryRun) {
      log(`\n📊 Résumé du nettoyage (simulation):`, 'yellow');
      log(`   Traductions à conserver: ${totalKept}`, 'green');
      log(`   Traductions à supprimer: ${totalToDelete}`, 'red');
      log(`   Espace libéré: ${totalToDelete} entrées`, 'blue');
    } else {
      log(`\n📊 Résumé du nettoyage:`, 'green');
      log(`   Traductions conservées: ${totalKept}`, 'green');
      log(`   Traductions supprimées: ${totalToDelete}`, 'green');
    }
    
    return { totalKept, totalToDelete };
  } catch (error) {
    logError(`Erreur lors du nettoyage: ${error.message}`);
    return { totalKept: 0, totalToDelete: 0 };
  }
}

// Fonction pour ajouter une contrainte unique
async function addUniqueConstraint(dryRun = true) {
  logStep(3, dryRun ? 'Simulation de l\'ajout de contrainte unique' : 'Ajout de contrainte unique');
  
  try {
    const constraintName = 'unique_message_translation_per_language';
    const constraintSQL = `ALTER TABLE "MessageTranslation" ADD CONSTRAINT "${constraintName}" UNIQUE ("messageId", "targetLanguage")`;
    
    if (dryRun) {
      log(`SQL à exécuter: ${constraintSQL}`, 'yellow');
      log(`Cette contrainte empêchera les futurs doublons`, 'green');
    } else {
      await prisma.$executeRawUnsafe(constraintSQL);
      log(`✅ Contrainte unique ajoutée avec succès`, 'green');
    }
    
    return true;
  } catch (error) {
    if (error.code === '23505') {
      logWarning(`Contrainte unique déjà existante: ${error.message}`);
    } else {
      logError(`Erreur lors de l'ajout de la contrainte: ${error.message}`);
    }
    return false;
  }
}

// Fonction pour vérifier l'intégrité après nettoyage
async function verifyIntegrity() {
  logStep(4, 'Vérification de l\'intégrité après nettoyage');
  
  try {
    // Vérifier qu'il n'y a plus de doublons
    const remainingDuplicates = await prisma.$queryRaw`
      SELECT 
        "messageId",
        "targetLanguage",
        COUNT(*) as count
      FROM "MessageTranslation"
      GROUP BY "messageId", "targetLanguage"
      HAVING COUNT(*) > 1
    `;
    
    if (remainingDuplicates.length === 0) {
      logSuccess('Aucun doublon restant détecté');
    } else {
      logError(`${remainingDuplicates.length} doublons restants détectés`);
    }
    
    // Statistiques générales
    const totalTranslations = await prisma.messageTranslation.count();
    const totalMessages = await prisma.message.count();
    
    log(`📊 Statistiques finales:`, 'blue');
    log(`   Messages: ${totalMessages}`, 'blue');
    log(`   Traductions: ${totalTranslations}`, 'blue');
    log(`   Moyenne traductions/message: ${(totalTranslations / totalMessages).toFixed(2)}`, 'blue');
    
    return remainingDuplicates.length === 0;
  } catch (error) {
    logError(`Erreur lors de la vérification: ${error.message}`);
    return false;
  }
}

// Fonction principale
async function runCleanup(dryRun = true) {
  log('🧹 Nettoyage des doublons de traductions', 'bright');
  log(`Mode: ${dryRun ? 'SIMULATION (DRY RUN)' : 'EXÉCUTION RÉELLE'}`, dryRun ? 'yellow' : 'red');
  
  if (!dryRun) {
    log('\n⚠️  ATTENTION: Cette opération va supprimer des données de la base!', 'red');
    log('Assurez-vous d\'avoir une sauvegarde avant de continuer.', 'red');
  }
  
  try {
    // Étape 1: Identifier les doublons
    const duplicates = await identifyDuplicates();
    
    if (duplicates.length === 0) {
      logSuccess('Aucun doublon trouvé. La base de données est propre.');
      return;
    }
    
    // Étape 2: Nettoyer les doublons
    const cleanupResult = await cleanupDuplicates(duplicates, dryRun);
    
    // Étape 3: Ajouter une contrainte unique (optionnel)
    if (!dryRun && cleanupResult.totalToDelete > 0) {
      await addUniqueConstraint(false);
    }
    
    // Étape 4: Vérifier l'intégrité
    if (!dryRun) {
      await verifyIntegrity();
    }
    
    log('\n🎯 Résumé de l\'opération:', 'bright');
    log(`   Doublons identifiés: ${duplicates.length}`, 'blue');
    log(`   Traductions à supprimer: ${cleanupResult.totalToDelete}`, 'red');
    log(`   Traductions à conserver: ${cleanupResult.totalKept}`, 'green');
    
    if (dryRun) {
      log('\n💡 Pour exécuter le nettoyage réel, relancez avec --execute', 'yellow');
    } else {
      log('\n✅ Nettoyage terminé avec succès', 'green');
    }
    
  } catch (error) {
    logError(`Erreur lors du nettoyage: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');

// Exécuter le nettoyage
if (require.main === module) {
  runCleanup(isDryRun).catch(console.error);
}

module.exports = {
  runCleanup,
  identifyDuplicates,
  cleanupDuplicates,
  addUniqueConstraint,
  verifyIntegrity
};
