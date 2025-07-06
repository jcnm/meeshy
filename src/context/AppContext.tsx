'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, Conversation, Group, Notification } from '@/types';

// Types pour le state global
interface AppState {
  user: User | null;
  conversations: Conversation[];
  groups: Group[];
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
  onlineUsers: string[];
  translationCache: Map<string, string>;
}

// Actions pour le reducer
type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: Conversation }
  | { type: 'REMOVE_CONVERSATION'; payload: string }
  | { type: 'SET_GROUPS'; payload: Group[] }
  | { type: 'ADD_GROUP'; payload: Group }
  | { type: 'UPDATE_GROUP'; payload: Group }
  | { type: 'REMOVE_GROUP'; payload: string }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ONLINE_USERS'; payload: string[] }
  | { type: 'ADD_TRANSLATION_CACHE'; payload: { key: string; value: string } }
  | { type: 'CLEAR_TRANSLATION_CACHE' };

// State initial
const initialState: AppState = {
  user: null,
  conversations: [],
  groups: [],
  notifications: [],
  isLoading: false,
  error: null,
  onlineUsers: [],
  translationCache: new Map(),
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    
    case 'ADD_CONVERSATION':
      return { ...state, conversations: [...state.conversations, action.payload] };
    
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.id ? action.payload : conv
        ),
      };
    
    case 'REMOVE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(conv => conv.id !== action.payload),
      };
    
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    
    case 'ADD_GROUP':
      return { ...state, groups: [...state.groups, action.payload] };
    
    case 'UPDATE_GROUP':
      return {
        ...state,
        groups: state.groups.map(group =>
          group.id === action.payload.id ? action.payload : group
        ),
      };
    
    case 'REMOVE_GROUP':
      return {
        ...state,
        groups: state.groups.filter(group => group.id !== action.payload),
      };
    
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(notif => notif.id !== action.payload),
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_ONLINE_USERS':
      return { ...state, onlineUsers: action.payload };
    
    case 'ADD_TRANSLATION_CACHE':
      const newCache = new Map(state.translationCache);
      newCache.set(action.payload.key, action.payload.value);
      return { ...state, translationCache: newCache };
    
    case 'CLEAR_TRANSLATION_CACHE':
      return { ...state, translationCache: new Map() };
    
    default:
      return state;
  }
}

// Context
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

  // Charger les données initiales depuis localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        dispatch({ type: 'SET_USER', payload: user });
      } catch (error) {
        console.error('Erreur lors du chargement de l\'utilisateur:', error);
      }
    }

    // Charger le cache de traduction
    const savedCache = localStorage.getItem('translationCache');
    if (savedCache) {
      try {
        const cacheData = JSON.parse(savedCache);
        Object.entries(cacheData).forEach(([key, value]) => {
          dispatch({ type: 'ADD_TRANSLATION_CACHE', payload: { key, value: value as string } });
        });
      } catch (error) {
        console.error('Erreur lors du chargement du cache de traduction:', error);
      }
    }
  }, []);

  // Sauvegarder l'utilisateur dans localStorage
  useEffect(() => {
    if (state.user) {
      localStorage.setItem('user', JSON.stringify(state.user));
    } else {
      localStorage.removeItem('user');
    }
  }, [state.user]);

  // Sauvegarder le cache de traduction
  useEffect(() => {
    const cacheObj = Object.fromEntries(state.translationCache);
    localStorage.setItem('translationCache', JSON.stringify(cacheObj));
  }, [state.translationCache]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook pour utiliser le contexte
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext doit être utilisé dans un AppProvider');
  }
  return context;
}

// Hooks spécialisés pour faciliter l'utilisation
export function useUser() {
  const { state, dispatch } = useAppContext();
  
  const setUser = (user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    // Redirection sera gérée par le composant appelant
  };

  return { user: state.user, setUser, logout };
}

export function useConversations() {
  const { state, dispatch } = useAppContext();
  
  const setConversations = (conversations: Conversation[]) => {
    dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
  };

  const addConversation = (conversation: Conversation) => {
    dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
  };

  const updateConversation = (conversation: Conversation) => {
    dispatch({ type: 'UPDATE_CONVERSATION', payload: conversation });
  };

  const removeConversation = (id: string) => {
    dispatch({ type: 'REMOVE_CONVERSATION', payload: id });
  };

  return {
    conversations: state.conversations,
    setConversations,
    addConversation,
    updateConversation,
    removeConversation,
  };
}

export function useNotifications() {
  const { state, dispatch } = useAppContext();
  
  const setNotifications = (notifications: Notification[]) => {
    dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
  };

  const addNotification = (notification: Notification) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  };

  const removeNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  return {
    notifications: state.notifications,
    setNotifications,
    addNotification,
    removeNotification,
  };
}

export function useTranslationCache() {
  const { state, dispatch } = useAppContext();
  
  const addToCache = (key: string, value: string) => {
    dispatch({ type: 'ADD_TRANSLATION_CACHE', payload: { key, value } });
  };

  const clearCache = () => {
    dispatch({ type: 'CLEAR_TRANSLATION_CACHE' });
  };

  const getFromCache = (key: string): string | undefined => {
    return state.translationCache.get(key);
  };

  return {
    translationCache: state.translationCache,
    addToCache,
    clearCache,
    getFromCache,
  };
}
