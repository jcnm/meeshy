// Script de test pour la traduction et le nettoyage des tokens spéciaux
// Pour les besoins de tests, nous définissons les fonctions ici directement

// Fonction de nettoyage de base
function cleanTranslationOutput(text) {
  if (!text) return '';
  
  return text
    // Nettoyer les tokens extra_id de MT5
    .replace(/<extra_id_\d+>/g, '')
    // Nettoyer les caractères spéciaux de tokenisation NLLB
    .replace(/▁/g, ' ')
    // Nettoyer les tokens de MT5
    .replace(/<pad>|<\/pad>/g, '')
    .replace(/<unk>|<\/unk>/g, '')
    .replace(/<\/s>|<s>/g, '')
    // Gérer les problèmes courants
    .replace(/\s{2,}/g, ' ') // Normaliser les espaces multiples
    .trim();
}

// Fonction de nettoyage avancée
function deepCleanTranslationOutput(text) {
  if (!text) return '';
  
  let cleaned = cleanTranslationOutput(text);
  
  // Corrections supplémentaires pour les cas problématiques
  cleaned = cleaned
    // Normaliser la ponctuation collée sans espace
    .replace(/([.,!?;:])([A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1 $2')
    // Normaliser les guillemets
    .replace(/["']([^"']*?)["']/g, '"$1"')
    // Supprimer les séquences de caractères non imprimables
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Normaliser les espaces avant la ponctuation française
    .replace(/\s+([.,!?;:])/g, '$1');

  return cleaned.trim();
}

// Fonction de test pour vérifier le nettoyage des tokens
async function testTranslationCleaning() {
  console.log('\n🧪 TEST DE NETTOYAGE DES TOKENS DE TRADUCTION 🧪\n');
  
  // Test de nettoyage de textes avec des tokens spéciaux
  const testCases = [
    { 
      input: 'Hello <extra_id_0> world',
      expected: 'Hello world'
    },
    { 
      input: 'Bonjour▁le▁monde',
      expected: 'Bonjour le monde'
    },
    { 
      input: '<s>This is a test</s>',
      expected: 'This is a test'
    },
    { 
      input: '<pad>Testing<extra_id_0> cleaning <extra_id_1>tokens</pad>',
      expected: 'Testing cleaning tokens'
    },
    { 
      input: 'Multiple   spaces   should be   normalized',
      expected: 'Multiple spaces should be normalized'
    }
  ];
  
  console.log('=== TESTS DE NETTOYAGE BASIQUE ===');
  testCases.forEach((testCase, index) => {
    const cleaned = cleanTranslationOutput(testCase.input);
    const success = cleaned === testCase.expected;
    
    console.log(`\nTest ${index + 1}:`);
    console.log(`Input:    "${testCase.input}"`);
    console.log(`Cleaned:  "${cleaned}"`);
    console.log(`Expected: "${testCase.expected}"`);
    console.log(`Résultat: ${success ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
    
    if (!success) {
      console.log('Différences:');
      for (let i = 0; i < Math.max(cleaned.length, testCase.expected.length); i++) {
        if (cleaned[i] !== testCase.expected[i]) {
          console.log(`Position ${i}: '${cleaned[i] || ' '}' vs '${testCase.expected[i] || ' '}'`);
        }
      }
    }
  });
  
  console.log('\n=== TESTS DE NETTOYAGE PROFOND ===');
  const deepTestCases = [
    { 
      input: 'Hello<extra_id_0>,world! How are you?',
      expected: 'Hello, world! How are you?'
    },
    { 
      input: 'This is a.test of punctuation',
      expected: 'This is a. test of punctuation'
    },
    { 
      input: 'Je suis "très" content de vous voir',
      expected: 'Je suis "très" content de vous voir'
    }
  ];
  
  deepTestCases.forEach((testCase, index) => {
    const cleaned = deepCleanTranslationOutput(testCase.input);
    const success = cleaned === testCase.expected;
    
    console.log(`\nTest ${index + 1}:`);
    console.log(`Input:    "${testCase.input}"`);
    console.log(`Cleaned:  "${cleaned}"`);
    console.log(`Expected: "${testCase.expected}"`);
    console.log(`Résultat: ${success ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
  });
}

// Fonction principale
async function main() {
  try {
    await testTranslationCleaning();
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  }
}

// Exécuter les tests
main();
