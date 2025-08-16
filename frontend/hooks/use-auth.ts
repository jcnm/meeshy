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
import { useUser } from '@/context/AppContext';

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
  const { setUser, isAuthChecking } = useUser();
  const hasInitialized = useRef(false);
  const setUserRef = useRef(setUser);

  // Keep setUser ref updated
  useEffect(() => {
    setUserRef.current = setUser;
  }, [setUser]);

  // Vérifier l'état d'authentification
  const checkAuth = useCallback(async () => {
    console.log('[USE_AUTH] Début de la vérification d\'authentification');
    setAuthState(prev => ({ ...prev, isChecking: true }));
    
    try {
      const newAuthState = await checkAuthStatus();
      console.log('[USE_AUTH] État d\'authentification:', newAuthState);
      
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
      setAuthState(errorState);
      setUserRef.current(null);
      return errorState;
    }
  }, []); // Empty dependency array

  // Initialiser l'authentification au chargement
  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;
    checkAuth();
  }, []); // Empty dependency array to run only once

  // Vérifier l'accès aux routes protégées
  useEffect(() => {
    if (!authState.isChecking && !isAuthChecking) {
      // Routes publiques (pas de vérification nécessaire)
      const publicRoutes = ['/', '/login', '/register'];
      const isPublicRoute = publicRoutes.includes(pathname);
      
      // Routes de jointure (accessibles sans authentification)
      const isJoinRoute = pathname.startsWith('/join/');
      
      // Routes de chat partagé (nécessitent une session active)
      const isSharedChatRoute = pathname.startsWith('/chat/');
      
      if (isPublicRoute) {
        // Route publique, pas de vérification
        // Mais si l'utilisateur est authentifié sur /login, le laisser gérer sa propre redirection
        if (pathname === '/login' && authState.isAuthenticated) {
          console.log('[USE_AUTH] Utilisateur authentifié sur /login, laisser la page gérer la redirection');
          return;
        }
        return;
      }
      
      if (isJoinRoute) {
        // Route de jointure, accessible à tous
        return;
      }
      
      if (isSharedChatRoute) {
        // Route de chat partagé, nécessite une session active
        if (!canAccessSharedConversation(authState)) {
          // Extraire le linkId de l'URL pour rediriger vers la page de jointure
          const linkId = pathname.split('/')[2];
          if (linkId) {
            router.push(`/join/${linkId}`);
          } else {
            redirectToHome();
          }
          return;
        }
      }
      
      // Routes protégées (nécessitent une authentification complète)
      if (!canAccessProtectedRoute(authState)) {
        // Sauvegarder l'URL actuelle pour redirection après connexion
        const returnUrl = pathname !== '/' ? pathname : undefined;
        const loginUrl = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login';
        console.log('[USE_AUTH] Redirection vers login car non authentifié');
        router.push(loginUrl);
        return;
      }
    }
  }, [authState, pathname, router, isAuthChecking]);

  // Se connecter
  const login = useCallback((user: User, token: string) => {
    console.log('[USE_AUTH] Connexion utilisateur:', user.username);
    
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    const newAuthState = {
      isAuthenticated: true,
      user,
      token,
      isChecking: false,
      isAnonymous: false
    };
    
    setAuthState(newAuthState);
    setUserRef.current(user);
  }, []); // Use ref instead of dependency

  // Se déconnecter
  const logout = useCallback(() => {
    console.log('[USE_AUTH] Déconnexion utilisateur');
    
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
  }, [router]); // Only router dependency

  // Rejoindre une conversation anonymement
  const joinAnonymously = useCallback((participant: any, sessionToken: string) => {
    localStorage.setItem('anonymous_session_token', sessionToken);
    localStorage.setItem('anonymous_participant', JSON.stringify(participant));
    
    const newAuthState = {
      isAuthenticated: true,
      user: participant,
      token: sessionToken,
      isChecking: false,
      isAnonymous: true
    };
    
    setAuthState(newAuthState);
    setUserRef.current(participant);
  }, []); // Use ref instead of dependency

  // Quitter une session anonyme
  const leaveAnonymousSession = useCallback(() => {
    localStorage.removeItem('anonymous_session_token');
    localStorage.removeItem('anonymous_participant');
    
    const newAuthState = {
      isAuthenticated: false,
      user: null,
      token: null,
      isChecking: false,
      isAnonymous: false
    };
    
    setAuthState(newAuthState);
    setUserRef.current(null);
  }, []); // Use ref instead of dependency

  // Rafraîchir l'état d'authentification
  const refreshAuth = useCallback(async () => {
    return await checkAuth();
  }, [checkAuth]);

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
    checkAuth
  };
}
