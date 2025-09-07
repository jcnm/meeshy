#!/usr/bin/env node

/**
 * Script de diagnostic pour identifier les doublons de traductions dans les bubbleMessage
 * 
 * Ce script analyse :
 * 1. La structure des données de traduction
 * 2. Les doublons potentiels dans la base de données
 * 3. La logique de construction des availableVersions
 * 4. Les problèmes de déduplication
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

// Fonction pour analyser les doublons dans la base de données
async function analyzeDatabaseDuplicates() {
  logStep(1, 'Analyse des doublons dans la base de données');
  
  try {
    // Rechercher les traductions en double pour le même message et la même langue
    const duplicateTranslations = await prisma.$queryRaw`
      SELECT 
        "messageId",
        "targetLanguage",
        COUNT(*) as count,
        ARRAY_AGG(id) as translation_ids,
        ARRAY_AGG("translatedContent") as contents
      FROM "MessageTranslation"
      GROUP BY "messageId", "targetLanguage"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
    
    if (duplicateTranslations.length > 0) {
      logWarning(`Trouvé ${duplicateTranslations.length} groupes de traductions en double:`);
      
      for (const duplicate of duplicateTranslations) {
        log(`\n📝 Message ${duplicate.messageId} -> ${duplicate.targetLanguage}:`, 'yellow');
        log(`   Nombre de traductions: ${duplicate.count}`, 'yellow');
        log(`   IDs: ${duplicate.translation_ids.join(', ')}`, 'yellow');
        
        // Afficher les contenus pour voir s'ils sont identiques
        const contents = duplicate.contents;
        const uniqueContents = [...new Set(contents)];
        
        if (uniqueContents.length === 1) {
          log(`   Contenu identique: "${uniqueContents[0].substring(0, 50)}..."`, 'green');
        } else {
          log(`   Contenus différents:`, 'red');
          uniqueContents.forEach((content, index) => {
            log(`     ${index + 1}: "${content.substring(0, 50)}..."`, 'red');
          });
        }
      }
    } else {
      logSuccess('Aucun doublon trouvé dans la base de données');
    }
    
    return duplicateTranslations;
  } catch (error) {
    logError(`Erreur lors de l'analyse des doublons: ${error.message}`);
    return [];
  }
}

// Fonction pour analyser la structure des messages avec traductions
async function analyzeMessageStructure() {
  logStep(2, 'Analyse de la structure des messages avec traductions');
  
  try {
    // Récupérer quelques messages avec leurs traductions
    const messages = await prisma.message.findMany({
      take: 5,
      include: {
        translations: {
          select: {
            id: true,
            targetLanguage: true,
            translatedContent: true,
            translationModel: true,
            confidenceScore: true,
            createdAt: true
          }
        },
        sender: {
          select: {
            id: true,
            username: true,
            systemLanguage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    log(`Analyse de ${messages.length} messages récents:`, 'blue');
    
    for (const message of messages) {
      log(`\n📨 Message ${message.id}:`, 'blue');
      log(`   Contenu: "${message.content.substring(0, 50)}..."`, 'blue');
      log(`   Langue originale: ${message.originalLanguage}`, 'blue');
      log(`   Auteur: ${message.sender?.username} (${message.sender?.systemLanguage})`, 'blue');
      log(`   Nombre de traductions: ${message.translations.length}`, 'blue');
      
      if (message.translations.length > 0) {
        log(`   Traductions:`, 'blue');
        message.translations.forEach((translation, index) => {
          log(`     ${index + 1}. ${translation.targetLanguage}: "${translation.translatedContent.substring(0, 30)}..." (${translation.translationModel}, ${Math.round(translation.confidenceScore * 100)}%)`, 'blue');
        });
        
        // Vérifier s'il y a des doublons dans ce message
        const languages = message.translations.map(t => t.targetLanguage);
        const uniqueLanguages = [...new Set(languages)];
        
        if (languages.length !== uniqueLanguages.length) {
          logWarning(`   ⚠️ DOUBLON DÉTECTÉ: ${languages.length} traductions pour ${uniqueLanguages.length} langues uniques`);
          
          // Identifier les langues en double
          const languageCounts = {};
          languages.forEach(lang => {
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;
          });
          
          Object.entries(languageCounts).forEach(([lang, count]) => {
            if (count > 1) {
              log(`     - ${lang}: ${count} traductions`, 'red');
            }
          });
        }
      }
    }
    
    return messages;
  } catch (error) {
    logError(`Erreur lors de l'analyse de la structure: ${error.message}`);
    return [];
  }
}

// Fonction pour simuler la logique de construction des availableVersions
function simulateAvailableVersionsConstruction(message) {
  logStep(3, 'Simulation de la construction des availableVersions');
  
  try {
    // Simuler la logique du composant BubbleMessage
    const availableVersions = [
      {
        language: message.originalLanguage,
        content: message.originalContent || message.content,
        isOriginal: true,
        status: 'completed',
        confidence: 1,
        timestamp: new Date(message.createdAt)
      },
      ...message.translations
        .filter(t => t.status === 'completed' && t.language)
        .map(t => ({
          ...t,
          isOriginal: false
        }))
    ];
    
    log(`Construction des availableVersions pour le message ${message.id}:`, 'blue');
    log(`   Nombre total de versions: ${availableVersions.length}`, 'blue');
    log(`   Version originale: ${availableVersions[0].language}`, 'blue');
    log(`   Traductions: ${availableVersions.length - 1}`, 'blue');
    
    // Vérifier les doublons dans availableVersions
    const languages = availableVersions.map(v => v.language);
    const uniqueLanguages = [...new Set(languages)];
    
    if (languages.length !== uniqueLanguages.length) {
      logWarning(`   ⚠️ DOUBLON DANS availableVersions: ${languages.length} versions pour ${uniqueLanguages.length} langues uniques`);
      
      // Identifier les langues en double
      const languageCounts = {};
      languages.forEach(lang => {
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      });
      
      Object.entries(languageCounts).forEach(([lang, count]) => {
        if (count > 1) {
          log(`     - ${lang}: ${count} versions`, 'red');
          
          // Afficher les détails des versions en double
          const duplicateVersions = availableVersions.filter(v => v.language === lang);
          duplicateVersions.forEach((version, index) => {
            log(`       ${index + 1}. ${version.isOriginal ? 'ORIGINAL' : 'TRADUCTION'}: "${version.content.substring(0, 30)}..."`, 'red');
          });
        }
      });
    } else {
      logSuccess(`   Aucun doublon dans availableVersions`);
    }
    
    return availableVersions;
  } catch (error) {
    logError(`Erreur lors de la simulation: ${error.message}`);
    return [];
  }
}

// Fonction pour proposer des solutions
function proposeSolutions(duplicates, messages) {
  logStep(4, 'Propositions de solutions');
  
  if (duplicates.length > 0) {
    log('🔧 Solutions pour les doublons en base de données:', 'yellow');
    log('   1. Nettoyer les doublons en gardant la traduction la plus récente', 'yellow');
    log('   2. Ajouter une contrainte unique sur (messageId, targetLanguage)', 'yellow');
    log('   3. Implémenter une logique de déduplication avant sauvegarde', 'yellow');
  }
  
  // Vérifier s'il y a des problèmes dans la logique frontend
  let hasFrontendDuplicates = false;
  for (const message of messages) {
    const availableVersions = simulateAvailableVersionsConstruction(message);
    const languages = availableVersions.map(v => v.language);
    const uniqueLanguages = [...new Set(languages)];
    
    if (languages.length !== uniqueLanguages.length) {
      hasFrontendDuplicates = true;
      break;
    }
  }
  
  if (hasFrontendDuplicates) {
    log('🔧 Solutions pour les doublons dans le frontend:', 'yellow');
    log('   1. Ajouter une déduplication dans la construction des availableVersions', 'yellow');
    log('   2. Utiliser un Map pour éviter les doublons par langue', 'yellow');
    log('   3. Filtrer les traductions par langue unique avant construction', 'yellow');
  }
  
  log('\n📋 Code de correction suggéré:', 'cyan');
  log(`
// Dans bubble-message.tsx, ligne 254-269, remplacer par:
const availableVersions = [
  {
    language: message.originalLanguage,
    content: message.originalContent || message.content,
    isOriginal: true,
    status: 'completed' as const,
    confidence: 1,
    timestamp: new Date(message.createdAt)
  },
  // Déduplication des traductions par langue
  ...Object.values(
    message.translations
      .filter(t => t.status === 'completed' && t.language)
      .reduce((acc, t) => {
        // Garder la traduction la plus récente pour chaque langue
        if (!acc[t.language] || new Date(t.timestamp || t.createdAt) > new Date(acc[t.language].timestamp || acc[t.language].createdAt)) {
          acc[t.language] = {
            ...t,
            isOriginal: false
          };
        }
        return acc;
      }, {} as Record<string, any>)
  )
];`, 'cyan');
}

// Fonction principale
async function runDiagnostic() {
  log('🔍 Diagnostic des doublons de traductions dans BubbleMessage', 'bright');
  
  try {
    // Étape 1: Analyser les doublons en base
    const duplicates = await analyzeDatabaseDuplicates();
    
    // Étape 2: Analyser la structure des messages
    const messages = await analyzeMessageStructure();
    
    // Étape 3: Simuler la construction des availableVersions
    for (const message of messages) {
      simulateAvailableVersionsConstruction(message);
    }
    
    // Étape 4: Proposer des solutions
    proposeSolutions(duplicates, messages);
    
    log('\n🎯 Résumé du diagnostic:', 'bright');
    log(`   Doublons en base: ${duplicates.length}`, duplicates.length > 0 ? 'red' : 'green');
    log(`   Messages analysés: ${messages.length}`, 'blue');
    
    if (duplicates.length > 0) {
      log('\n⚠️  Action recommandée: Nettoyer les doublons en base de données', 'yellow');
    }
    
  } catch (error) {
    logError(`Erreur lors du diagnostic: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le diagnostic si le script est appelé directement
if (require.main === module) {
  runDiagnostic().catch(console.error);
}

module.exports = {
  runDiagnostic,
  analyzeDatabaseDuplicates,
  analyzeMessageStructure,
  simulateAvailableVersionsConstruction,
  proposeSolutions
};
