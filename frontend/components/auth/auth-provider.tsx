'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  
  // Ne pas initialiser useAuth sur les pages d'authentification
  // pour éviter les redirections automatiques
  const isAuthPage = pathname === '/login' || pathname === '/signin' || pathname === '/register' || pathname === '/signup';
  
  // Toujours appeler useAuth pour respecter les règles des Hooks
  // mais on peut ignorer ses effets sur les pages d'auth
  useAuth();
  
  // Le provider ne fait que rendre les enfants
  // La logique d'authentification est gérée par le hook useAuth
  return <>{children}</>;
}
