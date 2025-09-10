#!/usr/bin/env node

/**
 * Script pour tester les traductions de la page links
 */

const fs = require('fs');
const path = require('path');

function testTranslations() {
  console.log('🧪 Test des traductions de la page links...\n');
  
  const localesDir = path.join(__dirname, '..', 'locales');
  const languages = ['fr', 'en', 'pt'];
  
  languages.forEach(lang => {
    console.log(`\n📋 Test des traductions ${lang}:`);
    
    try {
      const filePath = path.join(localesDir, `${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf8');
      const obj = JSON.parse(content);
      
      if (!obj.links) {
        console.log(`❌ Section links non trouvée pour ${lang}`);
        return;
      }
      
      // Test de quelques clés importantes
      const testKeys = [
        'title',
        'pageTitle',
        'pageDescription',
        'tabs.active',
        'tabs.expired',
        'tabs.disabled',
        'actions.copy',
        'actions.edit',
        'actions.delete',
        'status.active',
        'status.inactive',
        'success.linkCopied',
        'errors.loadFailed'
      ];
      
      let allKeysPresent = true;
      
      testKeys.forEach(key => {
        const value = getNestedValue(obj.links, key);
        if (value === undefined || value === null || value === '') {
          console.log(`   ❌ ${key}: manquante`);
          allKeysPresent = false;
        } else {
          console.log(`   ✅ ${key}: "${value}"`);
        }
      });
      
      if (allKeysPresent) {
        console.log(`\n🎉 Toutes les clés de test sont présentes pour ${lang}!`);
      } else {
        console.log(`\n⚠️  Certaines clés de test sont manquantes pour ${lang}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors du test de ${lang}:`, error.message);
    }
  });
}

// Fonction pour obtenir une valeur imbriquée d'un objet
function getNestedValue(obj, key) {
  return key.split('.').reduce((current, part) => current?.[part], obj);
}

// Exécuter le script
if (require.main === module) {
  testTranslations();
}

module.exports = { testTranslations };
