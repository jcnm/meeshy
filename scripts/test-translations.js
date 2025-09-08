#!/usr/bin/env node

/**
 * Script de test pour vérifier les traductions
 * Vérifie que toutes les clés de traduction sont présentes et cohérentes
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour l'affichage
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Fonction pour lire et parser un fichier JSON
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log('red', `❌ Erreur lors de la lecture de ${filePath}: ${error.message}`);
    return null;
  }
}

// Fonction pour extraire toutes les clés d'un objet JSON
function extractKeys(obj, prefix = '') {
  const keys = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

// Fonction pour vérifier les clés manquantes
function checkMissingKeys(referenceKeys, targetKeys, targetName) {
  const missing = referenceKeys.filter(key => !targetKeys.includes(key));
  const extra = targetKeys.filter(key => !referenceKeys.includes(key));
  
  if (missing.length > 0) {
    log('red', `❌ Clés manquantes dans ${targetName}:`);
    missing.forEach(key => log('red', `   - ${key}`));
  }
  
  if (extra.length > 0) {
    log('yellow', `⚠️  Clés supplémentaires dans ${targetName}:`);
    extra.forEach(key => log('yellow', `   - ${key}`));
  }
  
  return missing.length === 0 && extra.length === 0;
}

// Fonction principale
function main() {
  log('blue', '🧪 Test des traductions Meeshy');
  log('blue', '================================');
  
  const localesDir = path.join(__dirname, '..', 'frontend', 'locales');
  
  // Vérifier que le répertoire existe
  if (!fs.existsSync(localesDir)) {
    log('red', `❌ Répertoire des traductions non trouvé: ${localesDir}`);
    process.exit(1);
  }
  
  // Lire tous les fichiers de traduction
  const translationFiles = fs.readdirSync(localesDir)
    .filter(file => file.endsWith('.json'))
    .map(file => ({
      name: file.replace('.json', ''),
      path: path.join(localesDir, file),
      data: readJsonFile(path.join(localesDir, file))
    }))
    .filter(file => file.data !== null);
  
  if (translationFiles.length === 0) {
    log('red', '❌ Aucun fichier de traduction valide trouvé');
    process.exit(1);
  }
  
  log('green', `✅ ${translationFiles.length} fichiers de traduction trouvés:`);
  translationFiles.forEach(file => log('cyan', `   - ${file.name}.json`));
  
  // Utiliser le français comme référence
  const frenchFile = translationFiles.find(f => f.name === 'fr');
  if (!frenchFile) {
    log('red', '❌ Fichier de traduction français non trouvé (utilisé comme référence)');
    process.exit(1);
  }
  
  log('blue', '\n📋 Analyse des clés de traduction...');
  
  const referenceKeys = extractKeys(frenchFile.data);
  log('green', `✅ ${referenceKeys.length} clés trouvées dans le fichier de référence (fr.json)`);
  
  // Vérifier chaque fichier de traduction
  let allValid = true;
  
  for (const file of translationFiles) {
    if (file.name === 'fr') continue; // Skip reference file
    
    log('blue', `\n🔍 Vérification de ${file.name}.json...`);
    
    const targetKeys = extractKeys(file.data);
    const isValid = checkMissingKeys(referenceKeys, targetKeys, file.name);
    
    if (isValid) {
      log('green', `✅ ${file.name}.json est cohérent avec fr.json`);
    } else {
      log('red', `❌ ${file.name}.json a des problèmes de cohérence`);
      allValid = false;
    }
  }
  
  // Vérifier les namespaces spécifiques
  log('blue', '\n🔍 Vérification des namespaces spécifiques...');
  
  const requiredNamespaces = [
    'conversationSearch',
    'landing',
    'auth',
    'conversations',
    'chatPage'
  ];
  
  for (const namespace of requiredNamespaces) {
    const hasNamespace = frenchFile.data[namespace] !== undefined;
    if (hasNamespace) {
      log('green', `✅ Namespace '${namespace}' présent`);
      
      // Vérifier la clé shareMessage dans conversationSearch
      if (namespace === 'conversationSearch') {
        const hasShareMessage = frenchFile.data[namespace].shareMessage !== undefined;
        if (hasShareMessage) {
          log('green', `✅ Clé 'shareMessage' présente dans conversationSearch`);
        } else {
          log('red', `❌ Clé 'shareMessage' manquante dans conversationSearch`);
          allValid = false;
        }
      }
    } else {
      log('red', `❌ Namespace '${namespace}' manquant`);
      allValid = false;
    }
  }
  
  // Résumé final
  log('blue', '\n📊 Résumé des tests:');
  if (allValid) {
    log('green', '🎉 Tous les tests de traduction sont passés avec succès !');
    log('green', '✅ Toutes les clés sont cohérentes entre les langues');
    log('green', '✅ Tous les namespaces requis sont présents');
    log('green', '✅ La clé shareMessage est correctement définie');
  } else {
    log('red', '❌ Certains tests de traduction ont échoué');
    log('yellow', '💡 Vérifiez les erreurs ci-dessus et corrigez-les');
  }
  
  process.exit(allValid ? 0 : 1);
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { main };
