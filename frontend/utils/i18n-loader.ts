/**
 * Utilitaire de chargement d'internationalisation (i18n) modulaire
 * Charge les messages d'interface depuis la nouvelle structure en dossiers
 * DISTINCT du système de traduction des messages utilisateurs
 */

interface I18nMessages {
  [key: string]: any;
}

interface I18nModule {
  [key: string]: any;
}

// Cache global persistant pour les messages d'interface
const i18nCache: Record<string, I18nMessages> = {};
const moduleCache: Record<string, Record<string, I18nModule>> = {};

// Langues supportées avec la nouvelle structure
const SUPPORTED_LANGUAGES = ['en', 'fr', 'pt', 'es', 'de', 'it', 'zh', 'ja', 'ar', 'ru'];

// Modules disponibles dans chaque langue
const AVAILABLE_MODULES = [
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
];

/**
 * Détecte la langue du navigateur pour l'interface
 * Fallback vers l'anglais si la langue détectée n'a pas de dossier
 */
export function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return 'en'; // Fallback serveur vers anglais
  
  // 1. Langue du navigateur
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(browserLang)) {
    return browserLang;
  }
  
  // 2. Langues préférées du navigateur
  const preferredLanguages = navigator.languages || [];
  for (const lang of preferredLanguages) {
    const shortLang = lang.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(shortLang)) {
      return shortLang;
    }
  }
  
  // 3. Fallback vers l'anglais (langue par défaut)
  return 'en';
}

/**
 * Vérifie si une langue a un dossier de traductions disponible
 */
export async function hasLanguageFolder(language: string): Promise<boolean> {
  try {
    // Essayer de charger le module common pour vérifier l'existence du dossier
    await import(`@/locales/${language}/common.json`);
    return true;
  } catch (error) {
    console.warn(`[I18nLoader] Dossier de langue non trouvé pour: ${language}`);
    return false;
  }
}

/**
 * Obtient la langue avec fallback intelligent
 * Si la langue demandée n'a pas de dossier, fallback vers l'anglais
 */
export async function getLanguageWithFallback(requestedLanguage: string): Promise<string> {
  // Vérifier si la langue demandée est supportée
  if (!SUPPORTED_LANGUAGES.includes(requestedLanguage)) {
    console.warn(`[I18nLoader] Langue non supportée: ${requestedLanguage}, fallback vers anglais`);
    return 'en';
  }
  
  // Vérifier si le dossier existe
  const hasFolder = await hasLanguageFolder(requestedLanguage);
  if (!hasFolder) {
    console.warn(`[I18nLoader] Dossier manquant pour ${requestedLanguage}, fallback vers anglais`);
    return 'en';
  }
  
  return requestedLanguage;
}

/**
 * Charge un module d'interface spécifique
 */
