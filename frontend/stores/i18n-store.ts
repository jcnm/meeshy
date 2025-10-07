/**
 * I18n Store - Internationalization with Zustand persistence
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface I18nState {
  currentLanguage: string;
  loadedModules: Record<string, Record<string, string>>;
  isLoading: boolean;
  error: string | null;
  cache: Record<string, Record<string, string>>;
}

interface I18nActions {
  switchLanguage: (language: string) => Promise<void>;
  loadModule: (module: string) => Promise<void>;
  translate: (key: string, params?: Record<string, any>) => string;
  addTranslations: (language: string, module: string, translations: Record<string, string>) => void;
  clearCache: () => void;
}

type I18nStore = I18nState & I18nActions;

// Simple translation function with parameter replacement
const interpolate = (template: string, params: Record<string, any> = {}): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
};

// Mock function to simulate loading translation modules
async function loadTranslationModule(language: string, module: string): Promise<Record<string, string>> {
  // This would typically load from your actual i18n files
  // For now, return empty object
  return {};
}

const initialState: I18nState = {
  currentLanguage: 'fr',
  loadedModules: {},
  isLoading: false,
  error: null,
  cache: {},
};

export const useI18nStore = create<I18nStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        switchLanguage: async (language: string) => {
          if (language === get().currentLanguage) return;
          
          set({ isLoading: true, error: null });
          
          try {
            // Load language data
            await get().loadModule('common');
            
            set({
              currentLanguage: language,
              isLoading: false,
            });
            
          } catch (error) {
            console.error('[I18N_STORE] Language switch failed:', error);
            set({
              error: `Failed to load language: ${language}`,
              isLoading: false,
            });
          }
        },

        loadModule: async (module: string) => {
          const { currentLanguage, loadedModules } = get();
          const moduleKey = `${currentLanguage}_${module}`;
          
          // Check if already loaded
          if (loadedModules[moduleKey]) {
            return;
          }
          
          set({ isLoading: true });
          
          try {
            const translations = await loadTranslationModule(currentLanguage, module);
            
            set((state) => ({
              loadedModules: {
                ...state.loadedModules,
                [moduleKey]: translations,
              },
              cache: {
                ...state.cache,
                [currentLanguage]: {
                  ...state.cache[currentLanguage],
                  ...translations,
                },
              },
              isLoading: false,
            }));
            
          } catch (error) {
            console.error('[I18N_STORE] Module load failed:', error);
            set({
              error: `Failed to load module: ${module}`,
              isLoading: false,
            });
          }
        },

        translate: (key: string, params?: Record<string, any>): string => {
          const { currentLanguage, cache } = get();
          const languageCache = cache[currentLanguage];
          
          if (languageCache && languageCache[key]) {
            return interpolate(languageCache[key], params);
          }
          
          // Fallback to key if translation not found
          console.warn(`[I18N_STORE] Translation not found for key: ${key} (language: ${currentLanguage})`);
          return key;
        },

        addTranslations: (language: string, module: string, translations: Record<string, string>) => {
          const moduleKey = `${language}_${module}`;
          
          set((state) => ({
            loadedModules: {
              ...state.loadedModules,
              [moduleKey]: translations,
            },
            cache: {
              ...state.cache,
              [language]: {
                ...state.cache[language],
                ...translations,
              },
            },
          }));
        },

        clearCache: () => {
          set({
            loadedModules: {},
            cache: {},
          });
        },
      }),
      {
        name: 'meeshy-i18n',
        partialize: (state) => ({
          currentLanguage: state.currentLanguage,
          cache: state.cache,
          // Don't persist loading states or errors
        }),
      }
    ),
    { name: 'I18nStore' }
  )
);

// Selector hooks
export const useCurrentI18nLanguage = () => useI18nStore((state) => state.currentLanguage);
export const useI18nLoading = () => useI18nStore((state) => state.isLoading);
export const useI18nError = () => useI18nStore((state) => state.error);
export const useTranslate = () => useI18nStore((state) => state.translate);

// Use useShallow to prevent infinite loops when selecting multiple actions
export const useI18nActions = () => useI18nStore(
  useShallow((state) => ({
    switchLanguage: state.switchLanguage,
    loadModule: state.loadModule,
    addTranslations: state.addTranslations,
    clearCache: state.clearCache,
  }))
);