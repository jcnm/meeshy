import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildApiUrl } from '@/lib/runtime-urls';
import { toast } from 'sonner';

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
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          if (requireAuth) {
            console.log('[AUTH_GUARD] Pas de token, redirection vers', redirectTo);
            router.push(redirectTo);
            onAuthFailure?.();
          }
          setIsAuthenticated(false);
          return;
        }

        const response = await fetch(buildApiUrl('/auth/me'), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          setIsAuthenticated(true);
          onAuthSuccess?.();
        } else {
          // Token invalide, nettoyer les données
          console.log('[AUTH_GUARD] Token invalide, nettoyage');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          
          if (requireAuth) {
            toast.error('Session expirée, veuillez vous reconnecter');
            router.push(redirectTo);
            onAuthFailure?.();
          }
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('[AUTH_GUARD] Erreur vérification auth:', error);
        
        // En cas d'erreur réseau, nettoyer aussi
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        
        if (requireAuth) {
          toast.error('Erreur de connexion');
          router.push(redirectTo);
          onAuthFailure?.();
        }
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router, redirectTo, requireAuth, onAuthSuccess, onAuthFailure]);

  return {
    isChecking,
    isAuthenticated,
    checkAuth: () => {
      setIsChecking(true);
      // Re-déclencher la vérification
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }
      
      fetch(buildApiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      }).then(response => {
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setIsAuthenticated(false);
        }
      }).catch(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }).finally(() => {
        setIsChecking(false);
      });
    }
  };
}
