/**
 * Utilitaire pour logger les informations de détection de langue
 * Aide au débogage et à la compréhension du comportement de l'auto-détection
 */

export function logLanguageDetectionInfo(): void {
  if (typeof window === 'undefined') return;

  console.group('🌐 MEESHY - Language Detection Information');
  
  try {
    // Informations du navigateur
    console.log('📱 Navigator Info:', {
      language: navigator.language,
      languages: navigator.languages,
      userAgent: navigator.userAgent.substring(0, 100) + '...'
    });

    // Langues supportées par Meeshy
    const supportedInterfaceLanguages = ['en', 'fr', 'pt'];
    const supportedTranslationLanguages = ['en', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ar', 'hi', 'pt', 'it', 'sv'];

    console.log('🔧 Supported Languages:', {
      interface: supportedInterfaceLanguages,
      translation: supportedTranslationLanguages
    });

    // Analyse des langues du navigateur
    const browserLanguages = navigator.languages || [navigator.language || 'en'];
    const languageAnalysis = browserLanguages.map(lang => {
      const code = lang.split('-')[0].toLowerCase();
      return {
        original: lang,
        code,
        supportsInterface: supportedInterfaceLanguages.includes(code),
        supportsTranslation: supportedTranslationLanguages.includes(code)
      };
    });

    console.log('🔍 Browser Languages Analysis:', languageAnalysis);

    // Recommendations
    const recommendedInterface = languageAnalysis.find(lang => lang.supportsInterface)?.code || 'en';
    const recommendedTranslation = languageAnalysis.find(lang => lang.supportsTranslation)?.code || 'en';

    console.log('💡 Recommendations:', {
      interfaceLanguage: recommendedInterface,
      systemLanguage: recommendedTranslation,
      explanation: {
        interface: `Best match for interface from: ${supportedInterfaceLanguages.join(', ')}`,
        translation: `Best match for translation from: ${supportedTranslationLanguages.join(', ')}`
      }
    });

    // Configuration actuelle en localStorage
    const currentConfig = {
      interfaceLanguage: localStorage.getItem('meeshy_interface_language'),
      userLanguageConfig: localStorage.getItem('meeshy_user_language_config'),
      preferredLanguage: localStorage.getItem('meeshy-preferred-language')
    };

    console.log('💾 Current Stored Config:', currentConfig);

    // Suggestions d'amélioration
    console.log('🎯 Detection Strategy:', {
      step1: 'Check localStorage for saved preferences',
      step2: 'Auto-detect from navigator.languages (ordered by preference)',
      step3: 'Fallback to English for interface, English for system',
      step4: 'Save detected preferences for future visits'
    });

  } catch (error) {
    console.error('❌ Error in language detection logging:', error);
  }

  console.groupEnd();
}

/**
 * Version simplifiée pour le logging en production
 */
export function logLanguageDetectionSummary(): void {
  if (typeof window === 'undefined') return;

  const browserLanguages = navigator.languages || [navigator.language || 'en'];
  const supportedInterfaceLanguages = ['en', 'fr', 'pt'];
  
  const detectedInterface = browserLanguages
    .map(lang => lang.split('-')[0].toLowerCase())
    .find(code => supportedInterfaceLanguages.includes(code)) || 'en';

  console.log('🌐 Language Detection:', {
    browser: browserLanguages[0],
    detected: detectedInterface,
    fallback: detectedInterface === 'en' ? 'Using fallback' : 'Auto-detected'
  });
}

/**
 * Fonction pour tester différents scénarios de langue
 */
export function testLanguageDetection(): void {
  if (typeof window === 'undefined') {
    console.log('🚫 Cannot test language detection on server side');
    return;
  }

  console.group('🧪 Language Detection Test');

  // Test cases simulés
  const testCases = [
    ['fr-FR', 'en-US'],
    ['pt-BR', 'en-US'],
    ['es-ES', 'fr-FR'],
    ['de-DE', 'en-US'],
    ['zh-CN', 'en-US'],
    ['ja-JP', 'en-US']
  ];

  testCases.forEach((languages, index) => {
    console.log(`Test ${index + 1}: Browser languages = [${languages.join(', ')}]`);
    
    const detectedInterface = languages
      .map(lang => lang.split('-')[0].toLowerCase())
      .find(code => ['en', 'fr', 'pt'].includes(code)) || 'en';
    
    const detectedSystem = languages
      .map(lang => lang.split('-')[0].toLowerCase())
      .find(code => ['en', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ar', 'hi', 'pt', 'it', 'sv'].includes(code)) || 'en';

    console.log(`  → Interface: ${detectedInterface}, System: ${detectedSystem}`);
  });

  console.groupEnd();
}
