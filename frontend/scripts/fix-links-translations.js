#!/usr/bin/env node

/**
 * Script pour corriger la structure des traductions de la page links
 */

const fs = require('fs');
const path = require('path');

function fixTranslations() {
  const localesDir = path.join(__dirname, '..', 'locales');
  const languages = ['fr', 'en', 'pt'];
  
  languages.forEach(lang => {
    const filePath = path.join(localesDir, `${lang}.json`);
    console.log(`\n🔧 Correction des traductions ${lang}...`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const obj = JSON.parse(content);
      
      // Trouver la section links dans toasts
      let linksSection = null;
      if (obj.toasts && obj.toasts.links) {
        linksSection = obj.toasts.links;
        console.log(`✅ Section links trouvée dans toasts pour ${lang}`);
      }
      
      if (linksSection) {
        // Déplacer la section links vers la structure principale
        obj.links = linksSection;
        
        // Supprimer la section links de toasts
        delete obj.toasts.links;
        
        // Écrire le fichier corrigé
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
        console.log(`✅ Section links déplacée vers la structure principale pour ${lang}`);
      } else {
        console.log(`⚠️  Section links non trouvée dans toasts pour ${lang}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors de la correction de ${lang}:`, error.message);
    }
  });
}

// Exécuter le script
if (require.main === module) {
  fixTranslations();
}

module.exports = { fixTranslations };
