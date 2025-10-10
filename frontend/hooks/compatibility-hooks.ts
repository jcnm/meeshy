/**
 * Compatibility hooks for existing components
 * These provide the same interface as the old Context API hooks but use Zustand stores
 */

import { 
  useUser as useUserStore,
  useAuthActions,
  useCurrentInterfaceLanguage,
  useUserLanguageConfig,
  useLanguageActions,
} from '@/stores';

// Legacy useUser hook compatibility
export function useUser() {
  const user = useUserStore();
  const { setUser, logout } = useAuthActions();
  
  return {
    user,
    setUser,
    logout,
    isAuthChecking: false, // This is handled by the store now
  };
}

// Legacy useLanguage hook compatibility
export function useLanguage() {
  const currentInterfaceLanguage = useCurrentInterfaceLanguage();
  const userLanguageConfig = useUserLanguageConfig();
  const { setInterfaceLanguage, setCustomDestinationLanguage, isLanguageSupported } = useLanguageActions();
  
  return {
    userLanguageConfig,
    currentInterfaceLanguage,
    setCustomDestinationLanguage,
    setInterfaceLanguage,
    isLanguageSupported,
    getSupportedLanguages: () => [
      { code: 'fr', name: 'Français', nativeName: 'Français' },
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Español', nativeName: 'Español' },
      { code: 'de', name: 'Deutsch', nativeName: 'Deutsch' },
      { code: 'pt', name: 'Português', nativeName: 'Português' },
      { code: 'it', name: 'Italiano', nativeName: 'Italiano' },
    ],
  };
}
