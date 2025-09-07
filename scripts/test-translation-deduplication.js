#!/usr/bin/env node

/**
 * Script de test pour valider la correction des doublons de traductions
 * 
 * Ce script teste :
 * 1. La logique de déduplication dans le frontend
 * 2. La construction des availableVersions
 * 3. La gestion des timestamps
 * 4. Les cas limites
 */

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
  log(`\n[TEST ${step}] ${message}`, 'cyan');
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

// Simulation de la logique de déduplication du composant BubbleMessage
function simulateAvailableVersionsConstruction(message) {
  // Logique corrigée du composant BubbleMessage
  const availableVersions = [
    {
      language: message.originalLanguage,
      content: message.originalContent || message.content,
      isOriginal: true,
      status: 'completed',
      confidence: 1,
      timestamp: new Date(message.createdAt)
    },
    // Déduplication des traductions par langue - garder la plus récente
    ...Object.values(
      message.translations
        .filter(t => t.status === 'completed' && t.language)
        .reduce((acc, t) => {
          // Garder la traduction la plus récente pour chaque langue
          const currentTimestamp = new Date(t.timestamp || 0);
          const existingTimestamp = acc[t.language] ? new Date(acc[t.language].timestamp || 0) : new Date(0);
          
          if (!acc[t.language] || currentTimestamp > existingTimestamp) {
            acc[t.language] = {
              ...t,
              isOriginal: false
            };
          }
          return acc;
        }, {})
    )
  ];
  
  return availableVersions;
}

// Test 1: Message sans traductions
function testMessageWithoutTranslations() {
  logStep(1, 'Message sans traductions');
  
  const message = {
    id: 'msg-1',
    content: 'Hello world',
    originalContent: 'Hello world',
    originalLanguage: 'en',
    createdAt: '2024-01-01T10:00:00Z',
    translations: []
  };
  
  const availableVersions = simulateAvailableVersionsConstruction(message);
  
  if (availableVersions.length === 1 && availableVersions[0].isOriginal) {
    logSuccess('Message sans traductions: OK');
    return true;
  } else {
    logError(`Message sans traductions: ÉCHEC - ${availableVersions.length} versions au lieu de 1`);
    return false;
  }
}

// Test 2: Message avec traductions uniques
function testMessageWithUniqueTranslations() {
  logStep(2, 'Message avec traductions uniques');
  
  const message = {
    id: 'msg-2',
    content: 'Hello world',
    originalContent: 'Hello world',
    originalLanguage: 'en',
    createdAt: '2024-01-01T10:00:00Z',
    translations: [
      {
        language: 'fr',
        content: 'Bonjour le monde',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        confidence: 0.95
      },
      {
        language: 'es',
        content: 'Hola mundo',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:02:00Z'),
        confidence: 0.92
      }
    ]
  };
  
  const availableVersions = simulateAvailableVersionsConstruction(message);
  
  if (availableVersions.length === 3) { // original + 2 traductions
    const languages = availableVersions.map(v => v.language);
    const uniqueLanguages = [...new Set(languages)];
    
    if (languages.length === uniqueLanguages.length) {
      logSuccess('Message avec traductions uniques: OK');
      return true;
    } else {
      logError('Message avec traductions uniques: ÉCHEC - doublons détectés');
      return false;
    }
  } else {
    logError(`Message avec traductions uniques: ÉCHEC - ${availableVersions.length} versions au lieu de 3`);
    return false;
  }
}

// Test 3: Message avec doublons de traductions
function testMessageWithDuplicateTranslations() {
  logStep(3, 'Message avec doublons de traductions');
  
  const message = {
    id: 'msg-3',
    content: 'Hello world',
    originalContent: 'Hello world',
    originalLanguage: 'en',
    createdAt: '2024-01-01T10:00:00Z',
    translations: [
      {
        language: 'fr',
        content: 'Bonjour le monde (v1)',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        confidence: 0.90
      },
      {
        language: 'fr',
        content: 'Bonjour le monde (v2)',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:03:00Z'), // Plus récent
        confidence: 0.95
      },
      {
        language: 'es',
        content: 'Hola mundo',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:02:00Z'),
        confidence: 0.92
      }
    ]
  };
  
  const availableVersions = simulateAvailableVersionsConstruction(message);
  
  // Devrait avoir 3 versions: original + fr (v2) + es
  if (availableVersions.length === 3) {
    const frTranslation = availableVersions.find(v => v.language === 'fr' && !v.isOriginal);
    
    if (frTranslation && frTranslation.content === 'Bonjour le monde (v2)') {
      logSuccess('Message avec doublons: OK - version la plus récente conservée');
      return true;
    } else {
      logError('Message avec doublons: ÉCHEC - mauvaise version conservée');
      return false;
    }
  } else {
    logError(`Message avec doublons: ÉCHEC - ${availableVersions.length} versions au lieu de 3`);
    return false;
  }
}

