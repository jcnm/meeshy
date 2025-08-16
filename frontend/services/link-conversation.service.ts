import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

export interface LinkConversationData {
  conversation: {
    id: string;
    title: string;
    description: string;
    type: string;
    createdAt: string;
    updatedAt: string;
  };
  link: {
    id: string;
    linkId: string;
    name: string;
    description: string;
    allowViewHistory: boolean;
    allowAnonymousMessages: boolean;
    allowAnonymousFiles: boolean;
    allowAnonymousImages: boolean;
    requireEmail: boolean;
    requireNickname: boolean;
    expiresAt: string | null;
    isActive: boolean;
  };
  messages: Array<{
    id: string;
    content: string;
    originalLanguage: string;
    createdAt: string;
    sender?: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      displayName: string;
      avatar: string;
    };
    anonymousSender?: {
      id: string;
      nickname: string;
      firstName: string;
      lastName: string;
    };
    translations?: Array<{
      id: string;
      targetLanguage: string;
      translatedText: string;
    }>;
  }>;
  stats: {
    totalMessages: number;
    totalMembers: number;
    totalAnonymousParticipants: number;
    onlineAnonymousParticipants: number;
    hasMore: boolean;
  };
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    user: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      displayName: string;
      avatar: string;
      isOnline: boolean;
      lastSeen: string;
    };
  }>;
  anonymousParticipants: Array<{
    id: string;
    nickname: string;
    firstName: string;
    lastName: string;
    language: string;
    isOnline: boolean;
    lastActiveAt: string;
    joinedAt: string;
    canSendMessages: boolean;
    canSendFiles: boolean;
    canSendImages: boolean;
  }>;
  currentUser: {
    id: string;
    type: 'anonymous' | 'authenticated';
    nickname?: string;
    username?: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    language: string;
    permissions?: {
      canSendMessages: boolean;
      canSendFiles: boolean;
      canSendImages: boolean;
    };
  };
}

export interface LinkConversationOptions {
  limit?: number;
  offset?: number;
  sessionToken?: string;
  authToken?: string;
}

export class LinkConversationService {
  /**
   * Récupère les données complètes d'une conversation via un lien de partage
   */
  static async getConversationData(
    linkId: string, 
    options: LinkConversationOptions = {}
  ): Promise<LinkConversationData> {
    const { limit = 50, offset = 0, sessionToken, authToken } = options;
    
    const endpoint = API_ENDPOINTS.CONVERSATION.GET_LINK_CONVERSATION(linkId);
    const url = new URL(buildApiUrl(endpoint));
    
    // Ajouter les paramètres de requête
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Ajouter le token d'authentification approprié
    if (sessionToken) {
      headers['x-session-token'] = sessionToken;
    } else if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Erreur lors du chargement de la conversation');
    }
    
    return result.data;
  }
  
  /**
   * Vérifie si un lien de conversation est valide
   */
  static async validateLink(linkId: string): Promise<{
    isValid: boolean;
    message?: string;
    link?: any;
  }> {
    try {
      const endpoint = API_ENDPOINTS.CONVERSATION.GET_LINK_CONVERSATION(linkId);
      const response = await fetch(buildApiUrl(endpoint), {
        method: 'HEAD',
        headers: { 'Content-Type': 'application/json' }
      });
      
      return {
        isValid: response.ok,
        message: response.ok ? undefined : 'Lien invalide ou expiré'
      };
    } catch (error) {
      return {
        isValid: false,
        message: 'Erreur lors de la validation du lien'
      };
    }
  }
  
  /**
   * Récupère les statistiques d'une conversation via lien
   */
  static async getConversationStats(
    linkId: string, 
    options: LinkConversationOptions = {}
  ): Promise<LinkConversationData['stats']> {
    const data = await this.getConversationData(linkId, { ...options, limit: 1, offset: 0 });
    return data.stats;
  }
  
  /**
   * Récupère les participants d'une conversation via lien
   */
  static async getConversationParticipants(
    linkId: string, 
    options: LinkConversationOptions = {}
  ): Promise<{
    members: LinkConversationData['members'];
    anonymousParticipants: LinkConversationData['anonymousParticipants'];
  }> {
    const data = await this.getConversationData(linkId, { ...options, limit: 1, offset: 0 });
    return {
      members: data.members,
      anonymousParticipants: data.anonymousParticipants
    };
  }
}
