/**
 * Test de vérification des fonctions de langues unifiées
 * À utiliser temporairement pour valider l'intégration
 */

import { 
  getLanguageInfo, 
  SUPPORTED_LANGUAGES, 
  getLanguageName,
  getLanguageFlag,
  getLanguageColor,
  isSupportedLanguage,
  getSupportedLanguageCodes
} from '@shared/types';

console.log('🧪 Test des fonctions de langues unifiées');
console.log('========================================');

// Test 1: Liste des langues supportées
console.log(`✅ Nombre de langues supportées: ${SUPPORTED_LANGUAGES.length}`);
console.log(`✅ Codes: ${getSupportedLanguageCodes().join(', ')}`);

// Test 2: Fonctions getLanguageInfo
console.log('\n📝 Test getLanguageInfo:');
const testCodes = ['fr', 'en', 'unknown', '', undefined];
testCodes.forEach(code => {
  const info = getLanguageInfo(code);
  console.log(`  ${code || 'undefined'} → ${info.name} (${info.flag})`);
});

// Test 3: Fonctions utilitaires
console.log('\n🔧 Test fonctions utilitaires:');
console.log(`  getLanguageName('es'): ${getLanguageName('es')}`);
console.log(`  getLanguageFlag('zh'): ${getLanguageFlag('zh')}`);
console.log(`  getLanguageColor('fr'): ${getLanguageColor('fr')}`);

// Test 4: Validation
console.log('\n✅ Test validation:');
console.log(`  isSupportedLanguage('fr'): ${isSupportedLanguage('fr')}`);
console.log(`  isSupportedLanguage('xyz'): ${isSupportedLanguage('xyz')}`);

console.log('\n🎉 Tests terminés !');

export {};