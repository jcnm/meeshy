/**
 * Hook unifié pour la gestion des langues
 * Combine la détection de langue du navigateur et les noms de langues traduits
 */

"use client";

import { useEffect, useState, useMemo } from 'react';
import { detectBestInterfaceLanguage, getUserPreferredLanguage } from '@/utils/language-detection';
import { getBestMatchingLocale, detectUserPreferredLocale, type Locale } from '@/lib/i18n';
import { useTranslations } from './useTranslations';
import { INTERFACE_LANGUAGES } from '@/types/frontend';

export interface TranslatedLanguage {
  code: string;
  name: string;        // Nom en anglais
  nativeName: string;  // Nom natif de la langue (ex: Français)
  translatedName: string; // Nom traduit dans la langue de l'interface utilisateur
}

export interface BrowserLanguageDetection {
  detectedInterfaceLanguage: string;
  detectedSystemLanguage: string;
  isDetectionComplete: boolean;
  supportedLanguages: string[];
  browserLanguages: string[];
}

export interface UseLanguageReturn extends BrowserLanguageDetection {
  // Noms de langues traduits
  translatedLanguages: TranslatedLanguage[];
  getTranslatedLanguageName: (languageCode: string) => string;
  getLanguageInfo: (languageCode: string) => TranslatedLanguage | undefined;
  
  // Détection de langue
  detectUserLanguage: () => Promise<string>;
  isLanguageSupported: (languageCode: string) => boolean;
}

export function useLanguage(): UseLanguageReturn {
  const { t } = useTranslations('common');
  
  // État de détection
  const [detectedInterfaceLanguage, setDetectedInterfaceLanguage] = useState<string>('en');
  const [detectedSystemLanguage, setDetectedSystemLanguage] = useState<string>('en');
  const [isDetectionComplete, setIsDetectionComplete] = useState<boolean>(false);
  const [browserLanguages, setBrowserLanguages] = useState<string[]>([]);

  // Noms de langues traduits
  const translatedLanguages = useMemo(() => 
    INTERFACE_LANGUAGES.map(lang => ({
      code: lang.code,
      name: lang.name,
      nativeName: lang.name,
      translatedName: t(lang.code) || lang.name // Utilise la traduction ou fallback vers le nom anglais
    })), [t]
  );

  // Fonction pour obtenir un nom de langue spécifique traduit
  const getTranslatedLanguageName = useMemo(() => 
    (languageCode: string): string => {
      const language = translatedLanguages.find(lang => lang.code === languageCode);
      return language?.translatedName || languageCode;
    }, [translatedLanguages]
  );

  // Fonction pour obtenir les informations complètes d'une langue
  const getLanguageInfo = useMemo(() => 
    (languageCode: string): TranslatedLanguage | undefined => {
      return translatedLanguages.find(lang => lang.code === languageCode);
    }, [translatedLanguages]
  );

  // Fonction pour détecter la langue de l'utilisateur
  const detectUserLanguage = useMemo(() => 
    async (): Promise<string> => {
      if (typeof window === 'undefined') return 'en';

      try {
        console.log('[LANGUAGE_DETECTION] Starting user language detection...');
        
        // Détecter la langue préférée de l'utilisateur
        const userPreferredLanguage = await getUserPreferredLanguage();
        console.log('[LANGUAGE_DETECTION] User preferred language:', userPreferredLanguage);
        
        // Détecter la meilleure langue d'interface
        const bestInterfaceLanguage = await detectBestInterfaceLanguage();
        console.log('[LANGUAGE_DETECTION] Best interface language:', bestInterfaceLanguage);
        
        // Détecter la locale préférée
        const detectedLocale = detectUserPreferredLocale();
        console.log('[LANGUAGE_DETECTION] Detected locale:', detectedLocale);
        
        return bestInterfaceLanguage || userPreferredLanguage || 'en';
      } catch (error) {
        console.error('[LANGUAGE_DETECTION] Error detecting user language:', error);
        return 'en';
      }
    }, []
  );

  // Fonction pour vérifier si une langue est supportée
  const isLanguageSupported = useMemo(() => 
    (languageCode: string): boolean => {
      return INTERFACE_LANGUAGES.some(lang => lang.code === languageCode);
    }, []
  );

  // Effet pour la détection de langue du navigateur
  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('[LANGUAGE_DETECTION] Starting browser language detection...');

    // Obtenir les langues du navigateur
    const browserLangs = navigator.languages || [navigator.language];
    setBrowserLanguages(browserLangs);
    console.log('[LANGUAGE_DETECTION] Browser languages:', browserLangs);

    // Détecter la langue du système
    const systemLanguage = navigator.language || 'en';
    setDetectedSystemLanguage(systemLanguage);
    console.log('[LANGUAGE_DETECTION] System language:', systemLanguage);

    // Détecter la meilleure langue d'interface
    try {
      const bestLanguage = detectBestInterfaceLanguage();
      console.log('[LANGUAGE_DETECTION] Best interface language:', bestLanguage);
      setDetectedInterfaceLanguage(bestLanguage);
      setIsDetectionComplete(true);
    } catch (error) {
      console.error('[LANGUAGE_DETECTION] Error detecting interface language:', error);
      setDetectedInterfaceLanguage('en');
      setIsDetectionComplete(true);
    }
  }, [detectBestInterfaceLanguage]);

  return {
    // Détection de langue
    detectedInterfaceLanguage,
    detectedSystemLanguage,
    isDetectionComplete,
    supportedLanguages: INTERFACE_LANGUAGES.map(lang => lang.code),
    browserLanguages,
    
    // Noms de langues traduits
    translatedLanguages,
    getTranslatedLanguageName,
    getLanguageInfo,
    
    // Fonctions utilitaires
    detectUserLanguage,
    isLanguageSupported
  };
}
