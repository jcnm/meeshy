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

// Fonction pour trouver tous les fichiers TSX et TS dans le projet
function findAllComponentFiles(dir) {
  const files = [];
  const fs = require('fs');
  const path = require('path');
  
  function scan(directory) {
    try {
      const items = fs.readdirSync(directory);
      
      for (const item of items) {
        const fullPath = path.join(directory, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Ignorer certains dossiers
          if (!['node_modules', '.next', 'dist', '.git', '__tests__', 'coverage'].includes(item)) {
            scan(fullPath);
          }
        } else if (stat.isFile() && (item.endsWith('.tsx') || item.endsWith('.ts')) && !item.endsWith('.d.ts')) {
          // Obtenir le chemin relatif
          const relativePath = path.relative(path.join(__dirname, '..'), fullPath);
          files.push(relativePath);
        }
      }
    } catch (error) {
      // Ignorer les erreurs de permission
    }
  }
  
  scan(dir);
  return files;
}

// Trouver tous les composants à vérifier
const componentsToCheck = findAllComponentFiles(path.join(__dirname, '..'));

// Fichiers de traduction (focus on FR, EN, PT for now)
const translationFiles = [
  'locales/fr.json',
  'locales/en.json',
  'locales/pt.json'
];

console.log('🔍 Vérification des clés de traduction...\n');
console.log(`📊 ${componentsToCheck.length} fichiers à analyser\n`);

let hasErrors = false;
let totalUsedKeys = new Set();

// Vérifier chaque composant
let checkedFiles = 0;
let filesWithTranslations = 0;

for (const componentPath of componentsToCheck) {
  const fullPath = path.join(__dirname, '..', componentPath);
  
  if (!fs.existsSync(fullPath)) {
    continue;
  }
  
  checkedFiles++;
  
  try {
    const usedKeys = extractTranslationKeys(fullPath);
    
    if (usedKeys.length === 0) {
      continue;
    }
    
    filesWithTranslations++;
    console.log(`📁 ${componentPath} (${usedKeys.length} clés)`);
    
    // Ajouter les clés utilisées au total
    usedKeys.forEach(key => totalUsedKeys.add(key));
    
    // Vérifier chaque fichier de traduction
    for (const translationFile of translationFiles) {
      const translationPath = path.join(__dirname, '..', translationFile);
      const availableKeys = loadTranslationKeys(translationPath);
      
      const missingKeys = usedKeys.filter(key => !availableKeys.includes(key));
      
      if (missingKeys.length > 0) {
        console.log(`   ❌ Clés manquantes dans ${translationFile}:`);
        missingKeys.forEach(key => console.log(`      - ${key}`));
        hasErrors = true;
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Erreur dans ${componentPath}: ${error.message}`);
    hasErrors = true;
  }
}

console.log(`\n📊 Résumé:`);
console.log(`   - ${checkedFiles} fichiers analysés`);
console.log(`   - ${filesWithTranslations} fichiers avec traductions`);
console.log(`   - ${totalUsedKeys.size} clés uniques utilisées\n`);

// Vérifier les clés orphelines (clés définies mais non utilisées)
console.log('🔍 Vérification des clés orphelines...\n');

for (const translationFile of translationFiles) {
  const translationPath = path.join(__dirname, '..', translationFile);
  const availableKeys = loadTranslationKeys(translationPath);
  
  const orphanKeys = availableKeys.filter(key => !totalUsedKeys.has(key));
  
  console.log(`📄 ${translationFile}:`);
  console.log(`   - ${availableKeys.length} clés définies`);
  console.log(`   - ${availableKeys.length - orphanKeys.length} clés utilisées`);
  console.log(`   - ${orphanKeys.length} clés orphelines`);
  
  if (orphanKeys.length > 0) {
    console.log(`\n   ⚠️  Clés orphelines:`);
    
    // Grouper les clés orphelines par section
    const groupedOrphans = {};
    orphanKeys.forEach(key => {
      const section = key.includes('.') ? key.split('.')[0] : 'root';
      if (!groupedOrphans[section]) {
        groupedOrphans[section] = [];
      }
      groupedOrphans[section].push(key);
    });
    
    Object.entries(groupedOrphans).forEach(([section, keys]) => {
      console.log(`      ${section}: ${keys.length} clés`);
      if (keys.length <= 10) {
        keys.forEach(key => console.log(`         - ${key}`));
      } else {
        keys.slice(0, 5).forEach(key => console.log(`         - ${key}`));
        console.log(`         ... et ${keys.length - 5} autres`);
      }
    });
  } else {
    console.log(`   ✅ Aucune clé orpheline`);
  }
  console.log('');
}

if (hasErrors) {
  console.log('❌ Des erreurs ont été trouvées dans les traductions');
  process.exit(1);
} else {
  console.log('✅ Toutes les traductions sont correctes !');
}
