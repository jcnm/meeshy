'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { LoadingState } from '@/components/common';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

export function ProtectedRoute({ 
  children, 
  redirectTo = '/login', 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { user, isAuthChecking } = useUser();
  const router = useRouter();
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Timeout de sécurité pour éviter le blocage infini
  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 3000); // 3 secondes maximum pour être plus rapide

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Ne faire des redirections que si la vérification d'auth est terminée OU si le timeout est atteint
    if (isAuthChecking && !timeoutReached) {
      return;
    }
    
    const token = localStorage.getItem('auth_token');
    
    if (requireAuth && !user && !token) {
      router.push(redirectTo);
      return;
    }

    if (!requireAuth && user && token) {
      router.push('/conversations');
      return;
    }
  }, [user?.id, isAuthChecking, timeoutReached, router, redirectTo, requireAuth]);

  // Afficher un état de chargement pendant la vérification d'authentification
  if (isAuthChecking && !timeoutReached) {
    return <LoadingState message="Vérification de l'authentification..." fullScreen />;
  }

  // Afficher un état de chargement si l'auth est requise mais l'utilisateur n'est pas encore chargé
  // ET qu'il n'y a pas de token (sinon l'utilisateur devrait être chargé depuis l'API)
  const token = localStorage.getItem('auth_token');
  if (requireAuth && !user && !token) {
    return <LoadingState message="Vérification de l'authentification..." fullScreen />;
  }

  if (!requireAuth && user) {
    return <LoadingState message="Redirection..." fullScreen />;
  }

  return <>{children}</>;
}
