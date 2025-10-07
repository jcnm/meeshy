/**
 * Language Store - Language preferences with Zustand persistence
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface UserLanguageConfig {
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
}

interface LanguageState {
  currentInterfaceLanguage: string;
  currentMessageLanguage: string;
  availableLanguages: string[];
  userLanguageConfig: UserLanguageConfig;
}

interface LanguageActions {
  setInterfaceLanguage: (language: string) => void;
  setMessageLanguage: (language: string) => void;
  setCustomDestinationLanguage: (language: string) => void;
  updateLanguageConfig: (config: Partial<UserLanguageConfig>) => void;
  detectAndSetBrowserLanguage: () => void;
  isLanguageSupported: (language: string) => boolean;
}

type LanguageStore = LanguageState & LanguageActions;

// Detect browser language
const detectBrowserLanguage = (): string => {
  if (typeof window === 'undefined') return 'fr';
  
  const browserLang = navigator.language.split('-')[0];
  const supportedLanguages = ['fr', 'en', 'es', 'de', 'pt', 'it', 'zh', 'ja', 'ar'];
  
  return supportedLanguages.includes(browserLang) ? browserLang : 'fr';
};

const DEFAULT_LANGUAGE_CONFIG: UserLanguageConfig = {
  systemLanguage: 'fr',
  regionalLanguage: 'fr',
  customDestinationLanguage: undefined,
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: false,
  useCustomDestination: false,
};

const initialState: LanguageState = {
  currentInterfaceLanguage: detectBrowserLanguage(),
  currentMessageLanguage: detectBrowserLanguage(),
  availableLanguages: ['fr', 'en', 'es', 'de', 'pt', 'it', 'zh', 'ja', 'ar'],
  userLanguageConfig: DEFAULT_LANGUAGE_CONFIG,
};

export const useLanguageStore = create<LanguageStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setInterfaceLanguage: (language: string) => {
          if (!get().isLanguageSupported(language)) {
            console.warn(`[LANGUAGE_STORE] Unsupported interface language: ${language}`);
            return;
          }
          
          console.log('[LANGUAGE_STORE] Setting interface language:', language);
          set({ currentInterfaceLanguage: language });
        },

        setMessageLanguage: (language: string) => {
          if (!get().isLanguageSupported(language)) {
            console.warn(`[LANGUAGE_STORE] Unsupported message language: ${language}`);
            return;
          }
          
          console.log('[LANGUAGE_STORE] Setting message language:', language);
          set({ currentMessageLanguage: language });
        },

        setCustomDestinationLanguage: (language: string) => {
          console.log('[LANGUAGE_STORE] Setting custom destination language:', language);
          set((state) => ({
            userLanguageConfig: {
              ...state.userLanguageConfig,
              customDestinationLanguage: language,
            },
          }));
        },

        updateLanguageConfig: (config: Partial<UserLanguageConfig>) => {
          console.log('[LANGUAGE_STORE] Updating language config:', config);
          set((state) => ({
            userLanguageConfig: {
              ...state.userLanguageConfig,
              ...config,
            },
          }));
        },

        detectAndSetBrowserLanguage: () => {
          const browserLang = detectBrowserLanguage();
          console.log('[LANGUAGE_STORE] Detected browser language:', browserLang);
          
          set({
            currentInterfaceLanguage: browserLang,
            currentMessageLanguage: browserLang,
          });
        },

        isLanguageSupported: (language: string): boolean => {
          return get().availableLanguages.includes(language);
        },
      }),
      {
        name: 'meeshy-language',
        partialize: (state) => ({
          currentInterfaceLanguage: state.currentInterfaceLanguage,
          currentMessageLanguage: state.currentMessageLanguage,
          userLanguageConfig: state.userLanguageConfig,
        }),
      }
    ),
    { name: 'LanguageStore' }
  )
);

// Selector hooks
export const useCurrentInterfaceLanguage = () => useLanguageStore((state) => state.currentInterfaceLanguage);
export const useCurrentMessageLanguage = () => useLanguageStore((state) => state.currentMessageLanguage);
export const useAvailableLanguages = () => useLanguageStore((state) => state.availableLanguages);
export const useUserLanguageConfig = () => useLanguageStore((state) => state.userLanguageConfig);

// Use useShallow to prevent infinite loops when selecting multiple actions
export const useLanguageActions = () => useLanguageStore(
  useShallow((state) => ({
    setInterfaceLanguage: state.setInterfaceLanguage,
    setMessageLanguage: state.setMessageLanguage,
    setCustomDestinationLanguage: state.setCustomDestinationLanguage,
    updateLanguageConfig: state.updateLanguageConfig,
    detectAndSetBrowserLanguage: state.detectAndSetBrowserLanguage,
    isLanguageSupported: state.isLanguageSupported,
  }))
);