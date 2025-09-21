/**
 * Provider unifié pour optimiser les performances
 * Combine TranslationProvider + LanguageProvider + AppProvider
 */

'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode, useState, useCallback, useMemo } from 'react';
import type { User } from '@shared/types';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface UnifiedState {
  // User & Auth
  user: User | null;
  isAuthChecking: boolean;
  
  // Languages & Translations
  currentInterfaceLanguage: string;
  currentMessageLanguage: string;
  availableLanguages: string[];
  translationCache: Record<string, Record<string, string>>;
  
  // App State
  isOnline: boolean;
  theme: 'light' | 'dark' | 'auto';
  notifications: any[];
}

type UnifiedAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTH_CHECKING'; payload: boolean }
  | { type: 'SET_INTERFACE_LANGUAGE'; payload: string }
  | { type: 'SET_MESSAGE_LANGUAGE'; payload: string }
  | { type: 'SET_TRANSLATION_CACHE'; payload: Record<string, Record<string, string>> }
  | { type: 'UPDATE_TRANSLATION'; payload: { key: string; lang: string; value: string } }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'auto' }
  | { type: 'ADD_NOTIFICATION'; payload: any }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

// =============================================================================
// INITIAL STATE & REDUCER
// =============================================================================

const initialState: UnifiedState = {
  user: null,
  isAuthChecking: true,
  currentInterfaceLanguage: 'fr',
  currentMessageLanguage: 'fr',
  availableLanguages: ['fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar'],
  translationCache: {},
  isOnline: true,
  theme: 'auto',
  notifications: [],
};

function unifiedReducer(state: UnifiedState, action: UnifiedAction): UnifiedState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_AUTH_CHECKING':
      return { ...state, isAuthChecking: action.payload };
    
    case 'SET_INTERFACE_LANGUAGE':
      return { ...state, currentInterfaceLanguage: action.payload };
    
    case 'SET_MESSAGE_LANGUAGE':
      return { ...state, currentMessageLanguage: action.payload };
    
    case 'SET_TRANSLATION_CACHE':
      return { ...state, translationCache: action.payload };
    
    case 'UPDATE_TRANSLATION':
      return {
        ...state,
        translationCache: {
          ...state.translationCache,
          [action.payload.lang]: {
            ...state.translationCache[action.payload.lang],
            [action.payload.key]: action.payload.value
          }
        }
      };
    
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };
    
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        notifications: [...state.notifications, action.payload] 
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    
    default:
      return state;
  }
}

// =============================================================================
// CONTEXT & HOOKS
// =============================================================================

const UnifiedContext = createContext<{
  state: UnifiedState;
  dispatch: React.Dispatch<UnifiedAction>;
  // Helper functions
  setUser: (user: User | null) => void;
  setInterfaceLanguage: (lang: string) => void;
  setMessageLanguage: (lang: string) => void;
  updateTranslation: (key: string, lang: string, value: string) => void;
  t: (key: string, lang?: string) => string;
} | null>(null);

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(unifiedReducer, initialState);

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  useEffect(() => {
    const initializeApp = async () => {
      dispatch({ type: 'SET_AUTH_CHECKING', payload: true });
      
      try {
        // Charger les données utilisateur depuis localStorage
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('auth_token');

        if (token && savedUser) {
          const userData = JSON.parse(savedUser);
          dispatch({ type: 'SET_USER', payload: userData });
          
          // Définir les langues selon l'utilisateur
          if (userData.systemLanguage) {
            dispatch({ type: 'SET_INTERFACE_LANGUAGE', payload: userData.systemLanguage });
          }
          if (userData.regionalLanguage) {
            dispatch({ type: 'SET_MESSAGE_LANGUAGE', payload: userData.regionalLanguage });
          }
        } else {
          // Détecter la langue du navigateur
          const browserLang = navigator.language.split('-')[0];
          if (state.availableLanguages.includes(browserLang)) {
            dispatch({ type: 'SET_INTERFACE_LANGUAGE', payload: browserLang });
            dispatch({ type: 'SET_MESSAGE_LANGUAGE', payload: browserLang });
          }
        }

        // Charger le cache de traduction
        const savedCache = localStorage.getItem('translationCache');
        if (savedCache) {
          const cacheData = JSON.parse(savedCache);
          dispatch({ type: 'SET_TRANSLATION_CACHE', payload: cacheData });
        }

        // Détecter le statut en ligne
        dispatch({ type: 'SET_ONLINE', payload: navigator.onLine });

      } catch (error) {
        console.error('[UNIFIED_PROVIDER] Erreur initialisation:', error);
        // Nettoyer les données corrompues
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        dispatch({ type: 'SET_USER', payload: null });
      } finally {
        dispatch({ type: 'SET_AUTH_CHECKING', payload: false });
      }
    };

    initializeApp();

    // Écouter les changements de statut en ligne
    const handleOnline = () => dispatch({ type: 'SET_ONLINE', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sauvegarder le cache de traduction
  useEffect(() => {
    if (Object.keys(state.translationCache).length > 0) {
      localStorage.setItem('translationCache', JSON.stringify(state.translationCache));
    }
  }, [state.translationCache]);

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  const setUser = useCallback((user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const setInterfaceLanguage = useCallback((lang: string) => {
    dispatch({ type: 'SET_INTERFACE_LANGUAGE', payload: lang });
  }, []);

  const setMessageLanguage = useCallback((lang: string) => {
    dispatch({ type: 'SET_MESSAGE_LANGUAGE', payload: lang });
  }, []);

  const updateTranslation = useCallback((key: string, lang: string, value: string) => {
    dispatch({ type: 'UPDATE_TRANSLATION', payload: { key, lang, value } });
  }, []);

  // Fonction de traduction optimisée
  const t = useCallback((key: string, lang?: string): string => {
    const targetLang = lang || state.currentInterfaceLanguage;
    const langCache = state.translationCache[targetLang];
    
    if (langCache && langCache[key]) {
      return langCache[key];
    }
    
    // Fallback vers la clé si pas de traduction
    return key;
  }, [state.currentInterfaceLanguage, state.translationCache]);

  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================

  const contextValue = useMemo(() => ({
    state,
    dispatch,
    setUser,
    setInterfaceLanguage,
    setMessageLanguage,
    updateTranslation,
    t,
  }), [state, setUser, setInterfaceLanguage, setMessageLanguage, updateTranslation, t]);

  return (
    <UnifiedContext.Provider value={contextValue}>
      {children}
    </UnifiedContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

export function useUnified() {
  const context = useContext(UnifiedContext);
  if (!context) {
    throw new Error('useUnified must be used within a UnifiedProvider');
  }
  return context;
}

// Hooks spécialisés pour compatibilité
export function useUser() {
  const { state, setUser } = useUnified();
  return {
    user: state.user,
    isAuthChecking: state.isAuthChecking,
    setUser,
  };
}

export function useLanguage() {
  const { state, setInterfaceLanguage, setMessageLanguage } = useUnified();
  return {
    currentInterfaceLanguage: state.currentInterfaceLanguage,
    currentMessageLanguage: state.currentMessageLanguage,
    availableLanguages: state.availableLanguages,
    setInterfaceLanguage,
    setMessageLanguage,
  };
}

export function useTranslations() {
  const { t, updateTranslation, state } = useUnified();
  return {
    t,
    updateTranslation,
    isLoading: false, // Plus de loading asynchrone
    currentLanguage: state.currentInterfaceLanguage,
  };
}
