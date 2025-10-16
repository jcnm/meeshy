'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/types';
import { 
  AuthState, 
  checkAuthStatus, 
  clearAllAuthData, 
  canAccessProtectedRoute,
  canAccessSharedConversation,
  redirectToAuth,
  redirectToHome
} from '@/utils/auth';
import { useUser, useAuthActions, useIsAuthChecking } from '@/stores';

// Fonction helper pour les logs de développement
const devLog = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(message, ...args);
  }
};

// Cache global pour éviter les vérifications d'authentification multiples
const authCache = {
  lastCheck: 0,
  cacheDuration: 5000, // 5 secondes
  result: null as AuthState | null
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isChecking: true,
    isAnonymous: false
  });
  
  const router = useRouter();
  const pathname = usePathname();
  const { setUser } = useAuthActions();
  const isAuthChecking = useIsAuthChecking();
  const hasInitialized = useRef(false);
  const setUserRef = useRef(setUser);
  const redirectInProgress = useRef(false);

  // Keep setUser ref updated
  useEffect(() => {
    setUserRef.current = setUser;
  }, [setUser]);

  // Vérifier l'état d'authentification avec cache
  const checkAuth = useCallback(async () => {
    const now = Date.now();
    
    // Utiliser le cache si récent
    if (authCache.result && (now - authCache.lastCheck) < authCache.cacheDuration) {
      if (process.env.NODE_ENV === 'development') {
        devLog('[USE_AUTH] Utilisation du cache d\'authentification');
      }
      setAuthState(authCache.result);
      
      // Synchroniser avec le contexte global
      if (authCache.result.isAuthenticated && authCache.result.user) {
        setUserRef.current(authCache.result.user);
      } else {
        setUserRef.current(null);
      }
      
      return authCache.result;
    }
    
    if (process.env.NODE_ENV === 'development') {
      devLog('[USE_AUTH] Début de la vérification d\'authentification');
    }
    setAuthState(prev => ({ ...prev, isChecking: true }));
    
    try {
      const newAuthState = await checkAuthStatus();
      
      if (process.env.NODE_ENV === 'development') {
        devLog('[USE_AUTH] État d\'authentification:', newAuthState);
      }
      
      // Mettre à jour le cache
      authCache.result = newAuthState;
      authCache.lastCheck = now;
      
      // Synchroniser avec le contexte global
      if (newAuthState.isAuthenticated && newAuthState.user) {
        setUserRef.current(newAuthState.user);
      } else {
        setUserRef.current(null);
      }
      
      setAuthState(newAuthState);
      return newAuthState;
    } catch (error) {
      console.error('[USE_AUTH] Erreur lors de la vérification d\'authentification:', error);
      const errorState: AuthState = {
        isAuthenticated: false,
        user: null,
        token: null,
        isChecking: false,
        isAnonymous: false
      };
      
      // Mettre à jour le cache avec l'état d'erreur
      authCache.result = errorState;
      authCache.lastCheck = now;
      
      setAuthState(errorState);
      setUserRef.current(null);
      return errorState;
    }
  }, []);

  // Initialiser l'authentification au chargement (une seule fois)
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;
    checkAuth();
  }, []);

  // Gestion des redirections unifiée et simplifiée
  useEffect(() => {
    // Éviter les redirections multiples
    if (redirectInProgress.current) {
      return;
    }

    // Ne pas faire de vérifications si l'authentification est en cours
    if (authState.isChecking || isAuthChecking) {
      devLog('[USE_AUTH] Vérification en cours, pas de redirection');
      return;
    }

    devLog('[USE_AUTH] Vérification route:', pathname, 'Auth state:', {
      isAuthenticated: authState.isAuthenticated,
      hasUser: !!authState.user,
      isChecking: authState.isChecking
    });

    // Routes publiques (pas de vérification nécessaire)
    const publicRoutes = ['/', '/login', '/signin', '/register', '/partners', '/privacy', '/contact', '/about', '/terms'];
    const isPublicRoute = publicRoutes.includes(pathname);
    
    // Routes de jointure (accessibles sans authentification)
    const isJoinRoute = pathname.startsWith('/join/');
    
    // Routes de chat partagé (nécessitent une session active)
    const isSharedChatRoute = pathname.startsWith('/chat/');
    
    if (isPublicRoute) {
      // Route publique, pas de vérification
      devLog('[USE_AUTH] Route publique, pas de redirection automatique');
      return;
    }
    
    if (isJoinRoute) {
      // Route de jointure, accessible à tous
      return;
    }
    
    if (isSharedChatRoute) {
      // Route de chat partagé, nécessite une session active
      // Vérifier si l'utilisateur vient juste de se connecter en anonyme
      const justJoined = localStorage.getItem('anonymous_just_joined');
      if (justJoined) {
        devLog('[USE_AUTH] Utilisateur vient de se connecter en anonyme, pas de redirection');
        return;
      }
      
      // Validation améliorée pour les sessions anonymes
      if (authState.isAnonymous) {
        const sessionToken = localStorage.getItem('anonymous_session_token');
        const participant = localStorage.getItem('anonymous_participant');
        
        if (!sessionToken || !participant) {
          devLog('[USE_AUTH] Session anonyme incomplète, redirection vers join');
          const storedLinkId = localStorage.getItem('anonymous_current_link_id');
          if (storedLinkId) {
            redirectInProgress.current = true;
            router.push(`/join/${storedLinkId}`);
          } else {
            redirectInProgress.current = true;
            redirectToHome();
          }
          return;
        }
        
        // Vérifier que les données du participant sont valides
        try {
          const participantData = JSON.parse(participant);
          if (!participantData.id || !participantData.username) {
            devLog('[USE_AUTH] Données participant invalides, redirection vers join');
            const storedLinkId = localStorage.getItem('anonymous_current_link_id');
            if (storedLinkId) {
              redirectInProgress.current = true;
              router.push(`/join/${storedLinkId}`);
            } else {
              redirectInProgress.current = true;
              redirectToHome();
            }
            return;
          }
        } catch (e) {
          console.error('[USE_AUTH] Erreur parsing participant:', e);
          const storedLinkId = localStorage.getItem('anonymous_current_link_id');
          if (storedLinkId) {
            redirectInProgress.current = true;
            router.push(`/join/${storedLinkId}`);
          } else {
            redirectInProgress.current = true;
            redirectToHome();
          }
          return;
        }
      }
      
      if (!canAccessSharedConversation(authState)) {
        // Pour les routes de chat partagé, nous devons utiliser le linkId original stocké
        const storedLinkId = localStorage.getItem('anonymous_current_link_id');
        
        if (storedLinkId) {
          devLog('[USE_AUTH] Redirection vers join avec linkId original:', storedLinkId);
          redirectInProgress.current = true;
          router.push(`/join/${storedLinkId}`);
        } else {
          devLog('[USE_AUTH] Pas de linkId original stocké, redirection vers home');
          redirectInProgress.current = true;
          redirectToHome();
        }
        return;
      }
    }
    
    // Routes protégées (nécessitent une authentification complète)
    if (!canAccessProtectedRoute(authState)) {
      // Nettoyer les données d'authentification invalides avant la redirection
      if (authState.token && !authState.isAuthenticated) {
        devLog('[USE_AUTH] Nettoyage des données d\'authentification invalides');
        clearAllAuthData();
        // Mettre à jour l'état pour refléter le nettoyage
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          isChecking: false,
          isAnonymous: false
        });
        setUserRef.current(null);
      }
      
      // Éviter la redirection si on est déjà sur /login
      if (pathname === '/login') {
        devLog('[USE_AUTH] Déjà sur /login, pas de redirection');
        return;
      }
      
      // Sauvegarder l'URL actuelle pour redirection après connexion
      const returnUrl = pathname !== '/' ? pathname : undefined;
      const loginUrl = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login';
      devLog('[USE_AUTH] Redirection vers login car non authentifié. Auth state:', authState);
      redirectInProgress.current = true;
      router.push(loginUrl);
      return;
    }
    
    devLog('[USE_AUTH] Route autorisée:', pathname);
  }, [authState.isAuthenticated, authState.isChecking, pathname, isAuthChecking]);

  // Se connecter
  const login = useCallback((user: User, token: string) => {
    devLog('[USE_AUTH] Connexion utilisateur:', user.username);
    
    // Stocker immédiatement dans localStorage
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // Mettre à jour l'état immédiatement de manière synchrone
    const newAuthState = {
      isAuthenticated: true,
      user,
      token,
      isChecking: false,
      isAnonymous: false
    };
    
    // Force immediate state update
    setAuthState(newAuthState);
    setUserRef.current(user);
    
    devLog('[USE_AUTH] État mis à jour immédiatement:', newAuthState);
  }, []);

  // Se déconnecter
  const logout = useCallback(() => {
    devLog('[USE_AUTH] Déconnexion utilisateur');
    
    clearAllAuthData();
    const newAuthState = {
      isAuthenticated: false,
      user: null,
      token: null,
      isChecking: false,
      isAnonymous: false
    };
    
    setAuthState(newAuthState);
    setUserRef.current(null);
    router.push('/');
  }, [router]);

  // Rejoindre une conversation anonymement
  const joinAnonymously = useCallback((participant: any, sessionToken: string, conversationShareLinkId?: string) => {
    devLog('[USE_AUTH] Création de session anonyme:', {
      participantId: participant.id,
      username: participant.username,
      conversationShareLinkId,
      sessionTokenLength: sessionToken.length
    });
    
    localStorage.setItem('anonymous_session_token', sessionToken);
    localStorage.setItem('anonymous_participant', JSON.stringify(participant));
    
    // Stocker conversationShareLinkId si fourni (correspond au champ 'id' de la réponse)
    if (conversationShareLinkId) {
      localStorage.setItem('anonymous_current_share_link', conversationShareLinkId);
    }
    
    // Marquer une connexion anonyme récente pour éviter les redirections intempestives
    localStorage.setItem('anonymous_just_joined', 'true');
    setTimeout(() => {
      localStorage.removeItem('anonymous_just_joined');
    }, 3000); // Augmenter à 3 secondes pour plus de stabilité
    
    const newAuthState = {
      isAuthenticated: true,
      user: participant,
      token: sessionToken,
      isChecking: false,
      isAnonymous: true
    };
    
    setAuthState(newAuthState);
    setUserRef.current(participant);
    
    devLog('[USE_AUTH] Session anonyme créée avec succès');
  }, []);

  // Quitter une session anonyme
  const leaveAnonymousSession = useCallback(() => {
    localStorage.removeItem('anonymous_session_token');
    localStorage.removeItem('anonymous_participant');
    localStorage.removeItem('anonymous_current_share_link');
    
    const newAuthState = {
      isAuthenticated: false,
      user: null,
      token: null,
      isChecking: false,
      isAnonymous: false
    };
    
    setAuthState(newAuthState);
    setUserRef.current(null);
  }, []);

  // Rafraîchir l'état d'authentification
  const refreshAuth = useCallback(async () => {
    return await checkAuth();
  }, [checkAuth]);

  // Forcer le nettoyage des données d'authentification invalides
  const forceLogout = useCallback(() => {
    devLog('[USE_AUTH] Nettoyage forcé des données d\'authentification');
    clearAllAuthData();
    const newAuthState = {
      isAuthenticated: false,
      user: null,
      token: null,
      isChecking: false,
      isAnonymous: false
    };
    setAuthState(newAuthState);
    setUserRef.current(null);
  }, []);

  return {
    // État
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    token: authState.token,
    isChecking: authState.isChecking || isAuthChecking,
    isAnonymous: authState.isAnonymous,
    
    // Méthodes
    login,
    logout,
    joinAnonymously,
    leaveAnonymousSession,
    refreshAuth,
    checkAuth,
    forceLogout
  };
}
