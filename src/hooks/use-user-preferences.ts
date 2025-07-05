'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { getUserPreferredLanguage, detectLanguage, saveUserPreferredLanguage } from '@/utils/language-detection';

interface UserPreferences extends Partial<User> {
  autoDetectLanguage: boolean;
  translationCacheEnabled: boolean;
  realTimeTranslation: boolean;
  showOriginalMessage: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  systemLanguage: 'en',
  regionalLanguage: 'en',
  customDestinationLanguage: '',
  autoTranslateEnabled: true,
  autoDetectLanguage: true,
  translationCacheEnabled: true,
  realTimeTranslation: true,
  showOriginalMessage: true,
};

export function useUserPreferences(initialUser?: User | null) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Charger les préférences depuis localStorage et l'utilisateur
  useEffect(() => {
    const loadPreferences = () => {
      try {
        const savedPrefs = localStorage.getItem('meeshy-user-preferences');
        const parsedPrefs = savedPrefs ? JSON.parse(savedPrefs) : {};
        
        // Détecter la langue préférée automatiquement si pas définie
        const detectedLanguage = getUserPreferredLanguage();
        
        const mergedPrefs: UserPreferences = {
          ...DEFAULT_PREFERENCES,
          ...parsedPrefs,
          systemLanguage: initialUser?.systemLanguage || parsedPrefs.systemLanguage || detectedLanguage,
          regionalLanguage: initialUser?.regionalLanguage || parsedPrefs.regionalLanguage || detectedLanguage,
          customDestinationLanguage: initialUser?.customDestinationLanguage || parsedPrefs.customDestinationLanguage || '',
          autoTranslateEnabled: initialUser?.autoTranslateEnabled ?? parsedPrefs.autoTranslateEnabled ?? true,
        };

        setPreferences(mergedPrefs);
      } catch (error) {
        console.error('Erreur lors du chargement des préférences:', error);
        setPreferences({
          ...DEFAULT_PREFERENCES,
          systemLanguage: getUserPreferredLanguage(),
          regionalLanguage: getUserPreferredLanguage(),
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [initialUser]);

  // Sauvegarder les préférences
  const savePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    try {
      const updatedPrefs = { ...preferences, ...newPrefs };
      setPreferences(updatedPrefs);
      
      // Sauvegarder dans localStorage
      localStorage.setItem('meeshy-user-preferences', JSON.stringify(updatedPrefs));
      
      // Sauvegarder la langue préférée séparément
      if (newPrefs.systemLanguage) {
        saveUserPreferredLanguage(newPrefs.systemLanguage);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des préférences:', error);
    }
  }, [preferences]);

  // Mettre à jour une préférence spécifique
  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    savePreferences({ [key]: value });
  }, [savePreferences]);

  // Détecter automatiquement la langue d'un message
  const detectMessageLanguage = useCallback((message: string): string => {
    if (!preferences.autoDetectLanguage || !message.trim()) {
      return preferences.systemLanguage || 'en';
    }

    try {
      return detectLanguage(message);
    } catch (error) {
      console.warn('Erreur lors de la détection de langue:', error);
      return preferences.systemLanguage || 'en';
    }
  }, [preferences.autoDetectLanguage, preferences.systemLanguage]);

  // Obtenir la langue de destination pour la traduction
  const getTargetLanguage = useCallback((sourceLanguage?: string): string => {
    // Si une langue personnalisée est définie, l'utiliser
    if (preferences.customDestinationLanguage) {
      return preferences.customDestinationLanguage;
    }

    // Si la langue source est différente de la langue système, traduire vers la langue système
    if (sourceLanguage && sourceLanguage !== preferences.systemLanguage) {
      return preferences.systemLanguage || 'en';
    }

    // Sinon, utiliser la langue régionale comme fallback
    return preferences.regionalLanguage || preferences.systemLanguage || 'en';
  }, [preferences.systemLanguage, preferences.regionalLanguage, preferences.customDestinationLanguage]);

  // Vérifier si la traduction est nécessaire
  const shouldTranslate = useCallback((sourceLanguage: string, targetLanguage?: string): boolean => {
    if (!preferences.autoTranslateEnabled) {
      return false;
    }

    const target = targetLanguage || getTargetLanguage(sourceLanguage);
    return sourceLanguage !== target;
  }, [preferences.autoTranslateEnabled, getTargetLanguage]);

  // Réinitialiser les préférences aux valeurs par défaut
  const resetPreferences = useCallback(() => {
    const resetPrefs = {
      ...DEFAULT_PREFERENCES,
      systemLanguage: getUserPreferredLanguage(),
      regionalLanguage: getUserPreferredLanguage(),
    };
    
    setPreferences(resetPrefs);
    
    try {
      localStorage.removeItem('meeshy-user-preferences');
      saveUserPreferredLanguage(resetPrefs.systemLanguage);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation des préférences:', error);
    }
  }, []);

  // Exporter les préférences au format User
  const toUserFormat = useCallback((): Partial<User> => ({
    systemLanguage: preferences.systemLanguage,
    regionalLanguage: preferences.regionalLanguage,
    customDestinationLanguage: preferences.customDestinationLanguage,
    autoTranslateEnabled: preferences.autoTranslateEnabled,
  }), [preferences]);

  return {
    preferences,
    isLoading,
    updatePreference,
    savePreferences,
    detectMessageLanguage,
    getTargetLanguage,
    shouldTranslate,
    resetPreferences,
    toUserFormat,
  };
}
