'use client';

import { ReactNode, useEffect } from 'react';
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
  redirectTo = '/', 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('auth_token'); // Utiliser auth_token comme les autres composants
    
    if (requireAuth && !user && !token) {
      router.push(redirectTo);
      return;
    }

    if (!requireAuth && user && token) {
      router.push('/dashboard');
      return;
    }
  }, [user, router, redirectTo, requireAuth]);

  // Afficher un état de chargement pendant la vérification
  if (requireAuth && !user) {
    return <LoadingState message="Vérification de l'authentification..." fullScreen />;
  }

  if (!requireAuth && user) {
    return <LoadingState message="Redirection..." fullScreen />;
  }

  return <>{children}</>;
}
