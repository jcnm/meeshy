/**
 * Configuration du système d'internationalisation (i18n) modulaire
 * Gère les messages d'interface - DISTINCT de la configuration de traduction des messages
 */

import { I18nConfig, SupportedLanguage, I18nModule } from '@/types/i18n';

// Configuration par défaut pour la production (interface)
export const PRODUCTION_I18N_CONFIG: I18nConfig = {
  defaultLanguage: 'fr',
  supportedLanguages: ['en', 'fr', 'pt', 'es', 'de', 'it', 'zh', 'ja', 'ar', 'ru'],
  availableModules: [
    'common',
    'auth', 
    'landing',
    'dashboard',
    'conversations',
    'settings',
    'pages',
    'components',
    'modals',
    'features',
    'legal'
  ],
  fallbackLanguage: 'en',
  enableCache: true,
  enableLocalStorage: true,
  preloadEssentials: true
};

// Configuration pour le développement (interface)
export const DEVELOPMENT_I18N_CONFIG: I18nConfig = {
  ...PRODUCTION_I18N_CONFIG,
  enableCache: false, // Désactiver le cache en dev pour voir les changements d'interface
  preloadEssentials: false // Chargement à la demande pour le debug
};

// Configuration pour les tests (interface)
export const TEST_I18N_CONFIG: I18nConfig = {
  ...PRODUCTION_I18N_CONFIG,
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'fr'],
  availableModules: ['common', 'auth'],
  enableCache: false,
  enableLocalStorage: false,
  preloadEssentials: false
};

// Modules d'interface essentiels à pré-charger
export const ESSENTIAL_I18N_MODULES: I18nModule[] = [
  'common',
  'auth',
  'components'
];

// Modules d'interface par page/route
export const ROUTE_I18N_MODULES: Record<string, I18nModule[]> = {
  '/': ['common', 'landing'],
  '/auth/login': ['common', 'auth'],
  '/auth/register': ['common', 'auth'],
  '/dashboard': ['common', 'dashboard', 'components'],
  '/conversations': ['common', 'conversations', 'components'],
  '/settings': ['common', 'settings', 'components'],
  '/about': ['common', 'pages'],
  '/contact': ['common', 'pages'],
  '/partners': ['common', 'pages'],
  '/privacy': ['common', 'legal'],
  '/terms': ['common', 'legal']
};

// Langues avec support RTL pour l'interface
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

// Langues avec formats de date spéciaux pour l'interface
export const INTERFACE_DATE_FORMATS: Record<SupportedLanguage, string> = {
  'en': 'en-US',
  'fr': 'fr-FR',
  'pt': 'pt-BR',
  'es': 'es-ES',
  'de': 'de-DE',
  'it': 'it-IT',
  'zh': 'zh-CN',
  'ja': 'ja-JP',
  'ar': 'ar-SA',
  'ru': 'ru-RU'
};

// Noms natifs des langues pour l'interface
export const NATIVE_INTERFACE_LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  'en': 'English',
  'fr': 'Français',
  'pt': 'Português',
  'es': 'Español',
  'de': 'Deutsch',
  'it': 'Italiano',
  'zh': '中文',
  'ja': '日本語',
  'ar': 'العربية',
  'ru': 'Русский'
};

// Drapeaux des langues d'interface (emojis)
export const INTERFACE_LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  'en': '🇺🇸',
  'fr': '🇫🇷',
  'pt': '🇧🇷',
  'es': '🇪🇸',
  'de': '🇩🇪',
  'it': '🇮🇹',
  'zh': '🇨🇳',
  'ja': '🇯🇵',
  'ar': '🇸🇦',
  'ru': '🇷🇺'
};

// Configuration selon l'environnement pour l'interface
export function getI18nConfig(): I18nConfig {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'development':
      return DEVELOPMENT_I18N_CONFIG;
    case 'test':
      return TEST_I18N_CONFIG;
    case 'production':
    default:
      return PRODUCTION_I18N_CONFIG;
  }
}

// Obtenir les modules d'interface pour une route
export function getI18nModulesForRoute(pathname: string): I18nModule[] {
  // Correspondance exacte
  if (ROUTE_I18N_MODULES[pathname]) {
    return ROUTE_I18N_MODULES[pathname];
  }
  
  // Correspondance par préfixe
  for (const [route, modules] of Object.entries(ROUTE_I18N_MODULES)) {
    if (pathname.startsWith(route) && route !== '/') {
      return modules;
    }
  }
  
  // Fallback vers les modules d'interface essentiels
  return ESSENTIAL_I18N_MODULES;
}

// Vérifier si une langue d'interface est supportée
export function isSupportedInterfaceLanguage(language: string): language is SupportedLanguage {
  return PRODUCTION_I18N_CONFIG.supportedLanguages.includes(language as SupportedLanguage);
}

// Vérifier si un module d'interface est disponible
export function isAvailableI18nModule(module: string): module is I18nModule {
  return PRODUCTION_I18N_CONFIG.availableModules.includes(module as I18nModule);
}

// Obtenir la direction du texte pour une langue d'interface
export function getInterfaceTextDirection(language: SupportedLanguage): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

// Obtenir le format de date pour une langue d'interface
export function getInterfaceDateFormat(language: SupportedLanguage): string {
  return INTERFACE_DATE_FORMATS[language] || INTERFACE_DATE_FORMATS.en;
}

// Obtenir le nom natif d'une langue d'interface
export function getNativeInterfaceLanguageName(language: SupportedLanguage): string {
  return NATIVE_INTERFACE_LANGUAGE_NAMES[language] || language;
}

// Obtenir le drapeau d'une langue d'interface
export function getInterfaceLanguageFlag(language: SupportedLanguage): string {
  return INTERFACE_LANGUAGE_FLAGS[language] || '🌐';
}

// Priorité de chargement des modules d'interface
export const I18N_MODULE_PRIORITY: Record<I18nModule, number> = {
  'common': 1,      // Toujours en premier pour l'interface
  'auth': 2,        // Critique pour l'authentification
  'components': 3,  // UI de base
  'dashboard': 4,   // Page principale
  'conversations': 5,
  'settings': 6,
  'landing': 7,
  'pages': 8,
  'modals': 9,
  'features': 10,
  'legal': 11       // Moins critique
};

// Obtenir les modules d'interface triés par priorité
export function getI18nModulesByPriority(modules: I18nModule[]): I18nModule[] {
  return [...modules].sort((a, b) => I18N_MODULE_PRIORITY[a] - I18N_MODULE_PRIORITY[b]);
}

// Configuration de cache pour l'interface
export const I18N_CACHE_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 heures
  maxSize: 50, // Nombre maximum d'entrées en cache
  compressionEnabled: true,
  persistentStorage: true
};

// Configuration de performance pour l'interface
export const I18N_PERFORMANCE_CONFIG = {
  loadTimeout: 5000, // 5 secondes
  retryAttempts: 3,
  retryDelay: 1000, // 1 seconde
  preloadDelay: 100, // 100ms après le chargement initial
  batchSize: 3 // Nombre de modules à charger en parallèle
};

export default getI18nConfig();
