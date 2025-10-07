/**
 * useTranslations hook - Compatible with existing components
 * Uses the new I18n Zustand store
 */

import { useEffect } from 'react';
import { useI18nStore, useI18nActions } from '@/stores';

export function useTranslations(module?: string) {
  const translate = useI18nStore((state) => state.translate);
  const isLoading = useI18nStore((state) => state.isLoading);
  const currentLanguage = useI18nStore((state) => state.currentLanguage);
  const { loadModule } = useI18nActions();
  
  // Load module in useEffect to avoid setState during render
  useEffect(() => {
    if (module) {
      loadModule(module);
    }
  }, [module, loadModule]);
  
  return {
    t: translate,
    isLoading,
    currentLanguage,
  };
}