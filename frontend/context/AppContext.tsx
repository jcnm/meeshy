'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { User } from '@/types';

// Types
interface AppState {
  user: User | null;
  isAuthChecking: boolean;
  translationCache: Record<string, any>;
}

type AppAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTH_CHECKING'; payload: boolean }
  | { type: 'SET_TRANSLATION_CACHE'; payload: Record<string, any> }
  | { type: 'ADD_TRANSLATION_TO_CACHE'; payload: { key: string; data: any } };

// État initial
const initialState: AppState = {
  user: null,
  isAuthChecking: true,
  translationCache: {}
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_AUTH_CHECKING':
      return { ...state, isAuthChecking: action.payload };
    case 'SET_TRANSLATION_CACHE':
      return { ...state, translationCache: action.payload };
    case 'ADD_TRANSLATION_TO_CACHE':
      return { 
        ...state, 
        translationCache: { 
          ...state.translationCache, 
          [action.payload.key]: action.payload.data 
        } 
      };
    default:
      return state;
  }
}

// Contexte
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Charger les données initiales depuis localStorage seulement
  useEffect(() => {
    const initializeUser = async () => {
      dispatch({ type: 'SET_AUTH_CHECKING', payload: true });
      
      // Charger les données utilisateur depuis localStorage seulement
      // La vérification d'authentification est gérée par le hook useAuth
      const savedUser = localStorage.getItem('user');
      const token = localStorage.getItem('auth_token');

      console.log('[APP_CONTEXT] Initialisation - Token:', !!token, 'User:', !!savedUser);

      if (token && savedUser) {
        try {
          // Parser les données utilisateur depuis localStorage
          const userData = JSON.parse(savedUser);
          console.log('[APP_CONTEXT] Utilisateur chargé depuis localStorage:', userData.username);
          dispatch({ type: 'SET_USER', payload: userData });
        } catch (error) {
          console.error('[APP_CONTEXT] Erreur parsing utilisateur localStorage:', error);
          // Données corrompues, nettoyer tout
          console.log('[APP_CONTEXT] Nettoyage des données corrompues');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          dispatch({ type: 'SET_USER', payload: null });
        }
      } else if (savedUser && !token) {
        // Incohérence, nettoyer
        console.log('[APP_CONTEXT] Incohérence détectée: user sans token, nettoyage');
        localStorage.removeItem('user');
        dispatch({ type: 'SET_USER', payload: null });
      } else if (!savedUser && token) {
        // Incohérence, nettoyer
        console.log('[APP_CONTEXT] Incohérence détectée: token sans user, nettoyage');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        dispatch({ type: 'SET_USER', payload: null });
      } else {
        console.log('[APP_CONTEXT] Aucune donnée d\'authentification trouvée');
        dispatch({ type: 'SET_USER', payload: null });
      }
      
      dispatch({ type: 'SET_AUTH_CHECKING', payload: false });
    };

    initializeUser();

    // Charger le cache de traduction
    const savedCache = localStorage.getItem('translationCache');
    if (savedCache) {
      try {
        const cacheData = JSON.parse(savedCache);
        dispatch({ type: 'SET_TRANSLATION_CACHE', payload: cacheData });
      } catch (error) {
        console.error('[APP_CONTEXT] Erreur parsing cache traduction:', error);
        localStorage.removeItem('translationCache');
      }
    }
  }, []);

  // Sauvegarder le cache de traduction quand il change
  useEffect(() => {
    if (Object.keys(state.translationCache).length > 0) {
      localStorage.setItem('translationCache', JSON.stringify(state.translationCache));
    }
  }, [state.translationCache]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Hooks spécialisés pour faciliter l'utilisation
export function useUser() {
  const { state, dispatch } = useAppContext();
  
  const setUser = useCallback((user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, [dispatch]);

  const logout = useCallback(() => {
    console.log('[APP_CONTEXT] Déconnexion utilisateur');
    
    // Nettoyer toutes les données d'authentification possibles
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Nettoyer aussi les données de session anonyme
    localStorage.removeItem('anonymous_session_token');
    localStorage.removeItem('anonymous_participant');
    localStorage.removeItem('anonymous_current_share_link');
    
    // Réinitialiser l'état utilisateur
    dispatch({ type: 'SET_USER', payload: null });
  }, [dispatch]);

  return {
    user: state.user,
    setUser,
    logout,
    isAuthChecking: state.isAuthChecking
  };
}

export function useTranslationCache() {
  const { state, dispatch } = useAppContext();
  
  const addToCache = useCallback((key: string, data: any) => {
    dispatch({ type: 'ADD_TRANSLATION_TO_CACHE', payload: { key, data } });
  }, [dispatch]);

  return {
    cache: state.translationCache,
    addToCache
  };
}
