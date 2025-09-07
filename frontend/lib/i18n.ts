// Configuration i18n simplifiée sans redirections d'URL
// L'internationalisation est gérée côté client via le LanguageContext

// Define the locales that your app supports (focus on FR, EN, PT for now)
export const locales = ['en', 'fr', 'pt'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'fr';

// Configuration de requête supprimée car l'internationalisation est gérée côté client

// Utility function to get supported languages
export function getSupportedLanguages() {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  ];
}

// Utility function to check if a language is supported
export function isLanguageSupported(language: string): language is Locale {
  return locales.includes(language as Locale);
}

// Utility function to get the best matching locale from browser languages
export function getBestMatchingLocale(browserLanguages?: readonly string[]): Locale {
  // Si aucune langue n'est fournie, utiliser les langues du navigateur
  const languages = browserLanguages || (typeof window !== 'undefined' ? navigator.languages : []);
  
  console.log('[I18N] Detecting best matching locale from:', languages);
  
  for (const browserLang of languages) {
    const langCode = browserLang.split('-')[0].toLowerCase();
    if (isLanguageSupported(langCode)) {
      console.log('[I18N] Found matching locale:', langCode);
      return langCode as Locale;
    }
  }
  
  console.log('[I18N] No matching locale found, using default:', defaultLocale);
  return defaultLocale;
}

// Nouvelle fonction pour détecter automatiquement la langue préférée de l'utilisateur
export function detectUserPreferredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  
  // 1. Vérifier le localStorage d'abord
  const storedLocale = localStorage.getItem('meeshy-interface-language');
  if (storedLocale && isLanguageSupported(storedLocale)) {
    console.log('[I18N] Using stored locale:', storedLocale);
    return storedLocale as Locale;
  }
  
  // 2. Si pas de locale sauvegardée, détecter automatiquement
  const detectedLocale = getBestMatchingLocale();
  console.log('[I18N] Auto-detected locale:', detectedLocale);
  
  // Sauvegarder la locale détectée pour les prochaines fois
  try {
    localStorage.setItem('meeshy-interface-language', detectedLocale);
  } catch (error) {
    console.warn('[I18N] Could not save detected locale:', error);
  }
  
  return detectedLocale;
}

// Utility function to format locale for display
export function formatLocale(locale: Locale): string {
  const languages = getSupportedLanguages();
  const language = languages.find(lang => lang.code === locale);
  return language ? language.nativeName : locale.toUpperCase();
}
