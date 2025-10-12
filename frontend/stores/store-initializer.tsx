/**
 * Store Initializer - Initializes all Zustand stores on app startup
 */

'use client';

import { useEffect, ReactNode } from 'react';
import { useAppStore } from './app-store';
import { useAuthStore } from './auth-store';
import { useLanguageStore } from './language-store';

interface StoreInitializerProps {
  children: ReactNode;
}

export function StoreInitializer({ children }: StoreInitializerProps) {
  const initializeApp = useAppStore((state) => state.initialize);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const detectBrowserLanguage = useLanguageStore((state) => state.detectAndSetBrowserLanguage);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const initializeStores = async () => {
      try {
        console.log('[STORE_INITIALIZER] Initializing all stores...');
        
        // Initialize app and auth in parallel
        await Promise.all([
          initializeApp(),
          initializeAuth(),
        ]);
        
        // Initialize language after auth (user preferences might affect language)
        if (user?.systemLanguage) {
          useLanguageStore.getState().setInterfaceLanguage(user.systemLanguage);
        } else {
          detectBrowserLanguage();
        }
        
        console.log('[STORE_INITIALIZER] All stores initialized successfully');
        
      } catch (error) {
        console.error('[STORE_INITIALIZER] Store initialization failed:', error);
        useAppStore.getState().addNotification({
          type: 'error',
          title: 'Initialization Error',
          message: 'Failed to initialize application stores',
        });
      }
    };
    
    initializeStores();
  }, []); // Empty dependency array - run once on mount
  
  return <>{children}</>;
}
