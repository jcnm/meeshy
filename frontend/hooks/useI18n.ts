/**
 * Hook d'internationalisation (i18n) v2 - VERSION MODULAIRE
 * Utilise la nouvelle structure d'interface en dossiers
 * DISTINCT du système de traduction des messages utilisateurs
 */

import { useCallback, useMemo, useState, useEffect, useContext } from 'react';
import { 
  loadLanguageI18n, 
  loadSpecificI18nModule, 
  detectBrowserLanguage,
  preloadEssentialI18nModules,
  getLanguageWithFallback 
} from '@/utils/i18n-loader';

interface I18nMessages {
  [key: string]: any;
}

interface UseI18nOptions {
  // Langue spécifique à utiliser (optionnel)
  language?: string;
  // Modules spécifiques à charger (optionnel, charge tout par défaut)
  modules?: string[];
  // Pré-charger les modules essentiels
  preload?: boolean;
}

interface UseI18nReturn {
  t: (key: string, variables?: Record<string, string | number>) => string;
  isLoading: boolean;
  currentLanguage: string;
  loadModule: (module: string) => Promise<void>;
  switchLanguage: (language: string) => Promise<void>;
}

// Cache global pour éviter les re-chargements
const globalI18nCache: Record<string, I18nMessages> = {};
const loadingPromises: Record<string, Promise<I18nMessages>> = {};

