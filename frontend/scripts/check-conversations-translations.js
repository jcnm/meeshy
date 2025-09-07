#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fonction pour extraire les clés de traduction utilisées dans un fichier
function extractTranslationKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  
  // Rechercher les appels t('key') ou t('key.subkey') avec des patterns plus stricts
  const patterns = [
    /\bt\(['"`]([a-zA-Z][a-zA-Z0-9._-]*?)['"`]\s*\)/g,  // t('key')
    /\buseTranslations\(['"`]([a-zA-Z][a-zA-Z0-9._-]*?)['"`]\s*\)/g,  // useTranslations('namespace')
    /\bt\(['"`]([a-zA-Z][a-zA-Z0-9._-]*?)['"`]\s*,/g,  // t('key', params)
  ];
  
  patterns.forEach(regex => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const key = match[1];
      // Filtrer les clés valides (pas d'URLs, pas de chemins de fichiers)
      if (key && 
          !key.includes('/') && 
          !key.includes('${') && 
          !key.includes('<') && 
          !key.includes('\\') &&
          !key.includes('@') &&
          !key.includes(':') &&
          !key.includes(',') &&
          key.length > 1 &&
          key.length < 100 &&
          !/^[0-9]+$/.test(key)) {
        keys.add(key);
      }
    }
  });
  
  return Array.from(keys);
}

// Fonction pour charger les clés disponibles dans un fichier de traduction
function loadTranslationKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const translations = JSON.parse(content);
  const keys = new Set();
  
  function extractKeys(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        extractKeys(value, fullKey);
      } else {
        keys.add(fullKey);
      }
    }
  }
  
  extractKeys(translations);
  return Array.from(keys);
}

// Fonction pour récursivement trouver tous les fichiers .tsx et .ts dans un dossier
function findConversationFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Fonction principale
function checkConversationsTranslations() {
  console.log('🔍 Vérification des traductions pour les composants /conversations...\n');
  
  // Dossier des composants conversations
  const conversationsDir = path.join(__dirname, '../components/conversations');
  
  // Fichiers de traduction
  const translationFiles = {
    fr: path.join(__dirname, '../locales/fr.json'),
    en: path.join(__dirname, '../locales/en.json'),
    pt: path.join(__dirname, '../locales/pt.json')
  };
  
  // Vérifier que les dossiers existent
  if (!fs.existsSync(conversationsDir)) {
    console.error('❌ Dossier conversations non trouvé:', conversationsDir);
    return;
  }
  
  // Trouver tous les fichiers de composants
  const componentFiles = findConversationFiles(conversationsDir);
  console.log(`📁 Fichiers trouvés: ${componentFiles.length}`);
  
  // Extraire toutes les clés utilisées
  const allUsedKeys = new Set();
  const namespaceKeys = new Map(); // namespace -> Set of keys
  
  componentFiles.forEach(file => {
    const keys = extractTranslationKeys(file);
    const relativePath = path.relative(process.cwd(), file);
    
    // Analyser les namespaces utilisés
    const content = fs.readFileSync(file, 'utf8');
    const namespaceMatches = content.match(/\buseTranslations\(['"`]([a-zA-Z][a-zA-Z0-9._-]*?)['"`]\s*\)/g);
    
    if (namespaceMatches) {
      namespaceMatches.forEach(match => {
        const namespace = match.match(/['"`]([a-zA-Z][a-zA-Z0-9._-]*?)['"`]/)[1];
        if (!namespaceKeys.has(namespace)) {
          namespaceKeys.set(namespace, new Set());
        }
        
        // Ajouter les clés utilisées avec ce namespace
        keys.forEach(key => {
          namespaceKeys.get(namespace).add(key);
          allUsedKeys.add(`${namespace}.${key}`);
        });
      });
    }
    
    console.log(`  📄 ${relativePath}: ${keys.length} clés`);
  });
  
  console.log(`\n📊 Total des clés utilisées: ${allUsedKeys.size}`);
  console.log(`📊 Namespaces utilisés: ${namespaceKeys.size}`);
  
  // Vérifier chaque langue
  const languages = ['fr', 'en', 'pt'];
  let hasErrors = false;
  
  languages.forEach(lang => {
    console.log(`\n🌍 Vérification pour ${lang.toUpperCase()}:`);
    
    if (!fs.existsSync(translationFiles[lang])) {
      console.error(`❌ Fichier de traduction manquant: ${translationFiles[lang]}`);
      hasErrors = true;
      return;
    }
    
    const availableKeys = loadTranslationKeys(translationFiles[lang]);
    console.log(`  📋 Clés disponibles: ${availableKeys.length}`);
    
    // Vérifier chaque namespace
    namespaceKeys.forEach((keys, namespace) => {
      console.log(`\n  📦 Namespace: ${namespace}`);
      
      const missingKeys = [];
      keys.forEach(key => {
        const fullKey = `${namespace}.${key}`;
        if (!availableKeys.includes(fullKey)) {
          missingKeys.push(key);
        }
      });
      
      if (missingKeys.length === 0) {
        console.log(`    ✅ Toutes les clés sont présentes (${keys.size} clés)`);
      } else {
        console.log(`    ❌ Clés manquantes (${missingKeys.length}/${keys.size}):`);
        missingKeys.forEach(key => {
          console.log(`      - ${namespace}.${key}`);
        });
        hasErrors = true;
      }
    });
  });
  
  // Résumé
  console.log('\n' + '='.repeat(60));
  if (hasErrors) {
    console.log('❌ ERREURS TROUVÉES: Certaines clés de traduction sont manquantes');
    console.log('💡 Ajoutez les clés manquantes dans les fichiers de traduction correspondants');
    process.exit(1);
  } else {
    console.log('✅ SUCCÈS: Toutes les clés de traduction sont présentes');
    console.log('🎉 L\'interface /conversations est entièrement internationalisée');
  }
}

// Exécuter le script
if (require.main === module) {
  checkConversationsTranslations();
}

module.exports = { checkConversationsTranslations };
