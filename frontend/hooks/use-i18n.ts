/**
 * Hook I18n pour la traduction de l'interface utilisateur
 * Charge les fichiers JSON de traduction depuis /locales/{lang}/{namespace}.json
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguageStore } from '@/stores';

// Cache global pour éviter de recharger les mêmes fichiers
const translationsCache = new Map<string, Record<string, any>>();

// Fonction pour vider le cache (utile lors de changements de structure)
export function clearTranslationsCache() {
  translationsCache.clear();
  if (process.env.NODE_ENV === 'development') {
    console.log('[i18n] Cache cleared');
  }
}

interface UseI18nOptions {
  fallbackLocale?: string;
}

interface UseI18nReturn {
  t: (key: string, params?: Record<string, any>) => string;
  tArray: (key: string) => string[];
  locale: string;
  setLocale: (locale: string) => void;
  isLoading: boolean;
  currentLanguage: string;
}

/**
 * Hook pour gérer les traductions i18n
 * @param namespace - Module de traduction (ex: 'landing', 'auth', 'dashboard')
 * @param options - Options de configuration
 */
export function useI18n(namespace: string = 'common', options: UseI18nOptions = {}): UseI18nReturn {
  const { fallbackLocale = 'en' } = options;
  
  // Utiliser le store de langue Zustand
  const currentInterfaceLanguage = useLanguageStore(state => state.currentInterfaceLanguage);
  const setLanguage = useLanguageStore(state => state.setInterfaceLanguage);
  
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Charger les traductions pour un namespace et une locale donnés
  const loadTranslations = useCallback(async (locale: string, ns: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[i18n] 🚀 Loading translations for ${locale}/${ns}...`);
    }
    const cacheKey = `${locale}-${ns}`;
    
    // En développement, ne PAS utiliser le cache pour voir les changements immédiatement
    const useCache = process.env.NODE_ENV !== 'development';
    
    // Vérifier le cache d'abord (seulement en production)
    if (useCache && translationsCache.has(cacheKey)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[i18n] ✅ Using cached translations for ${locale}/${ns}`);
      }
      return translationsCache.get(cacheKey)!;
    }
    
    try {
      // Importer dynamiquement le fichier JSON
      const data = await import(`@/locales/${locale}/${ns}.json`);
      
      // Debug: voir exactement ce qui est importé
      if (process.env.NODE_ENV === 'development') {
        console.log(`[i18n] 📦 Import raw data for ${locale}/${ns}:`, {
          hasDefault: 'default' in data,
          dataKeys: Object.keys(data),
          data: data
        });
      }
      
      // Extraire les traductions : soit data.default, soit data directement
      let translations = data.default || data;
      
      // Si les traductions ont une clé qui correspond au namespace, l'extraire
      // Ex: { "landing": { "hero": {...} } } → { "hero": {...} }
      if (ns in translations) {
        translations = translations[ns];
      }
      
      // Debug: afficher ce qui est chargé
      if (process.env.NODE_ENV === 'development') {
        console.log(`[i18n] 📋 Extracted translations for ${locale}/${ns}:`, {
          hasDefault: 'default' in data,
          hasNamespaceKey: ns in (data.default || data),
          translationsKeys: Object.keys(translations)
        });
      }
      
      // Mettre en cache (seulement en production)
      if (useCache) {
        translationsCache.set(cacheKey, translations);
      }
      
      return translations;
    } catch (error) {
      console.error(`[i18n] ❌ Failed to load translations for ${locale}/${ns}:`, error);
      
      // Si on est déjà sur le fallback, retourner un objet vide
      if (locale === fallbackLocale) {
        return {};
      }
      
      // Essayer avec la locale de fallback
      try {
        const fallbackData = await import(`@/locales/${fallbackLocale}/${ns}.json`);
        const fallbackTranslations = fallbackData.default || fallbackData;
        return fallbackTranslations;
      } catch (fallbackError) {
        console.error(`[i18n] Failed to load fallback translations for ${fallbackLocale}/${ns}:`, fallbackError);
        return {};
      }
    }
  }, [fallbackLocale]);
  
  // Charger les traductions quand la locale ou le namespace change
  useEffect(() => {
    let isMounted = true;
    
    const load = async () => {
      setIsLoading(true);
      const data = await loadTranslations(currentInterfaceLanguage, namespace);
      
      if (isMounted) {
        // Debug: log les données brutes
        if (process.env.NODE_ENV === 'development') {
          console.log(`[i18n] 🔍 Raw data for ${currentInterfaceLanguage}/${namespace}:`, {
            dataKeys: Object.keys(data),
            hasNamespaceKey: namespace in data,
            dataContent: data
          });
        }
        
        // Si les données ont une clé racine qui correspond au namespace, l'extraire
        // Ex: { "landing": { "hero": { ... } } } → { "hero": { ... } }
        // Note: loadTranslations fait déjà cette extraction maintenant
        const translationsData = data;
        
        // Debug: log la structure chargée en mode développement
        if (process.env.NODE_ENV === 'development') {
          console.log(`[i18n] ✅ Loaded ${currentInterfaceLanguage}/${namespace}:`, {
            translationsDataKeys: Object.keys(translationsData),
            translationsData
          });
        }
        
        setTranslations(translationsData);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[i18n] 💾 Set translations for ${currentInterfaceLanguage}/${namespace}:`, {
            translationsDataKeys: Object.keys(translationsData),
            translationsData
          });
        }
        
        setIsLoading(false);
      }
    };
    
    load();
    
    return () => {
      isMounted = false;
    };
  }, [currentInterfaceLanguage, namespace, loadTranslations]);
  
  // Fonction de traduction
  const t = useCallback((key: string, params?: Record<string, any>): string => {
    // Ne pas afficher de warnings pendant le chargement initial
    const shouldWarn = process.env.NODE_ENV === 'development' && !isLoading;
    
    // Debug: afficher l'état des translations seulement si elles sont censées être chargées
    if (shouldWarn && Object.keys(translations).length === 0) {
      console.warn(`[i18n] Translations object is empty for namespace "${namespace}"`);
    }
    
    // Naviguer dans l'objet de traductions en utilisant la clé avec points
    const keys = key.split('.');
    let value: any = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Clé non trouvée - retourner la clé elle-même en mode développement
        if (shouldWarn) {
          console.warn(`[i18n] Missing translation key: ${namespace}.${key}`, {
            translationsKeys: Object.keys(translations),
            lookingFor: k,
            currentValue: value
          });
        }
        return key;
      }
    }
    
    // Si la valeur n'est pas une string, retourner la clé
    if (typeof value !== 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Translation key "${namespace}.${key}" is not a string:`, value);
      }
      return key;
    }
    
    // Remplacer les paramètres dans la traduction
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match;
      });
    }
    
    return value;
  }, [translations, namespace, isLoading]);
  
  // Fonction pour récupérer un tableau de traductions
  const tArray = useCallback((key: string): string[] => {
    // Naviguer dans l'objet de traductions en utilisant la clé avec points
    const keys = key.split('.');
    let value: any = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Clé non trouvée
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[i18n] Missing translation array key: ${namespace}.${key}`);
        }
        return [];
      }
    }
    
    // Si la valeur est un tableau, le retourner
    if (Array.isArray(value)) {
      return value;
    }
    
    // Si ce n'est pas un tableau, retourner un tableau vide
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] Translation key "${namespace}.${key}" is not an array:`, value);
    }
    return [];
  }, [translations, namespace]);
  
  // Mémoïser le retour pour éviter les re-renders inutiles
  return useMemo(() => ({
    t,
    tArray,
    locale: currentInterfaceLanguage,
    currentLanguage: currentInterfaceLanguage,
    setLocale: setLanguage,
    isLoading,
  }), [t, tArray, currentInterfaceLanguage, setLanguage, isLoading]);
}

// Export du type pour réutilisation
export type { UseI18nReturn };

