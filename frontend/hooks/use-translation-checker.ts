/**
 * Hook pour vérifier et mettre à jour les traductions côté frontend
 * Permet de détecter les traductions manquantes et de les signaler
 */

import { useTranslations } from './useTranslations';
import { useEffect, useState } from 'react';

interface TranslationStatus {
  isLoaded: boolean;
  missingKeys: string[];
  hasErrors: boolean;
}

interface UseTranslationCheckerOptions {
  namespace?: string;
  requiredKeys?: string[];
  onMissingKey?: (key: string) => void;
  onError?: (error: Error) => void;
}

export function useTranslationChecker(options: UseTranslationCheckerOptions = {}) {
  const { namespace = 'common', requiredKeys = [], onMissingKey, onError } = options;
  const { t } = useTranslations(namespace);
  const [status, setStatus] = useState<TranslationStatus>({
    isLoaded: false,
    missingKeys: [],
    hasErrors: false
  });

  useEffect(() => {
    const checkTranslations = () => {
      try {
        const missingKeys: string[] = [];
        
        // Vérifier les clés requises
        requiredKeys.forEach(key => {
          try {
            const translation = t(key);
            if (!translation || translation === key) {
              missingKeys.push(key);
              onMissingKey?.(key);
            }
          } catch (error) {
            missingKeys.push(key);
            onMissingKey?.(key);
          }
        });

        setStatus({
          isLoaded: true,
          missingKeys,
          hasErrors: missingKeys.length > 0
        });
      } catch (error) {
        setStatus({
          isLoaded: true,
          missingKeys: [],
          hasErrors: true
        });
        onError?.(error as Error);
      }
    };

    checkTranslations();
  }, [t, requiredKeys, onMissingKey, onError]);

  return {
    ...status,
    t
  };
}

/**
 * Hook spécialisé pour vérifier les traductions de pages spécifiques
 */
export function usePageTranslations(pageName: string) {
  const requiredKeys = [
    'title',
    'subtitle',
    'formTitle',
    'formDescription',
    'usernameLabel',
    'usernamePlaceholder',
    'usernameHelp',
    'passwordLabel',
    'passwordPlaceholder',
    'passwordHelp',
    'loginButton',
    'loggingIn'
  ];

  return useTranslationChecker({
    namespace: pageName,
    requiredKeys,
    onMissingKey: (key) => {
      console.warn(`[TRANSLATION] Clé manquante pour ${pageName}: ${key}`);
    },
    onError: (error) => {
      console.error(`[TRANSLATION] Erreur de traduction pour ${pageName}:`, error);
    }
  });
}

/**
 * Hook pour vérifier les traductions de toast
 */
export function useToastTranslations() {
  const requiredKeys = [
    'connection.established',
    'connection.disconnected',
    'connection.lost',
    'messages.sent',
    'messages.sendError',
    'auth.fillAllFields',
    'auth.connectionError',
    'auth.serverConnectionError'
  ];

  return useTranslationChecker({
    namespace: 'toasts',
    requiredKeys,
    onMissingKey: (key) => {
      console.warn(`[TRANSLATION] Clé de toast manquante: ${key}`);
    }
  });
}

/**
 * Hook pour vérifier les traductions de validation
 */
export function useValidationTranslations() {
  const requiredKeys = [
    'required',
    'invalidEmail',
    'invalidPhone',
    'passwordTooShort',
    'passwordsDoNotMatch'
  ];

  return useTranslationChecker({
    namespace: 'validation',
    requiredKeys,
    onMissingKey: (key) => {
      console.warn(`[TRANSLATION] Clé de validation manquante: ${key}`);
    }
  });
}
