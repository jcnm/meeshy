'use client';

import React, { useEffect } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuth } from '@/hooks/use-auth';

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const { isConnected } = useNotifications();

  // Le hook useNotifications gère déjà l'initialisation automatique
  // Ce composant peut être utilisé pour des actions supplémentaires si nécessaire

  useEffect(() => {
    if (isAuthenticated && user && isConnected) {
      console.log('🔔 Système de notifications initialisé pour:', user.username);
    }
  }, [isAuthenticated, user, isConnected]);

  return <>{children}</>;
}