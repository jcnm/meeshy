#!/usr/bin/env node

/**
 * Script de test pour le traitement des traductions côté frontend
 */

// Simuler les données d'un utilisateur admin
const currentUser = {
  id: 'cmeo0yuee0003le07s08abui3',
  username: 'admin',
  systemLanguage: 'en',
  regionalLanguage: 'fr',
  customDestinationLanguage: 'es', // Changé pour espagnol
  autoTranslateEnabled: true,
  translateToSystemLanguage: false,
  translateToRegionalLanguage: false,
  useCustomDestination: true // Activé pour utiliser la langue personnalisée
};

// Simuler les messages avec traductions de l'API
const messagesFromApi = [
  {
    id: 'cmeohhg2c0001s6h3hq2dugq9',
    content: 'Hello guys...',
    originalLanguage: 'en',
    translations: [
      {
        id: 'trans1',
        targetLanguage: 'es',
        translatedContent: 'Hola muchachos ....',
        translationModel: 'nllb-200-distilled-600M',
        cacheKey: 'cache1'
      }
    ]
  },
  {
    id: 'cmeohtbab0002s6dl7kp19v6g',
    content: 'This is how things are suppose to work...',
    originalLanguage: 'en',
    translations: [
      {
        id: 'trans2',
        targetLanguage: 'es',
        translatedContent: 'Así se supone que funcionan la...',
        translationModel: 'nllb-200-distilled-600M',
        cacheKey: 'cache2'
      }
    ]
  }
];

// Simuler la fonction resolveUserPreferredLanguage
function resolveUserPreferredLanguage() {
  if (currentUser.useCustomDestination && currentUser.customDestinationLanguage) {
    return currentUser.customDestinationLanguage;
  }
  
  if (currentUser.translateToSystemLanguage) {
    return currentUser.systemLanguage;
  }
  
  if (currentUser.translateToRegionalLanguage) {
    return currentUser.regionalLanguage;
  }
  
  return currentUser.systemLanguage; // fallback
}

// Simuler la fonction processMessageWithTranslations
function processMessageWithTranslations(message) {
  console.log(`🔄 Traitement message ${message.id}:`, {
    originalLanguage: message.originalLanguage,
    translationsCount: message.translations?.length || 0,
    translationsData: message.translations
  });

  // Convertir les traductions backend vers le format BubbleTranslation
  const translations = (message.translations || [])
    .filter(t => t && t.targetLanguage && t.translatedContent)
    .map(t => ({
      language: t.targetLanguage,
      content: t.translatedContent,
      status: 'completed',
      timestamp: new Date(t.createdAt || message.createdAt),
      confidence: t.confidenceScore || 0.9
    }));

  const originalLanguage = message.originalLanguage || 'fr';
  const preferredLanguage = resolveUserPreferredLanguage();
  
  console.log(`  🎯 Langues:`, {
    original: originalLanguage,
    preferred: preferredLanguage,
    availableTranslations: translations.map(t => t.language)
  });
  
  // Déterminer le contenu à afficher selon les préférences utilisateur
  let displayContent = message.content;
  let isTranslated = false;
  let translatedFrom;
  
  // Si le message n'est pas dans la langue préférée de l'utilisateur
  if (originalLanguage !== preferredLanguage) {
    // Chercher une traduction dans la langue préférée
    const preferredTranslation = translations.find(t => 
      t.language === preferredLanguage && t.status === 'completed'
    );
    
    if (preferredTranslation) {
      displayContent = preferredTranslation.content;
      isTranslated = true;
      translatedFrom = originalLanguage;
      console.log(`  ✅ Utilisation traduction ${originalLanguage} → ${preferredLanguage}`);
    } else {
      // Pas de traduction disponible, marquer comme nécessitant une traduction
      isTranslated = false;
      translatedFrom = originalLanguage;
      console.log(`  ⏳ Traduction nécessaire ${originalLanguage} → ${preferredLanguage}`);
    }
  } else {
    console.log(`  📍 Message déjà dans la langue préférée (${preferredLanguage})`);
  }

  const result = {
    ...message,
    content: displayContent,
    originalContent: message.content,
    originalLanguage,
    isTranslated,
    translatedFrom,
    location: message.location || 'Paris',
    translations
  };

  console.log(`  🏁 Résultat traitement:`, {
    id: result.id,
    isTranslated: result.isTranslated,
    translationsCount: result.translations.length,
    displayContent: result.content.substring(0, 50) + '...'
  });

  return result;
}

// Test du traitement
console.log('🔍 Test du traitement des traductions côté frontend...\n');

console.log('📊 Préférences utilisateur:');
console.log(`   Langue système: ${currentUser.systemLanguage}`);
console.log(`   Langue régionale: ${currentUser.regionalLanguage}`);
console.log(`   Langue personnalisée: ${currentUser.customDestinationLanguage}`);
console.log(`   Langue préférée: ${resolveUserPreferredLanguage()}\n`);

console.log('📊 Messages de l\'API:');
messagesFromApi.forEach((msg, index) => {
  console.log(`   Message ${index + 1}:`);
  console.log(`     ID: ${msg.id}`);
  console.log(`     Contenu: ${msg.content}`);
  console.log(`     Langue originale: ${msg.originalLanguage}`);
  console.log(`     Traductions: ${msg.translations.length}`);
  msg.translations.forEach(t => {
    console.log(`       - ${t.targetLanguage}: ${t.translatedContent}`);
  });
  console.log('');
});

console.log('🔄 Traitement des messages...\n');

const processedMessages = messagesFromApi.map(msg => processMessageWithTranslations(msg));

console.log('📊 Résultats du traitement:');
processedMessages.forEach((msg, index) => {
  console.log(`   Message ${index + 1}:`);
  console.log(`     ID: ${msg.id}`);
  console.log(`     Contenu affiché: ${msg.content}`);
  console.log(`     Contenu original: ${msg.originalContent}`);
  console.log(`     Est traduit: ${msg.isTranslated}`);
  console.log(`     Traduit depuis: ${msg.translatedFrom}`);
  console.log(`     Traductions disponibles: ${msg.translations.length}`);
  console.log('');
});

console.log('✅ Test terminé');
