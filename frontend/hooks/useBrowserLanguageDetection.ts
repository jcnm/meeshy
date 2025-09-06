/**
 * Hook pour détecter automatiquement la langue du navigateur
 * et l'appliquer comme langue d'interface par défaut
 */

"use client";

import { useEffect, useState } from 'react';
import { detectBestInterfaceLanguage, getUserPreferredLanguage } from '@/utils/language-detection';
import { getBestMatchingLocale, detectUserPreferredLocale, type Locale } from '@/lib/i18n';

export interface BrowserLanguageDetection {
  detectedInterfaceLanguage: string;
  detectedSystemLanguage: string;
  isDetectionComplete: boolean;
  supportedLanguages: string[];
  browserLanguages: string[];
}

export function useBrowserLanguageDetection(): BrowserLanguageDetection {
  const [detectedInterfaceLanguage, setDetectedInterfaceLanguage] = useState<string>('en');
  const [detectedSystemLanguage, setDetectedSystemLanguage] = useState<string>('en');
  const [isDetectionComplete, setIsDetectionComplete] = useState<boolean>(false);
  const [browserLanguages, setBrowserLanguages] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('[BROWSER_LANG_DETECTION] Starting browser language detection...');

    // Obtenir les langues du navigateur
    const languages = navigator.languages || [navigator.language || 'en'];
    setBrowserLanguages([...languages]);

    // Détecter la langue d'interface (limitée à en, fr, pt)
    const interfaceLanguage = detectBestInterfaceLanguage();
    setDetectedInterfaceLanguage(interfaceLanguage);

    // Détecter la langue système (toutes les langues supportées)
    const systemLanguage = getUserPreferredLanguage();
    setDetectedSystemLanguage(systemLanguage);

    console.log('[BROWSER_LANG_DETECTION] Detection results:', {
      browserLanguages: languages,
      detectedInterfaceLanguage: interfaceLanguage,
      detectedSystemLanguage: systemLanguage
    });

    setIsDetectionComplete(true);
  }, []);

  return {
    detectedInterfaceLanguage,
    detectedSystemLanguage,
    isDetectionComplete,
    supportedLanguages: ['en', 'fr', 'pt'], // Langues d'interface supportées
    browserLanguages
  };
}

/**
 * Hook simplifié pour obtenir directement la langue d'interface détectée
 */
export function useDetectedInterfaceLanguage(): string {
  const { detectedInterfaceLanguage, isDetectionComplete } = useBrowserLanguageDetection();
  
  // Retourner 'en' par défaut si la détection n'est pas encore terminée
  return isDetectionComplete ? detectedInterfaceLanguage : 'en';
}

/**
 * Hook pour obtenir des informations détaillées sur la détection de langue
 */
export function useBrowserLanguageInfo() {
  const [info, setInfo] = useState({
    primaryLanguage: 'en',
    allLanguages: [] as string[],
    supportedLanguages: [] as string[],
    unsupportedLanguages: [] as string[]
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const allLanguages = navigator.languages || [navigator.language || 'en'];
    const supportedInterfaceLanguages = ['en', 'fr', 'pt'];
    
    const supportedLanguages = allLanguages
      .map(lang => lang.split('-')[0].toLowerCase())
      .filter(lang => supportedInterfaceLanguages.includes(lang));
    
    const unsupportedLanguages = allLanguages
      .map(lang => lang.split('-')[0].toLowerCase())
      .filter(lang => !supportedInterfaceLanguages.includes(lang));

    setInfo({
      primaryLanguage: allLanguages[0]?.split('-')[0].toLowerCase() || 'en',
      allLanguages: allLanguages.map(lang => lang.split('-')[0].toLowerCase()),
      supportedLanguages: [...new Set(supportedLanguages)],
      unsupportedLanguages: [...new Set(unsupportedLanguages)]
    });

    console.log('[BROWSER_LANG_INFO] Language analysis:', {
      primaryLanguage: allLanguages[0]?.split('-')[0].toLowerCase() || 'en',
      allBrowserLanguages: allLanguages,
      supportedLanguages,
      unsupportedLanguages
    });
  }, []);

  return info;
}
