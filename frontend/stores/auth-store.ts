/**
 * Auth Store - Pure Zustand implementation with automatic persistence
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User } from '@shared/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  authToken: string | null;
  refreshToken: string | null;
  sessionExpiry: Date | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setAuthChecking: (checking: boolean) => void;
  setTokens: (authToken: string, refreshToken?: string, expiresIn?: number) => void;
  clearAuth: () => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isAuthChecking: true,
  authToken: null,
  refreshToken: null,
  sessionExpiry: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user: User | null) => {
          set({
            user,
            isAuthenticated: !!user,
            isAuthChecking: false,
          });
        },

        setAuthChecking: (checking: boolean) => {
          set({ isAuthChecking: checking });
        },

        setTokens: (authToken: string, refreshToken?: string, expiresIn?: number) => {
          const sessionExpiry = expiresIn 
            ? new Date(Date.now() + expiresIn * 1000)
            : null;

          set({
            authToken,
            refreshToken: refreshToken || get().refreshToken,
            sessionExpiry,
          });
        },

        clearAuth: () => {
          set({
            user: null,
            isAuthenticated: false,
            authToken: null,
            refreshToken: null,
            sessionExpiry: null,
            isAuthChecking: false,
          });
        },

        logout: () => {
          console.log('[AUTH_STORE] Logging out user');
          get().clearAuth();
          
          // Redirect to home page
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        },

        refreshSession: async (): Promise<boolean> => {
          const { refreshToken, authToken } = get();
          
          if (!refreshToken && !authToken) {
            return false;
          }

          try {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
              },
              body: JSON.stringify({ refreshToken }),
            });

            if (response.ok) {
              const data = await response.json();
              get().setTokens(data.accessToken, data.refreshToken, data.expiresIn);
              return true;
            }

            return false;
          } catch (error) {
            console.error('[AUTH_STORE] Session refresh failed:', error);
            return false;
          }
        },

        initializeAuth: async () => {
          set({ isAuthChecking: true });

          try {
            const { authToken, refreshToken, sessionExpiry, user } = get();

            console.log('[AUTH_STORE] Initializing - Token:', !!authToken, 'User:', !!user);

            if (authToken && user) {
              // Check if session is expired
              if (sessionExpiry && sessionExpiry < new Date()) {
                console.log('[AUTH_STORE] Session expired, attempting refresh');
                
                const refreshed = await get().refreshSession();
                if (!refreshed) {
                  console.log('[AUTH_STORE] Refresh failed, clearing auth');
                  get().clearAuth();
                  return;
                }
              }

              console.log('[AUTH_STORE] User authenticated:', user.username);
              set({ isAuthenticated: true });
            } else {
              console.log('[AUTH_STORE] No authentication data found');
              set({ isAuthenticated: false });
            }
          } catch (error) {
            console.error('[AUTH_STORE] Initialization error:', error);
            get().clearAuth();
          } finally {
            set({ isAuthChecking: false });
          }
        },
      }),
      {
        name: 'meeshy-auth',
        partialize: (state) => ({
          user: state.user,
          authToken: state.authToken,
          refreshToken: state.refreshToken,
          sessionExpiry: state.sessionExpiry,
        }),
      }
    ),
    { name: 'AuthStore' }
  )
);

// Selector hooks for better performance
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAuthChecking = () => useAuthStore((state) => state.isAuthChecking);
export const useAuthActions = () => useAuthStore((state) => ({
  setUser: state.setUser,
  logout: state.logout,
  setTokens: state.setTokens,
  clearAuth: state.clearAuth,
}));