'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserLanguageConfig, INTERFACE_LANGUAGES } from '@/types';
import { SUPPORTED_LANGUAGES } from '@/lib/constants/languages';
import { logLanguageDetectionInfo } from '@/utils/language-detection-logger';

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

// Default configuration - Use French as default since it's the main target language
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
  
  // Obtenir toutes les langues préférées du navigateur
  const browserLanguages = navigator.languages || [navigator.language || 'en'];
  
  console.log('[LANGUAGE_CONTEXT] Detecting system language from:', browserLanguages);
  
  // Vérifier chaque langue du navigateur dans l'ordre de préférence
  for (const lang of browserLanguages) {
    const languageCode = lang.split('-')[0].toLowerCase();
    
    // Vérifier si la langue est supportée dans la liste complète des langues supportées
    if (SUPPORTED_LANGUAGE_CODES.includes(languageCode as any)) {
      console.log('[LANGUAGE_CONTEXT] Detected system language:', languageCode);
      return languageCode;
    }
  }
  
  // Fallback vers le français si aucune langue supportée n'est trouvée
  console.log('[LANGUAGE_CONTEXT] No supported system language found, falling back to French');
  return 'fr';
}

function detectRegionalLanguage(): string {
  if (typeof window === 'undefined') return 'fr';
  
  // Pour la langue régionale, on peut utiliser la même logique que pour la langue système
  // mais on pourrait aussi considérer des facteurs géographiques
  const browserLanguages = navigator.languages || [navigator.language || 'en'];
  
  console.log('[LANGUAGE_CONTEXT] Detecting regional language from:', browserLanguages);
  
  // Prendre la deuxième langue préférée si disponible, sinon la première
  const secondaryLang = browserLanguages[1] || browserLanguages[0] || 'fr';
  const languageCode = secondaryLang.split('-')[0].toLowerCase();
  
  if (SUPPORTED_LANGUAGE_CODES.includes(languageCode as any)) {
    console.log('[LANGUAGE_CONTEXT] Detected regional language:', languageCode);
    return languageCode;
  }
  
  // Fallback vers la langue système détectée
  return detectSystemLanguage();
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

function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  
  // Obtenir toutes les langues préférées du navigateur
  const browserLanguages = navigator.languages || [navigator.language || 'en'];
  
  console.log('[LANGUAGE_CONTEXT] Detected browser languages:', browserLanguages);
  
  // Vérifier chaque langue du navigateur dans l'ordre de préférence
  for (const lang of browserLanguages) {
    const languageCode = lang.split('-')[0].toLowerCase();
    
    // Vérifier si la langue est supportée comme langue d'interface
    if (INTERFACE_LANGUAGE_CODES.includes(languageCode as any)) {
      console.log('[LANGUAGE_CONTEXT] Using detected browser language:', languageCode);
      return languageCode;
    }
  }
  
  // Fallback vers le français si aucune langue supportée n'est trouvée
  console.log('[LANGUAGE_CONTEXT] No supported language found in browser preferences, falling back to French');
  return 'fr';
}

function loadInterfaceLanguage(): string {
  if (typeof window === 'undefined') return 'fr';
  
  try {
    const stored = localStorage.getItem(INTERFACE_LANGUAGE_KEY);
    if (stored && INTERFACE_LANGUAGE_CODES.includes(stored as any)) {
      console.log('[LANGUAGE_CONTEXT] Using stored interface language:', stored);
      return stored;
    }
  } catch (error) {
    console.error('[LANGUAGE_CONTEXT] Error loading interface language:', error);
  }
  
  // Si aucune langue sauvegardée n'est trouvée, détecter automatiquement la langue du navigateur
  const detectedLanguage = detectBrowserLanguage();
  console.log('[LANGUAGE_CONTEXT] Auto-detected interface language:', detectedLanguage);
  return detectedLanguage;
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
  const [currentInterfaceLanguage, setCurrentInterfaceLanguage] = useState<string>('fr');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize language configuration on first load
  useEffect(() => {
    if (isInitialized) return;

    console.log('[LANGUAGE_CONTEXT] Initializing language configuration...');
    
    // Log detailed detection information in development
    if (process.env.NODE_ENV === 'development') {
      logLanguageDetectionInfo();
    }
    
    // Load saved configuration
    const savedConfig = loadLanguageConfig();
    const savedInterfaceLanguage = loadInterfaceLanguage(); // This now includes auto-detection
    
    // Detect system and regional languages
    const detectedSystemLanguage = detectSystemLanguage();
    const detectedRegionalLanguage = detectRegionalLanguage();
    
    // Create initial configuration - prioritize saved config, then detected languages, then defaults
    const initialConfig: UserLanguageConfig = {
      ...DEFAULT_LANGUAGE_CONFIG,
      ...savedConfig,
      // Use detected languages if no saved configuration exists
      systemLanguage: savedConfig.systemLanguage || detectedSystemLanguage,
      regionalLanguage: savedConfig.regionalLanguage || detectedRegionalLanguage,
      // Set custom destination to the detected system language if not already set
      customDestinationLanguage: savedConfig.customDestinationLanguage || detectedSystemLanguage,
    };
    
    // Interface language is automatically detected in loadInterfaceLanguage() if not saved
    const interfaceLanguage = savedInterfaceLanguage;
    
    console.log('[LANGUAGE_CONTEXT] Initial config:', {
      detectedSystemLanguage,
      detectedRegionalLanguage,
      interfaceLanguage,
      savedConfig,
      initialConfig,
      browserLanguages: typeof window !== 'undefined' ? navigator.languages : 'server-side'
    });
    
    setUserLanguageConfig(initialConfig);
    setCurrentInterfaceLanguage(interfaceLanguage);
    setIsInitialized(true);
    
    // Save the initial configuration
    saveLanguageConfig(initialConfig);
    saveInterfaceLanguage(interfaceLanguage);
    
    console.log('[LANGUAGE_CONTEXT] Language configuration initialized with browser detection');
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