export function useI18n(
  namespace?: string, 
  options: UseI18nOptions = {}
): UseI18nReturn {
  const {
    language: forcedLanguage,
    modules,
    preload = true
  } = options;

  // Déterminer la langue à utiliser pour l'interface
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return forcedLanguage || detectBrowserLanguage();
  });

  const [currentMessages, setCurrentMessages] = useState<I18nMessages>(() => {
    // Retourner le cache immédiatement si disponible
    return globalI18nCache[currentLanguage] || {};
  });

  const [isLoading, setIsLoading] = useState(() => {
    // Pas de loading si déjà en cache
    return !globalI18nCache[currentLanguage];
  });

  // Fonction pour charger les messages d'interface d'une langue avec fallback
  const loadI18nMessages = useCallback(async (lang: string) => {
    // Obtenir la langue finale avec fallback
    const finalLang = await getLanguageWithFallback(lang);
    
    // Éviter les chargements multiples simultanés
    const existingPromise = loadingPromises[finalLang];
    if (existingPromise) {
      return existingPromise;
    }

    // Si déjà en cache, retourner immédiatement
    if (globalI18nCache[finalLang]) {
      return globalI18nCache[finalLang];
    }

    setIsLoading(true);

    try {
      console.log(`[useI18n] Chargement interface ${finalLang}${finalLang !== lang ? ` (fallback depuis ${lang})` : ''}`);
      
      // Créer la promesse de chargement
      const loadPromise = modules && modules.length > 0
        ? loadSpecificI18nModules(finalLang, modules)
        : loadLanguageI18n(finalLang);

      loadingPromises[finalLang] = loadPromise;

      const i18nMessages = await loadPromise;
      globalI18nCache[finalLang] = i18nMessages;
      
      // Si c'était un fallback, mettre aussi en cache pour la langue originale
      if (finalLang !== lang) {
        globalI18nCache[lang] = i18nMessages;
      }
      
      // Nettoyer la promesse de chargement
      delete loadingPromises[finalLang];
      
      return i18nMessages;
    } catch (error) {
      console.error(`[useI18n] Erreur chargement ${finalLang}:`, error);
      delete loadingPromises[finalLang];
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [modules]);

  // Fonction pour charger des modules d'interface spécifiques
  const loadSpecificI18nModules = async (lang: string, moduleList: string[]) => {
    const modulePromises = moduleList.map(module => loadSpecificI18nModule(lang, module));
    const moduleResults = await Promise.all(modulePromises);
    
    // Fusionner tous les modules
    const merged: I18nMessages = {};
    moduleResults.forEach(moduleData => {
      Object.assign(merged, moduleData);
    });
    
    return merged;
  };

  // Charger les messages d'interface au montage et lors du changement de langue
  useEffect(() => {
    const loadCurrentLanguage = async () => {
      try {
        const i18nMessages = await loadI18nMessages(currentLanguage);
        setCurrentMessages(i18nMessages);
        
        // Pré-charger les modules essentiels si demandé
        if (preload) {
          preloadEssentialI18nModules(currentLanguage).catch(console.warn);
        }
      } catch (error) {
        console.error('[useI18n] Erreur lors du chargement:', error);
        setCurrentMessages({});
      }
    };

    loadCurrentLanguage();
  }, [currentLanguage, loadI18nMessages, preload]);

  // Fonction pour charger un module d'interface supplémentaire
  const loadModule = useCallback(async (module: string) => {
    try {
      const moduleData = await loadSpecificI18nModule(currentLanguage, module);
      
      // Fusionner avec les messages d'interface existants
      const updatedMessages = { ...currentMessages, ...moduleData };
      setCurrentMessages(updatedMessages);
      
      // Mettre à jour le cache global
      globalI18nCache[currentLanguage] = updatedMessages;
    } catch (error) {
      console.error(`[useI18n] Erreur chargement module ${module}:`, error);
    }
  }, [currentLanguage, currentMessages]);

  // Fonction pour changer de langue d'interface
  const switchLanguage = useCallback(async (newLanguage: string) => {
    if (newLanguage === currentLanguage) return;
    
    setCurrentLanguage(newLanguage);
    
    try {
      const i18nMessages = await loadI18nMessages(newLanguage);
      setCurrentMessages(i18nMessages);
    } catch (error) {
      console.error(`[useI18n] Erreur changement langue ${newLanguage}:`, error);
    }
  }, [currentLanguage, loadI18nMessages]);

  // Fonction de traduction d'interface optimisée
  const t = useCallback((key: string, variables?: Record<string, string | number>): string => {
    if (isLoading && Object.keys(currentMessages).length === 0) {
      return key; // Retourne la clé en attendant le chargement
    }

    try {
      let message: any = currentMessages;
      
      // Naviguer dans le namespace si spécifié
      if (namespace) {
        const namespaceParts = namespace.split('.');
        for (const part of namespaceParts) {
          if (message && typeof message === 'object' && part in message) {
            message = message[part];
          } else {
            console.warn(`[useI18n] Namespace manquant "${part}" dans "${namespace}"`);
            return `Missing namespace: ${namespace}`;
          }
        }
      }
      
      // Naviguer dans la clé
      const keyParts = key.split('.');
      for (const part of keyParts) {
        if (message && typeof message === 'object' && part in message) {
          message = message[part];
        } else {
          console.warn(`[useI18n] Clé manquante: ${key} (namespace: ${namespace || 'none'})`);
          return `Missing: ${key}`;
        }
      }
      
      if (typeof message !== 'string') {
        console.warn(`[useI18n] Valeur invalide pour ${key}:`, typeof message);
        return `Invalid: ${key}`;
      }
      
      // Interpolation des variables (paramètres comme {name}, {count}, etc.)
      if (variables && Object.keys(variables).length > 0) {
        return message.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
          const value = variables[varName];
          return value !== undefined ? value.toString() : match;
        });
      }
      
      return message;
    } catch (error) {
      console.error('[useI18n] Erreur:', error);
      return `Error: ${key}`;
    }
  }, [currentMessages, namespace, isLoading]);

  return {
    t,
    isLoading,
    currentLanguage,
    loadModule,
    switchLanguage
  };
}

// Hook spécialisé pour charger seulement des modules d'interface spécifiques
export function useModularI18n(
  modules: string[],
  namespace?: string,
  language?: string
) {
  return useI18n(namespace, {
    language,
    modules,
    preload: false
  });
}

// Hook pour les messages d'interface essentiels (common, auth, components)
export function useEssentialI18n(namespace?: string, language?: string) {
  return useModularI18n(['common', 'auth', 'components'], namespace, language);
}

// Hook pour les messages d'interface d'une page spécifique
export function usePageI18n(page: 'landing' | 'dashboard' | 'settings' | 'conversations', language?: string) {
  return useModularI18n(['common', 'components', page], page, language);
}
