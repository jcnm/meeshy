'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserLanguageConfig, INTERFACE_LANGUAGES } from '@/types';
import { SUPPORTED_LANGUAGES } from '@/lib/constants/languages';

interface LanguageContextType {
  userLanguageConfig: UserLanguageConfig;
  currentInterfaceLanguage: string;
  setCustomDestinationLanguage: (language: string) => void;
  setInterfaceLanguage: (language: string) => void;
  isLanguageSupported: (language: string) => boolean;
  getSupportedLanguages: () => Array<{ code: string; name: string; nativeName: string }>;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

// Utiliser les langues supportées depuis le fichier constants
const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map(lang => lang.code);
const INTERFACE_LANGUAGE_CODES = INTERFACE_LANGUAGES.map(lang => lang.code);

// Default configuration
const DEFAULT_LANGUAGE_CONFIG: UserLanguageConfig = {
  systemLanguage: 'fr',
  regionalLanguage: 'fr',
  customDestinationLanguage: undefined,
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: false,
  useCustomDestination: false,
};

// Language detection utilities
function detectSystemLanguage(): string {
  if (typeof window === 'undefined') return 'fr';
  
  const browserLanguage = navigator.language || navigator.languages?.[0] || 'fr';
  const languageCode = browserLanguage.split('-')[0].toLowerCase();
  
  return SUPPORTED_LANGUAGE_CODES.includes(languageCode as any) ? languageCode : 'fr';
}

function detectRegionalLanguage(): string {
  if (typeof window === 'undefined') return 'fr';
  
  const browserLanguage = navigator.language || navigator.languages?.[0] || 'fr';
  const languageCode = browserLanguage.split('-')[0].toLowerCase();
  
  return SUPPORTED_LANGUAGE_CODES.includes(languageCode as any) ? languageCode : 'fr';
}

// Storage utilities
const LANGUAGE_CONFIG_KEY = 'meeshy_user_language_config';
const INTERFACE_LANGUAGE_KEY = 'meeshy_interface_language';

function loadLanguageConfig(): UserLanguageConfig {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE_CONFIG;
  
  try {
    const stored = localStorage.getItem(LANGUAGE_CONFIG_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      return { ...DEFAULT_LANGUAGE_CONFIG, ...config };
    }
  } catch (error) {
    console.error('[LANGUAGE_CONTEXT] Error loading language config:', error);
  }
  
  return DEFAULT_LANGUAGE_CONFIG;
}

function saveLanguageConfig(config: UserLanguageConfig): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(LANGUAGE_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('[LANGUAGE_CONTEXT] Error saving language config:', error);
  }
}

function loadInterfaceLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  
  try {
    const stored = localStorage.getItem(INTERFACE_LANGUAGE_KEY);
    if (stored && INTERFACE_LANGUAGE_CODES.includes(stored as any)) {
      return stored;
    }
  } catch (error) {
    console.error('[LANGUAGE_CONTEXT] Error loading interface language:', error);
  }
  
  return 'en';
}

function saveInterfaceLanguage(language: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(INTERFACE_LANGUAGE_KEY, language);
  } catch (error) {
    console.error('[LANGUAGE_CONTEXT] Error saving interface language:', error);
  }
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [userLanguageConfig, setUserLanguageConfig] = useState<UserLanguageConfig>(DEFAULT_LANGUAGE_CONFIG);
  const [currentInterfaceLanguage, setCurrentInterfaceLanguage] = useState<string>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize language configuration on first load
  useEffect(() => {
    if (isInitialized) return;

    console.log('[LANGUAGE_CONTEXT] Initializing language configuration...');
    
    // Load saved configuration
    const savedConfig = loadLanguageConfig();
    const savedInterfaceLanguage = loadInterfaceLanguage();
    
    // Detect system and regional languages
    const systemLanguage = detectSystemLanguage();
    const regionalLanguage = detectRegionalLanguage();
    
    // Create initial configuration
    const initialConfig: UserLanguageConfig = {
      ...savedConfig,
      systemLanguage: savedConfig.systemLanguage || systemLanguage,
      regionalLanguage: savedConfig.regionalLanguage || regionalLanguage,
      customDestinationLanguage: savedConfig.customDestinationLanguage || systemLanguage,
    };
    
    // Set interface language (use saved interface language or fallback to English)
    const interfaceLanguage = savedInterfaceLanguage || 'en';
    
    console.log('[LANGUAGE_CONTEXT] Initial config:', {
      systemLanguage,
      regionalLanguage,
      interfaceLanguage,
      savedConfig: savedConfig,
      initialConfig
    });
    
    setUserLanguageConfig(initialConfig);
    setCurrentInterfaceLanguage(interfaceLanguage);
    setIsInitialized(true);
    
    // Save the initial configuration
    saveLanguageConfig(initialConfig);
    saveInterfaceLanguage(interfaceLanguage);
    
    console.log('[LANGUAGE_CONTEXT] Language configuration initialized');
  }, [isInitialized]);

  // Save configuration when it changes
  useEffect(() => {
    if (!isInitialized) return;
    saveLanguageConfig(userLanguageConfig);
  }, [userLanguageConfig, isInitialized]);

  // Save interface language when it changes
  useEffect(() => {
    if (!isInitialized) return;
    saveInterfaceLanguage(currentInterfaceLanguage);
  }, [currentInterfaceLanguage, isInitialized]);

  const setCustomDestinationLanguage = (language: string) => {
    if (!SUPPORTED_LANGUAGE_CODES.includes(language as any)) {
      console.warn('[LANGUAGE_CONTEXT] Unsupported language:', language);
      return;
    }
    
    setUserLanguageConfig(prev => {
      const newConfig = {
        ...prev,
        customDestinationLanguage: language,
        useCustomDestination: true,
      };
      
      // Also update interface language if it matches the previous custom destination
      if (prev.customDestinationLanguage === currentInterfaceLanguage) {
        setCurrentInterfaceLanguage(language);
      }
      
      return newConfig;
    });
  };

  const setInterfaceLanguage = (language: string) => {
    if (!INTERFACE_LANGUAGE_CODES.includes(language as any)) {
      console.warn('[LANGUAGE_CONTEXT] Unsupported interface language:', language);
      return;
    }
    
    setCurrentInterfaceLanguage(language);
    
    // Update custom destination language to match
    setUserLanguageConfig(prev => ({
      ...prev,
      customDestinationLanguage: language,
      useCustomDestination: true,
    }));
  };

  const isLanguageSupported = (language: string): boolean => {
    return INTERFACE_LANGUAGE_CODES.includes(language as any);
  };

  const getSupportedLanguages = () => {
    return INTERFACE_LANGUAGES.map(lang => ({
      code: lang.code,
      name: lang.name,
      nativeName: lang.name
    }));
  };

  const contextValue: LanguageContextType = {
    userLanguageConfig,
    currentInterfaceLanguage,
    setCustomDestinationLanguage,
    setInterfaceLanguage,
    isLanguageSupported,
    getSupportedLanguages,
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
