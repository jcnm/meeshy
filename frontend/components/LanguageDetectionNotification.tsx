/**
 * Composant pour notifier l'utilisateur de la détection automatique de langue
 */

"use client";

import React, { useEffect, useState } from 'react';
import { useBrowserLanguageDetection } from '@/hooks/useBrowserLanguageDetection';
import { useLanguage } from '@/context/LanguageContext';

interface LanguageDetectionNotificationProps {
  showNotification?: boolean;
  onLanguageAccepted?: (language: string) => void;
  onLanguageRejected?: () => void;
}

export function LanguageDetectionNotification({
  showNotification = true,
  onLanguageAccepted,
  onLanguageRejected
}: LanguageDetectionNotificationProps) {
  const { 
    detectedInterfaceLanguage, 
    isDetectionComplete, 
    browserLanguages 
  } = useBrowserLanguageDetection();
  
  const { currentInterfaceLanguage, setInterfaceLanguage } = useLanguage();
  const [shouldShowNotification, setShouldShowNotification] = useState(false);
  const [hasBeenShown, setHasBeenShown] = useState(false);

  useEffect(() => {
    if (!isDetectionComplete || hasBeenShown || !showNotification) return;

    // Vérifier si la langue détectée est différente de la langue actuelle
    const isLanguageDifferent = detectedInterfaceLanguage !== currentInterfaceLanguage;
    
    // Vérifier si l'utilisateur n'a pas déjà été notifié aujourd'hui
    const lastNotificationDate = localStorage.getItem('meeshy-language-detection-notification');
    const today = new Date().toDateString();
    const shouldNotifyToday = lastNotificationDate !== today;

    if (isLanguageDifferent && shouldNotifyToday && detectedInterfaceLanguage !== 'en') {
      console.log('[LANG_DETECTION_NOTIFICATION] Showing language detection notification:', {
        detected: detectedInterfaceLanguage,
        current: currentInterfaceLanguage,
        browserLanguages
      });
      
      setShouldShowNotification(true);
      setHasBeenShown(true);
      
      // Marquer comme affiché aujourd'hui
      localStorage.setItem('meeshy-language-detection-notification', today);
    }
  }, [isDetectionComplete, detectedInterfaceLanguage, currentInterfaceLanguage, hasBeenShown, showNotification, browserLanguages]);

  const handleAcceptLanguage = () => {
    console.log('[LANG_DETECTION_NOTIFICATION] User accepted detected language:', detectedInterfaceLanguage);
    setInterfaceLanguage(detectedInterfaceLanguage);
    setShouldShowNotification(false);
    onLanguageAccepted?.(detectedInterfaceLanguage);
  };

  const handleRejectLanguage = () => {
    console.log('[LANG_DETECTION_NOTIFICATION] User rejected detected language');
    setShouldShowNotification(false);
    onLanguageRejected?.();
  };

  if (!shouldShowNotification || !isDetectionComplete) {
    return null;
  }

  const getLanguageName = (code: string) => {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'fr': 'Français',
      'pt': 'Português'
    };
    return languageNames[code] || code.toUpperCase();
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="text-2xl">🌐</div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Langue détectée
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Nous avons détecté que votre navigateur préfère <strong>{getLanguageName(detectedInterfaceLanguage)}</strong>. 
            Souhaitez-vous changer la langue de l'interface ?
          </p>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleAcceptLanguage}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors"
            >
              Oui, changer
            </button>
            <button
              onClick={handleRejectLanguage}
              className="text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
            >
              Non, merci
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LanguageDetectionNotification;