// Test 4: Message avec traductions sans timestamp
function testMessageWithMissingTimestamps() {
  logStep(4, 'Message avec traductions sans timestamp');
  
  const message = {
    id: 'msg-4',
    content: 'Hello world',
    originalContent: 'Hello world',
    originalLanguage: 'en',
    createdAt: '2024-01-01T10:00:00Z',
    translations: [
      {
        language: 'fr',
        content: 'Bonjour le monde (sans timestamp)',
        status: 'completed',
        timestamp: null,
        confidence: 0.90
      },
      {
        language: 'fr',
        content: 'Bonjour le monde (avec timestamp)',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        confidence: 0.95
      }
    ]
  };
  
  const availableVersions = simulateAvailableVersionsConstruction(message);
  
  // Devrait garder la traduction avec timestamp
  const frTranslation = availableVersions.find(v => v.language === 'fr' && !v.isOriginal);
  
  if (frTranslation && frTranslation.content === 'Bonjour le monde (avec timestamp)') {
    logSuccess('Message avec timestamps manquants: OK - traduction avec timestamp conservée');
    return true;
  } else {
    logError('Message avec timestamps manquants: ÉCHEC - mauvaise traduction conservée');
    return false;
  }
}

// Test 5: Message avec traductions en cours
function testMessageWithPendingTranslations() {
  logStep(5, 'Message avec traductions en cours');
  
  const message = {
    id: 'msg-5',
    content: 'Hello world',
    originalContent: 'Hello world',
    originalLanguage: 'en',
    createdAt: '2024-01-01T10:00:00Z',
    translations: [
      {
        language: 'fr',
        content: 'Bonjour le monde',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        confidence: 0.95
      },
      {
        language: 'de',
        content: '',
        status: 'translating',
        timestamp: new Date('2024-01-01T10:02:00Z'),
        confidence: 0
      }
    ]
  };
  
  const availableVersions = simulateAvailableVersionsConstruction(message);
  
  // Devrait avoir 2 versions: original + fr (pas de de car status !== 'completed')
  if (availableVersions.length === 2) {
    const hasFrench = availableVersions.some(v => v.language === 'fr' && !v.isOriginal);
    const hasGerman = availableVersions.some(v => v.language === 'de' && !v.isOriginal);
    
    if (hasFrench && !hasGerman) {
      logSuccess('Message avec traductions en cours: OK - traductions en cours ignorées');
      return true;
    } else {
      logError('Message avec traductions en cours: ÉCHEC - mauvaise logique de filtrage');
      return false;
    }
  } else {
    logError(`Message avec traductions en cours: ÉCHEC - ${availableVersions.length} versions au lieu de 2`);
    return false;
  }
}

// Test 6: Message avec traductions sans langue
function testMessageWithMissingLanguage() {
  logStep(6, 'Message avec traductions sans langue');
  
  const message = {
    id: 'msg-6',
    content: 'Hello world',
    originalContent: 'Hello world',
    originalLanguage: 'en',
    createdAt: '2024-01-01T10:00:00Z',
    translations: [
      {
        language: 'fr',
        content: 'Bonjour le monde',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        confidence: 0.95
      },
      {
        language: null, // Langue manquante
        content: 'Traduction sans langue',
        status: 'completed',
        timestamp: new Date('2024-01-01T10:02:00Z'),
        confidence: 0.90
      }
    ]
  };
  
  const availableVersions = simulateAvailableVersionsConstruction(message);
  
  // Devrait avoir 2 versions: original + fr (pas de traduction sans langue)
  if (availableVersions.length === 2) {
    const hasFrench = availableVersions.some(v => v.language === 'fr' && !v.isOriginal);
    const hasNullLanguage = availableVersions.some(v => v.language === null && !v.isOriginal);
    
    if (hasFrench && !hasNullLanguage) {
      logSuccess('Message avec traductions sans langue: OK - traductions sans langue ignorées');
      return true;
    } else {
      logError('Message avec traductions sans langue: ÉCHEC - mauvaise logique de filtrage');
      return false;
    }
  } else {
    logError(`Message avec traductions sans langue: ÉCHEC - ${availableVersions.length} versions au lieu de 2`);
    return false;
  }
}

// Fonction principale de test
async function runTests() {
  log('🧪 Tests de validation de la correction des doublons de traductions', 'bright');
  
  const tests = [
    testMessageWithoutTranslations,
    testMessageWithUniqueTranslations,
    testMessageWithDuplicateTranslations,
    testMessageWithMissingTimestamps,
    testMessageWithPendingTranslations,
    testMessageWithMissingLanguage
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = test();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      logError(`Erreur lors du test: ${error.message}`);
    }
  }
  
  log('\n📊 Résumé des tests:', 'bright');
  log(`   Tests réussis: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'red');
  
  if (passedTests === totalTests) {
    log('\n🎉 Tous les tests sont passés ! La correction fonctionne correctement.', 'green');
  } else {
    log('\n⚠️  Certains tests ont échoué. Vérifiez la logique de déduplication.', 'yellow');
  }
  
  return passedTests === totalTests;
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  simulateAvailableVersionsConstruction,
  testMessageWithoutTranslations,
  testMessageWithUniqueTranslations,
  testMessageWithDuplicateTranslations,
  testMessageWithMissingTimestamps,
  testMessageWithPendingTranslations,
  testMessageWithMissingLanguage
};
