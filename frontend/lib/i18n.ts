// Configuration i18n simplifiée sans redirections d'URL
// L'internationalisation est gérée côté client via le LanguageContext

// Define the locales that your app supports
export const locales = ['en', 'fr', 'pt'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'en';

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
export function getBestMatchingLocale(browserLanguages: readonly string[]): Locale {
  for (const browserLang of browserLanguages) {
    const langCode = browserLang.split('-')[0].toLowerCase();
    if (isLanguageSupported(langCode)) {
      return langCode as Locale;
    }
  }
  return defaultLocale;
}

// Utility function to format locale for display
export function formatLocale(locale: Locale): string {
  const languages = getSupportedLanguages();
  const language = languages.find(lang => lang.code === locale);
  return language ? language.nativeName : locale.toUpperCase();
}
