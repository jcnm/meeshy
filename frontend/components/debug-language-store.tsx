'use client';

import { useEffect } from 'react';
import { useCurrentInterfaceLanguage } from '@/stores';

export function DebugLanguageStore() {
  const currentLang = useCurrentInterfaceLanguage();
  
  useEffect(() => {
    console.log('🔍 [DEBUG] Current interface language from store:', currentLang);
    
    // Vérifier le localStorage
    const storedData = localStorage.getItem('meeshy-language');
    console.log('🔍 [DEBUG] LocalStorage data:', storedData);
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        console.log('🔍 [DEBUG] Parsed localStorage:', parsed);
      } catch (e) {
        console.error('Failed to parse localStorage:', e);
      }
    }
  }, [currentLang]);
  
  return null;
}
