import { User } from '@/types';
import { buildApiUrl } from '@/lib/runtime-urls';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isChecking: boolean;
  isAnonymous: boolean;
}

/**
 * Vérifie si l'utilisateur est authentifié avec un token valide
 */
export async function checkAuthStatus(): Promise<AuthState> {
  const token = localStorage.getItem('auth_token');
  const anonymousToken = localStorage.getItem('anonymous_session_token');
  
  console.log('[AUTH_UTILS] Vérification auth - Token normal:', !!token, 'Token anonyme:', !!anonymousToken);
  
  // Si on a un token d'authentification normale
  if (token) {
    try {
      console.log('[AUTH_UTILS] Appel API /auth/me avec token');
      const response = await fetch(buildApiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('[AUTH_UTILS] Réponse API:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('[AUTH_UTILS] Données reçues:', result);
        
        // Gérer différents formats de réponse
        let userData;
        if (result.success && result.data?.user) {
          // Format standardisé: { success: true, data: { user: {...} } }
          userData = result.data.user;
        } else if (result.user) {
          // Format direct: { user: {...} }
          userData = result.user;
        } else if (result.id) {
          // Format utilisateur direct: { id: ..., username: ..., ... }
          userData = result;
        } else {
          console.error('[AUTH_UTILS] Format de réponse inattendu:', result);
          throw new Error('Format de réponse utilisateur invalide');
        }

        if (userData && userData.id) {
          console.log('[AUTH_UTILS] Utilisateur valide trouvé:', userData.username);
          return {
            isAuthenticated: true,
            user: userData,
            token,
            isChecking: false,
            isAnonymous: false
          };
        } else {
          throw new Error('Données utilisateur incomplètes');
        }
      }
      
      // Token invalide ou réponse incorrecte, nettoyer
      console.log('[AUTH_UTILS] Token invalide, nettoyage des données');
      clearAuthData();
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        isChecking: false,
        isAnonymous: false
      };
    } catch (error) {
      console.error('[AUTH_UTILS] Erreur vérification auth:', error);
      clearAuthData();
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        isChecking: false,
        isAnonymous: false
      };
    }
  }
  
  // Si on a un token anonyme
  if (anonymousToken) {
    try {
      const response = await fetch(buildApiUrl('/anonymous/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionToken: anonymousToken })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return {
            isAuthenticated: true,
            user: result.data.participant,
            token: anonymousToken,
            isChecking: false,
            isAnonymous: true
          };
        }
      }
      
      // Token anonyme invalide, nettoyer
      clearAnonymousData();
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        isChecking: false,
        isAnonymous: false
      };
    } catch (error) {
      console.error('Erreur vérification session anonyme:', error);
      clearAnonymousData();
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        isChecking: false,
        isAnonymous: false
      };
    }
  }
  
  // Aucun token
  return {
    isAuthenticated: false,
    user: null,
    token: null,
    isChecking: false,
    isAnonymous: false
  };
}

/**
 * Nettoie toutes les données d'authentification
 */
export function clearAuthData(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

/**
 * Nettoie les données de session anonyme
 */
export function clearAnonymousData(): void {
  localStorage.removeItem('anonymous_session_token');
  localStorage.removeItem('anonymous_participant');
}

/**
 * Nettoie toutes les données d'authentification (normale + anonyme)
 */
export function clearAllAuthData(): void {
  clearAuthData();
  clearAnonymousData();
}

/**
 * Vérifie si l'utilisateur a accès à une route protégée
 */
export function canAccessProtectedRoute(authState: AuthState): boolean {
  return authState.isAuthenticated && !authState.isChecking;
}

/**
 * Vérifie si l'utilisateur peut accéder à une conversation partagée
 */
export function canAccessSharedConversation(authState: AuthState): boolean {
  // Pour les conversations partagées, on accepte les utilisateurs authentifiés ET les sessions anonymes
  return authState.isAuthenticated && !authState.isChecking;
}

/**
 * Redirige vers la page d'authentification appropriée
 * Note: Cette fonction est utilisée dans le hook useAuth qui gère la redirection via router
 */
export function redirectToAuth(returnUrl?: string): void {
  if (typeof window !== 'undefined') {
    const url = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login';
    window.location.href = url;
  }
}

/**
 * Redirige vers la page d'accueil
 */
export function redirectToHome(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}
