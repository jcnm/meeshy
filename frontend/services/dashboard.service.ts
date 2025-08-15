import { apiService, ApiResponse } from './api.service';
import type { User, Conversation } from '@/types';

export interface DashboardStats {
  totalConversations: number;
  totalGroups: number;
  totalMessages: number;
  activeConversations: number;
  translationsToday: number;
  totalLinks: number;
  lastUpdated: Date;
}

export interface DashboardGroup {
  id: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  members: Array<{
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  }>;
  memberCount: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentConversations: Conversation[];
  recentGroups: DashboardGroup[];
}

export interface ShareLink {
  id: string;
  linkId: string;
  name?: string;
  description?: string;
  conversationId: string;
  conversation: {
    id: string;
    type: string;
    title?: string;
    description?: string;
  };
  isActive: boolean;
  currentUses: number;
  maxUses?: number;
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * Service pour gérer les données du dashboard utilisateur
 */
export const dashboardService = {
  /**
   * Récupère les statistiques et données du dashboard pour l'utilisateur connecté
   */
  async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    try {
      const response = await apiService.get<{ success: boolean; data: DashboardData }>('/users/me/dashboard-stats');
      // Retourner directement les données du dashboard
      return {
        data: response.data.data,
        status: response.status,
        message: response.message
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des données du dashboard:', error);
      throw error;
    }
  },

  /**
   * Récupère les liens de partage créés par l'utilisateur
   */
  async getShareLinks(): Promise<ApiResponse<ShareLink[]>> {
    try {
      const response = await apiService.get<{ success: boolean; data: ShareLink[] }>('/share-links');
      return {
        data: response.data.data,
        status: response.status,
        message: response.message
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des liens de partage:', error);
      throw error;
    }
  },

  /**
   * Crée un nouveau lien de partage pour une conversation
   */
  async createShareLink(data: {
    conversationId: string;
    name?: string;
    description?: string;
    maxUses?: number;
    expiresAt?: string;
  }): Promise<ApiResponse<ShareLink>> {
    try {
      const response = await apiService.post<{ success: boolean; data: ShareLink }>('/share-links', data);
      return {
        data: response.data.data,
        status: response.status,
        message: response.message
      };
    } catch (error) {
      console.error('Erreur lors de la création du lien de partage:', error);
      throw error;
    }
  },

  /**
   * Désactive un lien de partage
   */
  async deactivateShareLink(linkId: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiService.patch<{ success: boolean }>(`/share-links/${linkId}/deactivate`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la désactivation du lien de partage:', error);
      throw error;
    }
  },

  /**
   * Obtient les informations d'un lien de partage public
   */
  async getShareLinkInfo(linkId: string): Promise<ApiResponse<ShareLink>> {
    try {
      const response = await apiService.get<ShareLink>(`/share-links/${linkId}`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des informations du lien:', error);
      throw error;
    }
  },

  /**
   * Rejoint une conversation via un lien de partage
   */
  async joinViaShareLink(linkId: string): Promise<ApiResponse<{ conversation: Conversation; message: string }>> {
    try {
      const response = await apiService.post<{ conversation: Conversation; message: string }>(`/share-links/${linkId}/join`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la tentative de rejoindre via le lien:', error);
      throw error;
    }
  }
};

export default dashboardService;
