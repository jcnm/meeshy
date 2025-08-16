import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './use-auth';

interface UseAuthGuardOptions {
  redirectTo?: string;
  requireAuth?: boolean;
  onAuthSuccess?: () => void;
  onAuthFailure?: () => void;
}

export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const {
    redirectTo = '/login',
    requireAuth = true,
    onAuthSuccess,
    onAuthFailure
  } = options;

  const router = useRouter();
  const { isAuthenticated, isChecking, user } = useAuth();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Attendre que la vérification d'authentification soit terminée
    if (!isChecking && !hasChecked) {
      console.log('[AUTH_GUARD] Vérification terminée:', { isAuthenticated, requireAuth });
      
      if (requireAuth && !isAuthenticated) {
        console.log('[AUTH_GUARD] Redirection vers', redirectTo);
        router.push(redirectTo);
        onAuthFailure?.();
      } else if (requireAuth && isAuthenticated) {
        console.log('[AUTH_GUARD] Utilisateur authentifié:', user?.username);
        onAuthSuccess?.();
      }
      
      setHasChecked(true);
    }
  }, [isAuthenticated, isChecking, requireAuth, redirectTo, router, onAuthSuccess, onAuthFailure, hasChecked, user]);

  return {
    isChecking: isChecking || !hasChecked,
    isAuthenticated,
    checkAuth: () => {
      // La vérification est gérée par useAuth
      setHasChecked(false);
    }
  };
}
