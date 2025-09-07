#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration simple pour les langues FR, EN, PT
const languages = ['fr', 'en', 'pt'];

console.log('🔍 Vérification simplifiée des traductions FR, EN, PT\n');

// Charger les fichiers de traduction
const translations = {};
let hasErrors = false;

for (const lang of languages) {
  const filePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    translations[lang] = JSON.parse(content);
    console.log(`✅ ${lang}.json chargé (${Object.keys(translations[lang]).length} sections principales)`);
  } catch (error) {
    console.log(`❌ Erreur lors du chargement de ${lang}.json:`, error.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.log('\n❌ Impossible de continuer à cause des erreurs de chargement');
  process.exit(1);
}

// Vérifier les sections essentielles
const essentialSections = ['languageNames', 'common', 'navigation', 'dashboard'];

console.log('\n🔍 Vérification des sections essentielles...');

for (const section of essentialSections) {
  console.log(`\n📁 Section: ${section}`);
  
  for (const lang of languages) {
    const hasSection = translations[lang][section];
    if (hasSection) {
      const keysCount = typeof hasSection === 'object' ? Object.keys(hasSection).length : 0;
      console.log(`  ✅ ${lang}: ${keysCount} clés`);
    } else {
      console.log(`  ❌ ${lang}: Section manquante`);
      hasErrors = true;
    }
  }
}

// Vérifier que le dashboard est traduit (problème original)
console.log('\n🎯 Vérification spécifique du dashboard...');

for (const lang of languages) {
  const dashboard = translations[lang].dashboard;
  if (dashboard) {
    const hasTitle = dashboard.title;
    const hasWelcome = dashboard.welcome;
    const hasStats = dashboard.stats;
    
    if (hasTitle && hasWelcome && hasStats) {
      console.log(`  ✅ ${lang}: Dashboard complet (titre, welcome, stats)`);
    } else {
      console.log(`  ⚠️  ${lang}: Dashboard incomplet`);
      if (!hasTitle) console.log(`    - title manquant`);
      if (!hasWelcome) console.log(`    - welcome manquant`);
      if (!hasStats) console.log(`    - stats manquant`);
    }
  } else {
    console.log(`  ❌ ${lang}: Pas de section dashboard`);
    hasErrors = true;
  }
}

// Vérifier la cohérence des clés entre langues
console.log('\n🔄 Vérification de la cohérence entre langues...');

const frenchKeys = translations.fr;
for (const [section, sectionData] of Object.entries(frenchKeys)) {
  if (typeof sectionData === 'object' && sectionData !== null) {
    const frenchCount = Object.keys(sectionData).length;
    
    for (const lang of languages.filter(l => l !== 'fr')) {
      const langSection = translations[lang][section];
      if (langSection && typeof langSection === 'object') {
        const langCount = Object.keys(langSection).length;
        
        if (Math.abs(frenchCount - langCount) > 5) { // Tolérance de 5 clés
          console.log(`  ⚠️  ${section}: FR=${frenchCount} clés, ${lang.toUpperCase()}=${langCount} clés (différence notable)`);
        }
      }
    }
  }
}

// Rapport final
console.log('\n📊 Résumé:');
for (const lang of languages) {
  const sectionsCount = Object.keys(translations[lang]).length;
  console.log(`  ${lang.toUpperCase()}: ${sectionsCount} sections principales`);
}

if (!hasErrors) {
  console.log('\n✅ Toutes les vérifications essentielles passent !');
  console.log('\n🎯 Le problème original des traductions du dashboard semble résolu.');
  process.exit(0);
} else {
  console.log('\n❌ Des problèmes ont été détectés dans les traductions');
  process.exit(1);
}