async function loadI18nModule(
  language: string, 
  module: string
): Promise<I18nModule> {
  const cacheKey = `${language}_${module}`;
  
  // Vérifier le cache en premier
  if (moduleCache[language]?.[module]) {
    return moduleCache[language][module];
  }

  try {
    // Import dynamique du module d'interface
    const moduleData = await import(`@/locales/${language}/${module}.json`);
    
    // Initialiser le cache pour cette langue si nécessaire
    if (!moduleCache[language]) {
      moduleCache[language] = {};
    }
    
    moduleCache[language][module] = moduleData.default;
    
    // Sauvegarder dans localStorage pour la prochaine visite
    try {
      localStorage.setItem(`i18n_${cacheKey}`, JSON.stringify(moduleData.default));
    } catch (e) {
      // Ignore localStorage errors
    }
    
    return moduleData.default;
  } catch (error) {
    console.warn(`[I18nLoader] Échec chargement ${language}/${module}:`, error);
    
    // Essayer de charger depuis localStorage
    try {
      const cached = localStorage.getItem(`i18n_${cacheKey}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        if (!moduleCache[language]) {
          moduleCache[language] = {};
        }
        moduleCache[language][module] = parsedCache;
        return parsedCache;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // Fallback vers l'anglais si ce n'est pas déjà l'anglais
    if (language !== 'en') {
      return loadI18nModule('en', module);
    }
    
    // Dernier recours - objet vide
    return {};
  }
}

/**
 * Charge tous les messages d'interface pour une langue donnée
 * Avec fallback automatique vers l'anglais si le dossier n'existe pas
 */
export async function loadLanguageI18n(language: string): Promise<I18nMessages> {
  // Obtenir la langue avec fallback intelligent
  const finalLanguage = await getLanguageWithFallback(language);
  
  // Vérifier le cache complet
  if (i18nCache[finalLanguage]) {
    return i18nCache[finalLanguage];
  }

  try {
    console.log(`[I18nLoader] Chargement de l'interface en ${finalLanguage}${finalLanguage !== language ? ` (fallback depuis ${language})` : ''}`);
    
    // Charger tous les modules en parallèle
    const modulePromises = AVAILABLE_MODULES.map(module => 
      loadI18nModule(finalLanguage, module)
    );
    
    const modules = await Promise.all(modulePromises);
    
    // Fusionner tous les modules en un seul objet
    const mergedI18n: I18nMessages = {};
    modules.forEach(moduleData => {
      Object.assign(mergedI18n, moduleData);
    });
    
    // Mettre en cache avec la langue finale
    i18nCache[finalLanguage] = mergedI18n;
    
    // Si c'était un fallback, mettre aussi en cache pour la langue originale
    if (finalLanguage !== language) {
      i18nCache[language] = mergedI18n;
    }
    
    return mergedI18n;
  } catch (error) {
    console.error(`[I18nLoader] Erreur lors du chargement de ${finalLanguage}:`, error);
    
    // Fallback d'urgence vers l'anglais si ce n'est pas déjà l'anglais
    if (finalLanguage !== 'en') {
      console.warn(`[I18nLoader] Fallback d'urgence vers l'anglais`);
      return loadLanguageI18n('en');
    }
    
    // Dernier recours - messages vides
    console.error(`[I18nLoader] Impossible de charger l'interface, utilisation de messages vides`);
    return {};
  }
}

/**
 * Charge un module d'interface spécifique pour une langue
 */
export async function loadSpecificI18nModule(
  language: string, 
  module: string
): Promise<I18nModule> {
  if (!AVAILABLE_MODULES.includes(module)) {
    console.warn(`[I18nLoader] Module non supporté: ${module}`);
    return {};
  }
  
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    console.warn(`[I18nLoader] Langue non supportée: ${language}`);
    language = 'en'; // Fallback vers l'anglais
  }
  
  return loadI18nModule(language, module);
}

/**
 * Pré-charge les modules d'interface les plus utilisés
 */
export async function preloadEssentialI18nModules(language: string): Promise<void> {
  const essentialModules = ['common', 'auth', 'components'];
  
  try {
    await Promise.all(
      essentialModules.map(module => loadI18nModule(language, module))
    );
  } catch (error) {
    console.warn('[I18nLoader] Erreur lors du pré-chargement:', error);
  }
}

/**
 * Vide le cache d'internationalisation
 */
export function clearI18nCache(): void {
  Object.keys(i18nCache).forEach(key => delete i18nCache[key]);
  Object.keys(moduleCache).forEach(key => delete moduleCache[key]);
  
  // Vider localStorage
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('i18n_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Obtient les langues supportées pour l'interface
 */
export function getSupportedI18nLanguages(): string[] {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Obtient les modules d'interface disponibles
 */
export function getAvailableI18nModules(): string[] {
  return [...AVAILABLE_MODULES];
}

/**
 * Vérifie si une langue est supportée pour l'interface
 */
export function isSupportedI18nLanguage(language: string): boolean {
  return SUPPORTED_LANGUAGES.includes(language);
}

/**
 * Vérifie si un module d'interface est disponible
 */
export function isAvailableI18nModule(module: string): boolean {
  return AVAILABLE_MODULES.includes(module);
}

/**
 * Obtient les statistiques du cache d'interface
 */
export function getI18nCacheStats() {
  const languages = Object.keys(i18nCache);
  const totalModules = Object.values(moduleCache).reduce((total, langModules) => {
    return total + Object.keys(langModules).length;
  }, 0);
  
  return {
    cachedLanguages: languages.length,
    cachedModules: totalModules,
    cacheSize: JSON.stringify(i18nCache).length,
    lastAccess: new Date()
  };
}
