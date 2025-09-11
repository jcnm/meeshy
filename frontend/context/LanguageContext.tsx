'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { UserLanguageConfig } from '@shared/types';
import { INTERFACE_LANGUAGES } from '@/types/frontend';

interface LanguageContextType {
  userLanguageConfig: UserLanguageConfig;
  currentInterfaceLanguage: string;
  setCustomDestinationLanguage: (language: string) => void;
  setInterfaceLanguage: (language: string) => void;
  isLanguageSupported: (language: string) => boolean;
  getSupportedLanguages: () => Array<{ code: string; name: string; nativeName: string }>;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

// Default configuration - RETOUR À LA VERSION STABLE
const DEFAULT_LANGUAGE_CONFIG: UserLanguageConfig = {
  systemLanguage: 'fr',
  regionalLanguage: 'fr',
  customDestinationLanguage: undefined,
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: false,
  useCustomDestination: false,
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  // État simple avec vrai changement de langue
  const [userLanguageConfig, setUserLanguageConfig] = useState<UserLanguageConfig>(DEFAULT_LANGUAGE_CONFIG);
  const [currentInterfaceLanguage, setCurrentInterfaceLanguage] = useState<string>('fr');

  // Fonction pour changer la langue de destination personnalisée
  const setCustomDestinationLanguage = useCallback((language: string) => {
    console.log('[LANGUAGE_CONTEXT] setCustomDestinationLanguage:', language);
    setUserLanguageConfig(prev => ({
      ...prev,
      customDestinationLanguage: language
    }));
  }, []);

  // Fonction pour changer la langue de l'interface
  const setInterfaceLanguage = useCallback((language: string) => {
    console.log('[LANGUAGE_CONTEXT] setInterfaceLanguage:', language);
    setCurrentInterfaceLanguage(language);
    
    // Optionnel : sauvegarder dans localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('meeshy-interface-language', language);
    }
  }, []);

  const isLanguageSupported = useCallback((language: string): boolean => {
    return ['fr', 'en', 'es', 'de', 'pt', 'it'].includes(language);
  }, []);

  // Charger la langue sauvegardée au démarrage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('meeshy-interface-language');
      if (savedLanguage && isLanguageSupported(savedLanguage)) {
        setCurrentInterfaceLanguage(savedLanguage);
      }
    }
  }, [isLanguageSupported]);

  const getSupportedLanguages = useCallback(() => {
    return INTERFACE_LANGUAGES.map(lang => ({
      code: lang.code,
      name: lang.name,
      nativeName: lang.name
    }));
  }, []);

  // Valeur mémorisée du contexte pour éviter les re-rendus inutiles
  const contextValue: LanguageContextType = useMemo(() => ({
    userLanguageConfig,
    currentInterfaceLanguage,
    setCustomDestinationLanguage,
    setInterfaceLanguage,
    isLanguageSupported,
    getSupportedLanguages,
  }), [userLanguageConfig, currentInterfaceLanguage, setCustomDestinationLanguage, setInterfaceLanguage, isLanguageSupported, getSupportedLanguages]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback statique pour SSR - VERSION STABLE
    return {
      userLanguageConfig: DEFAULT_LANGUAGE_CONFIG,
      currentInterfaceLanguage: 'fr',
      setCustomDestinationLanguage: () => {},
      setInterfaceLanguage: () => {},
      isLanguageSupported: (lang: string) => ['fr', 'en', 'es', 'de', 'pt', 'it'].includes(lang),
      getSupportedLanguages: () => INTERFACE_LANGUAGES,
    };
  }
  return context;
}
