import { apiService, ApiResponse } from './api.service';
import { User } from '@/types';
import { getDefaultPermissions } from '@/utils/user-adapter';
// Importer les types partagés pour cohérence
import type { UpdateUserRequest, UpdateUserResponse } from '../shared/types';

export interface UserStats {
  messagesSent: number;
  messagesReceived: number;
  conversationsCount: number;
  groupsCount: number;
  totalConversations: number;
  averageResponseTime?: number;
  lastActivity: Date;
}

// Utiliser le type partagé pour cohérence, avec extension pour l'avatar
export interface UpdateUserDto extends UpdateUserRequest {
  avatar?: string;
}

export interface SearchUsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Service pour gérer les utilisateurs
 */
export const usersService = {
  /**
   * Récupère la liste de tous les utilisateurs
   */
  async getAllUsers(): Promise<ApiResponse<User[]>> {
    try {
      const response = await apiService.get<User[]>('/users');
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      throw error;
    }
  },

  /**
   * Recherche des utilisateurs
   */
  async searchUsers(query: string): Promise<ApiResponse<User[]>> {
    try {
      const response = await apiService.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
      throw error;
    }
  },

  /**
   * Récupère mon profil
   */
  async getMyProfile(): Promise<ApiResponse<User>> {
    try {
      const response = await apiService.get<{ user: User }>('/auth/me');
      
      // Extraire l'utilisateur de la réponse /auth/me
      const userData = response.data?.user || response.data;
      
      // S'assurer que les permissions sont définies
      if (userData && !userData.permissions) {
        userData.permissions = getDefaultPermissions(userData.role);
      }
      
      return {
        ...response,
        data: userData
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      throw error;
    }
  },

  /**
   * Met à jour mon profil
   */
  async updateMyProfile(updateData: UpdateUserDto): Promise<ApiResponse<User>> {
    try {
      const response = await apiService.patch<User>('/users/me', updateData);
      return response;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  },

  /**
   * Récupère mes statistiques
   */
  async getMyStats(): Promise<ApiResponse<UserStats>> {
    try {
      const response = await apiService.get<UserStats>('/users/me/stats');
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  },

  /**
   * Récupère les statistiques du dashboard
   */
  async getDashboardStats(): Promise<ApiResponse<{
    stats: {
      totalConversations: number;
      totalCommunities: number;
      totalMessages: number;
      activeConversations: number;
      translationsToday: number;
      totalLinks: number;
      lastUpdated: Date;
    };
    recentConversations: any[];
    recentCommunities: any[];
  }>> {
    try {
      const response = await apiService.get('/users/me/dashboard-stats');
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques du dashboard:', error);
      throw error;
    }
  },

  /**
   * Récupère le profil d'un utilisateur
   */
  async getUserProfile(userId: string): Promise<ApiResponse<User>> {
    try {
      const response = await apiService.get<{ success: boolean; data: User }>(`/users/${userId}`);
      if (!response.data.success || !response.data.data) {
        throw new Error('User not found');
      }
      return {
        data: response.data.data,
        status: response.status,
        message: response.message
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du profil utilisateur:', error);
      throw error;
    }
  },

  /**
   * Récupère les statistiques d'un utilisateur
   */
  async getUserStats(userId: string): Promise<ApiResponse<UserStats>> {
    try {
      const response = await apiService.get<{ success: boolean; data: UserStats }>(`/users/${userId}/stats`);
      if (!response.data.success || !response.data.data) {
        throw new Error('Stats not found');
      }
      return {
        data: response.data.data,
        status: response.status,
        message: response.message
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques utilisateur:', error);
      throw error;
    }
  },

  /**
   * Vérifie si un utilisateur est en ligne
   * Basé sur lastActiveAt pour refléter l'activité réelle
   * Un utilisateur est considéré en ligne s'il a été actif dans les 5 dernières minutes
   */
  isUserOnline(user: User): boolean {
    // Si le flag isOnline est false, l'utilisateur est définitivement hors ligne
    if (!user.isOnline) {
      return false;
    }

    // Vérifier l'activité récente via lastActiveAt
    const lastActive = new Date(user.lastActiveAt || user.lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    // Considérer en ligne si activité dans les 5 dernières minutes
    return diffMinutes < 5;
  },

  /**
   * Calcule le statut détaillé de l'utilisateur
   * @returns 'online' | 'away' | 'offline'
   */
  getUserStatus(user: User): 'online' | 'away' | 'offline' {
    if (!user.isOnline) {
      return 'offline';
    }

    const lastActive = new Date(user.lastActiveAt || user.lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    // En ligne : activité < 5 minutes
    if (diffMinutes < 5) {
      return 'online';
    }

    // Absent/Inactif : 5 min < activité < 30 min
    if (diffMinutes < 30) {
      return 'away';
    }

    // Hors ligne : activité > 30 minutes
    return 'offline';
  },

  /**
   * Formate le nom d'affichage d'un utilisateur
   */
  getDisplayName(user: User): string {
    if (user.displayName) {
      return user.displayName;
    }
    return `${user.firstName} ${user.lastName}`.trim() || user.username;
  },

  /**
   * Formate la dernière connexion
   */
  getLastSeenFormatted(user: User): string {
    if (user.isOnline) {
      return 'En ligne';
    }
    
    const lastSeen = new Date(user.lastSeen || user.lastActiveAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'À l\'instant';
    } else if (diffMinutes < 60) {
      return `Il y a ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `Il y a ${diffHours}h`;
    } else if (diffDays < 7) {
      return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else {
      return lastSeen.toLocaleDateString('fr-FR');
    }
  },

  /**
   * Obtient l'avatar par défaut pour un utilisateur
   */
  getDefaultAvatar(user: User): string {
    const initials = this.getDisplayName(user)
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    // Couleur basée sur l'ID utilisateur pour cohérence
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const colorIndex = user.id.charCodeAt(0) % colors.length;
    
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" fill="#${colors[colorIndex].replace('bg-', '').replace('-500', '')}" rx="20"/>
        <text x="20" y="26" text-anchor="middle" fill="white" font-family="sans-serif" font-size="14" font-weight="600">
          ${initials}
        </text>
      </svg>
    `)}`;
  },
};

export default usersService;
