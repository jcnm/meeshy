import { SocketIOUser } from '@/types';
import { UserRoleEnum } from '../shared/types';

// Interface pour les utilisateurs de test
export interface TestUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  role: UserRoleEnum;
}

// Interface pour la réponse d'authentification
export interface AuthResponse {
  success: boolean;
  data?: {
    user: SocketIOUser;
    token: string;
    expiresIn: number;
  };
  error?: string;
}

// Interface pour les permissions utilisateur
export interface UserPermissions {
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canManageGroups: boolean;
  canManageConversations: boolean;
  canViewAnalytics: boolean;
  canModerateContent: boolean;
  canViewAuditLogs: boolean;
  canManageNotifications: boolean;
  canManageTranslations: boolean;
}

// Interface pour la réponse du profil utilisateur
export interface UserProfileResponse {
  success: boolean;
  data?: {
    user: TestUser;
    permissions: UserPermissions;
  };
  error?: string;
}

class AuthService {
  private static instance: AuthService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://meeshy.me';
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Authentifie un utilisateur avec username/password
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        // Stocker le token et les informations utilisateur
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.data.token);
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return {
        success: false,
        error: 'Erreur de connexion au serveur'
      };
    }
  }

  /**
   * Déconnecte l'utilisateur
   */
  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      // Nettoyer le localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }
  }

  /**
   * Récupère les informations de l'utilisateur connecté
   */
  async getCurrentUser(): Promise<UserProfileResponse> {
    try {
      const token = this.getToken();
      if (!token) {
        return {
          success: false,
          error: 'Aucun token d\'authentification'
        };
      }

      const response = await fetch(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.data?.user) {
        // Mettre à jour les informations utilisateur en cache
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      return {
        success: false,
        error: 'Erreur de connexion au serveur'
      };
    }
  }

  /**
   * Rafraîchit le token d'authentification
   */
  async refreshToken(): Promise<AuthResponse> {
    try {
      const token = this.getToken();
      if (!token) {
        return {
          success: false,
          error: 'Aucun token à rafraîchir'
        };
      }

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        // Mettre à jour le token
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.data.token);
        }
      }

      return data;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      return {
        success: false,
        error: 'Erreur de connexion au serveur'
      };
    }
  }

  /**
   * Récupère la liste des utilisateurs de test
   */
  async getTestUsers(): Promise<{ success: boolean; data?: { users: TestUser[]; total: number }; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/test-users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs de test:', error);
      return {
        success: false,
        error: 'Erreur de connexion au serveur'
      };
    }
  }

  /**
   * Récupère le token d'authentification depuis le localStorage
   */
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  /**
   * Récupère l'utilisateur connecté depuis le localStorage
   */
  getStoredUser(): TestUser | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch (error) {
          console.error('Erreur lors du parsing de l\'utilisateur:', error);
        }
      }
    }
    return null;
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Vérifie si le token est expiré (approximatif)
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      // Décoder le token (base64)
      const payload = JSON.parse(atob(token));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < now;
    } catch (error) {
      console.error('Erreur lors de la vérification du token:', error);
      return true;
    }
  }
}

// Export de l'instance singleton
export const authService = AuthService.getInstance();
