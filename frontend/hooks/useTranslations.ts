/**
 * Hook personnalisé pour les traductions - VERSION ULTRA-STABLE
 * Support du changement de langue sans boucles infinies
 */

import { useCallback, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import frTranslations from '@/locales/fr.json';
import enTranslations from '@/locales/en.json';
import ptTranslations from '@/locales/pt.json';

interface TranslationMessages {
  [key: string]: any;
}

// Vraies traductions importées statiquement
const REAL_TRANSLATIONS = {
  fr: frTranslations,
  en: enTranslations,
  pt: ptTranslations
};

export function useTranslations(namespace?: string) {
  // STABLE: pas de useState, juste useLanguage pour la langue courante
  const { currentInterfaceLanguage } = useLanguage();
  
  // STABLE: useMemo pour éviter les recalculs inutiles
  const currentMessages = useMemo(() => {
    const lang = currentInterfaceLanguage || 'fr';
    return REAL_TRANSLATIONS[lang as keyof typeof REAL_TRANSLATIONS] || REAL_TRANSLATIONS.fr;
  }, [currentInterfaceLanguage]);

  // Fonction de traduction STABLE avec useCallback
  const t = useCallback((key: string, variables?: Record<string, string | number>): string => {
    try {
      // Extraire le message selon le namespace et la clé
      let message: any = currentMessages;
      
      if (namespace) {
        // Navigation vers le namespace
        const namespaceParts = namespace.split('.');
        for (const part of namespaceParts) {
          if (message && typeof message === 'object' && part in message) {
            message = message[part];
          } else {
            console.warn(`[useTranslations] Namespace "${namespace}" non trouvé pour la langue ${currentInterfaceLanguage}`);
            return `Missing namespace: ${namespace}`;
          }
        }
      }
      
      // Navigation vers la clé finale
      const keyParts = key.split('.');
      for (const part of keyParts) {
        if (message && typeof message === 'object' && part in message) {
          message = message[part];
        } else {
          console.warn(`[useTranslations] Clé "${key}" non trouvée dans le namespace "${namespace || 'root'}" pour la langue ${currentInterfaceLanguage}`);
          return `Missing: ${key}`;
        }
      }
      
      if (typeof message !== 'string') {
        console.warn(`[useTranslations] La clé "${key}" ne pointe pas vers une chaîne de caractères`);
        return `Invalid: ${key}`;
      }
      
      // Interpolation des variables si fournies
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
  }, [currentMessages, namespace, currentInterfaceLanguage]);

  // Fonction pour récupérer des tableaux de traductions
  const tArray = useCallback((key: string, variables?: Record<string, string | number>): string[] => {
    try {
      let message: any = currentMessages;
      
      if (namespace) {
        const namespaceParts = namespace.split('.');
        for (const part of namespaceParts) {
          if (message && typeof message === 'object' && part in message) {
            message = message[part];
          } else {
            console.warn(`[useTranslations] Namespace "${namespace}" non trouvé pour la langue ${currentInterfaceLanguage}`);
            return [];
          }
        }
      }
      
      const keyParts = key.split('.');
      for (const part of keyParts) {
        if (message && typeof message === 'object' && part in message) {
          message = message[part];
        } else {
          console.warn(`[useTranslations] Clé de tableau "${key}" non trouvée dans le namespace "${namespace || 'root'}" pour la langue ${currentInterfaceLanguage}`);
          return [];
        }
      }
      
      if (!Array.isArray(message)) {
        console.warn(`[useTranslations] La clé "${key}" n'est pas un tableau`);
        return [];
      }
      
      // Gestion des variables pour chaque élément du tableau
      if (variables && Object.keys(variables).length > 0) {
        return message.map((item: any) => {
          if (typeof item === 'string') {
            return item.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
              return variables[varName]?.toString() || match;
            });
          }
          return item;
        });
      }
      
      return message;
    } catch (error) {
      console.error('[useTranslations] Erreur lors de la récupération du tableau:', error);
      return [];
    }
  }, [currentMessages, namespace, currentInterfaceLanguage]);

  // Fonction pour récupérer des objets de traductions
  const tObject = useCallback((key: string, variables?: Record<string, string | number>): any => {
    try {
      let message: any = currentMessages;
      
      if (namespace) {
        const namespaceParts = namespace.split('.');
        for (const part of namespaceParts) {
          if (message && typeof message === 'object' && part in message) {
            message = message[part];
          } else {
            console.warn(`[useTranslations] Namespace "${namespace}" non trouvé pour la langue ${currentInterfaceLanguage}`);
            return {};
          }
        }
      }
      
      const keyParts = key.split('.');
      for (const part of keyParts) {
        if (message && typeof message === 'object' && part in message) {
          message = message[part];
        } else {
          console.warn(`[useTranslations] Clé d'objet "${key}" non trouvée dans le namespace "${namespace || 'root'}" pour la langue ${currentInterfaceLanguage}`);
          return {};
        }
      }
      
      if (typeof message !== 'object' || Array.isArray(message)) {
        console.warn(`[useTranslations] La clé "${key}" n'est pas un objet`);
        return {};
      }
      
      // Gestion des variables pour les propriétés de l'objet
      if (variables && Object.keys(variables).length > 0) {
        const result: any = {};
        for (const [objKey, objValue] of Object.entries(message)) {
          if (typeof objValue === 'string') {
            result[objKey] = objValue.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
              return variables[varName]?.toString() || match;
            });
          } else {
            result[objKey] = objValue;
          }
        }
        return result;
      }
      
      return message;
    } catch (error) {
      console.error('[useTranslations] Erreur lors de la récupération de l\'objet:', error);
      return {};
    }
  }, [currentMessages, namespace, currentInterfaceLanguage]);

  return { t, tArray, tObject };
}