/**
 * I18n Store - Internationalization with Zustand persistence
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { loadLanguageI18n, loadSpecificI18nModule } from '@/utils/i18n-loader';

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
const interpolate = (template: any, params: Record<string, any> = {}): string => {
  // Handle non-string values
  if (typeof template !== 'string') {
    return typeof template === 'object' ? JSON.stringify(template) : String(template);
  }
  
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
};

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
            console.log(`[I18N_STORE] Switching to language: ${language}`);
            
            // Load all translations for the language using i18n-loader
            const translations = await loadLanguageI18n(language);
            
            set({
              currentLanguage: language,
              cache: {
                ...get().cache,
                [language]: translations,
              },
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
            console.log(`[I18N_STORE] Loading module ${module} for ${currentLanguage}`);
            const translations = await loadSpecificI18nModule(currentLanguage, module);
            
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
          
          if (!languageCache) {
            console.warn(`[I18N_STORE] No cache for language: ${currentLanguage}`);
            return key;
          }
          
          // Navigate nested keys (e.g., "hero.badge" or "landing.hero.badge")
          const keys = key.split('.');
          let translation: any = languageCache;
          
          for (const k of keys) {
            if (translation && typeof translation === 'object' && k in translation) {
              translation = translation[k];
            } else {
              translation = null;
              break;
            }
          }
          
          // If not found, return key
          if (!translation) {
            console.warn(`[I18N_STORE] Translation not found for key: ${key} (language: ${currentLanguage})`);
            return key;
          }
          
          // If translation is an object, it means the key wasn't fully resolved
          if (typeof translation === 'object') {
            console.warn(`[I18N_STORE] Translation key ${key} points to object, not string`);
            return key;
          }
          
          return interpolate(translation, params);
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