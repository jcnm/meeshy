/**
 * Hook personnalisé pour les traductions - VERSION ULTRA OPTIMISÉE
 * Détection automatique de langue + Chargement synchrone avec fallback intelligent
 */

import { useCallback, useMemo, useState, useEffect } from 'react';

interface TranslationMessages {
  [key: string]: any;
}

// Cache global persistant (survit aux re-renders)
const translationCache: Record<string, TranslationMessages> = {};
let detectedBrowserLanguage: string | null = null;

// Détecter la langue du navigateur une seule fois
function detectBrowserLanguage(): string {
  if (detectedBrowserLanguage) return detectedBrowserLanguage;
  
  if (typeof window === 'undefined') return 'fr';
  
  // Langues supportées
  const supportedLanguages = ['fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar'];
  
  // 1. Langue du navigateur
  const browserLang = navigator.language.split('-')[0];
  if (supportedLanguages.includes(browserLang)) {
    detectedBrowserLanguage = browserLang;
    return browserLang;
  }
  
  // 2. Langues préférées du navigateur
  const preferredLanguages = navigator.languages || [];
  for (const lang of preferredLanguages) {
    const shortLang = lang.split('-')[0];
    if (supportedLanguages.includes(shortLang)) {
      detectedBrowserLanguage = shortLang;
      return shortLang;
    }
  }
  
  // 3. Fallback français
  detectedBrowserLanguage = 'fr';
  return 'fr';
}

// Charger une langue de façon optimisée
async function loadLanguageOptimized(lang: string): Promise<TranslationMessages> {
  // 1. Vérifier le cache en premier
  if (translationCache[lang]) {
    return translationCache[lang];
  }

  try {
    // 2. Import dynamique avec timeout
    const loadPromise = import(`@/locales/${lang}.json`);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 2000)
    );

    const translations = await Promise.race([loadPromise, timeoutPromise]) as any;
    translationCache[lang] = translations.default;
    
    // 3. Sauvegarder dans localStorage pour la prochaine visite
    try {
      localStorage.setItem(`translations_${lang}`, JSON.stringify(translations.default));
    } catch (e) {
      // Ignore localStorage errors (quota, private mode, etc.)
    }
    
    return translations.default;
  } catch (error) {
    console.warn(`[useTranslations] Échec chargement ${lang}:`, error);
    
    // 4. Essayer de charger depuis localStorage
    try {
      const cached = localStorage.getItem(`translations_${lang}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        translationCache[lang] = parsedCache;
        return parsedCache;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // 5. Fallback intelligent
    if (lang !== 'fr' && lang !== 'en') {
      return loadLanguageOptimized('en'); // Fallback vers anglais
    }
    if (lang !== 'fr') {
      return loadLanguageOptimized('fr'); // Fallback vers français
    }
    
    // 6. Dernier recours - traductions vides
    return {};
  }
}

// Pré-charger la langue détectée au premier import
const preloadPromise = (() => {
  const detectedLang = detectBrowserLanguage();
  return loadLanguageOptimized(detectedLang);
})();

export function useTranslations(namespace?: string) {
  const [currentLanguage] = useState(() => detectBrowserLanguage());
  const [currentMessages, setCurrentMessages] = useState<TranslationMessages>(() => {
    // Retourner le cache immédiatement si disponible
    return translationCache[currentLanguage] || {};
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Pas de loading si déjà en cache
    return !translationCache[currentLanguage];
  });
  
  // Charger la langue détectée
  useEffect(() => {
    if (translationCache[currentLanguage]) {
      // Déjà en cache
      setCurrentMessages(translationCache[currentLanguage]);
      setIsLoading(false);
      return;
    }
    
    // Utiliser la promesse de pré-chargement
    preloadPromise
      .then(messages => {
        setCurrentMessages(messages);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [currentLanguage]);

  // Fonction de traduction optimisée
  const t = useCallback((key: string, variables?: Record<string, string | number>): string => {
    if (isLoading) {
      return key; // Retourne la clé en attendant le chargement
    }

    try {
      let message: any = currentMessages;
      
      if (namespace) {
        // Valider le namespace
        if (typeof namespace !== 'string' || namespace.trim() === '') {
          console.warn(`[useTranslations] Invalid namespace: ${namespace}`);
          return `Invalid namespace: ${namespace}`;
        }
        
        const namespaceParts = namespace.split('.');
        for (const part of namespaceParts) {
          if (message && typeof message === 'object' && part in message) {
            message = message[part];
          } else {
            console.warn(`[useTranslations] Missing namespace part "${part}" in "${namespace}"`);
            return `Missing namespace: ${namespace}`;
          }
        }
      }
      
      const keyParts = key.split('.');
      for (const part of keyParts) {
        if (message && typeof message === 'object' && part in message) {
          message = message[part];
        } else {
          return `Missing: ${key}`;
        }
      }
      
      if (typeof message !== 'string') {
        return `Invalid: ${key}`;
      }
      
      // Interpolation des variables
      if (variables && Object.keys(variables).length > 0) {
        return message.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
          return variables[varName]?.toString() || match;
        });
      }
      
      return message;
    } catch (error) {
      console.error('[useTranslations] Erreur:', error);
      return `Error: ${key}`;
    }
  }, [currentMessages, namespace, isLoading]);

  return { t, isLoading };
}