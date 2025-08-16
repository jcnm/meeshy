'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Initialiser le hook d'authentification
  useAuth();
  
  // Le provider ne fait que rendre les enfants
  // La logique d'authentification est gérée par le hook useAuth
  return <>{children}</>;
}
