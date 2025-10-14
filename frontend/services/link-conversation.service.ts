import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { analyzeLinkIdentifier, generateFallbackIdentifiers, isValidForApiRequest } from '@/utils/link-identifier';

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
  userType: 'anonymous' | 'member'; // Type d'utilisateur au niveau de data
  messages: Array<{
    id: string;
    content: string;
    originalLanguage: string;
    createdAt: string;
    sender: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      displayName?: string;
      avatar?: string;
      isMeeshyer: boolean; // true = membre, false = anonyme
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
    username: string; // Renommé depuis nickname
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
    username: string; // Unifié pour nickname et username
    firstName: string;
    lastName: string;
    displayName?: string;
    language: string;
    isMeeshyer: boolean; // true = membre, false = anonyme
    permissions?: {
      canSendMessages: boolean;
      canSendFiles: boolean;
      canSendImages: boolean;
    };
  } | null; // Peut être null si l'utilisateur n'est pas authentifié
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
   * Utilise la séparation anonymous/links pour respecter l'architecture
   * 
   * @param identifier - Peut être soit un linkId (format mshy_...) soit un conversationShareLinkId (ID de base de données)
   */
  static async getConversationData(
    identifier: string, 
    options: LinkConversationOptions = {}
  ): Promise<LinkConversationData> {
    const { limit = 50, offset = 0, sessionToken, authToken } = options;
    
    // Analyser l'identifiant pour validation
    const identifierInfo = analyzeLinkIdentifier(identifier);
    
    if (!isValidForApiRequest(identifier)) {
      throw new Error(`Identifiant invalide: ${identifier}`);
    }
    
    console.log('[LinkConversationService] Analyse de l\'identifiant:', {
      identifier,
      type: identifierInfo.type,
      isValid: identifierInfo.isValid
    });
    
    // Préparer les headers d'authentification
    const headers: Record<string, string> = {};
    
    if (sessionToken) {
      console.log('[LinkConversationService] Authentification avec sessionToken');
      headers['X-Session-Token'] = sessionToken;
    } else if (authToken) {
      console.log('[LinkConversationService] Authentification avec token');
      headers['Authorization'] = `Bearer ${authToken}`;
    } else {
      console.log('[LinkConversationService] Aucune authentification');
    }
    
    // Essayer d'abord avec l'identifiant original
    let endpoint = `/api/links/${identifier}`;
    let url = new URL(buildApiUrl(endpoint));
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('offset', offset.toString());

    console.log('[LinkConversationService] Tentative avec endpoint:', endpoint);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Erreur lors de la récupération des données');
      }

      return data.data;
    } catch (error) {
      console.log('[LinkConversationService] Erreur avec identifiant original, tentative avec fallbacks');
      
      // Essayer avec les identifiants de fallback
      const fallbacks = generateFallbackIdentifiers(identifier);
      
      for (const fallbackIdentifier of fallbacks) {
        try {
          console.log('[LinkConversationService] Tentative avec fallback:', fallbackIdentifier);
          
          const fallbackEndpoint = `/api/links/${fallbackIdentifier}`;
          const fallbackUrl = new URL(buildApiUrl(fallbackEndpoint));
          fallbackUrl.searchParams.append('limit', limit.toString());
          fallbackUrl.searchParams.append('offset', offset.toString());

          const fallbackResponse = await fetch(fallbackUrl.toString(), {
            method: 'GET',
            headers
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            
            if (fallbackData.success) {
              console.log('[LinkConversationService] Succès avec fallback:', fallbackIdentifier);
              return fallbackData.data;
            }
          }
        } catch (fallbackError) {
          console.log('[LinkConversationService] Échec avec fallback:', fallbackIdentifier, fallbackError);
          // Continuer avec le prochain fallback
        }
      }
      
      // Si tous les fallbacks échouent, relancer l'erreur originale
      throw error;
    }
  }

  /**
   * Récupère les informations de base d'un lien (endpoint public)
   */
  static async getLinkInfo(linkId: string): Promise<{
    success: boolean;
    data: {
      id: string; // ID de la conversationShareLink
      linkId: string;
      name: string;
      description: string;
      allowViewHistory?: boolean;
      allowAnonymousMessages?: boolean;
      allowAnonymousFiles?: boolean;
      allowAnonymousImages?: boolean;
      requireEmail: boolean;
      requireNickname: boolean;
      expiresAt: string | null;
      isActive?: boolean;
      conversation: {
        id: string;
        title: string;
        description: string;
        type: string;
      };
    };
  }> {
    const endpoint = `/anonymous/link/${linkId}`;
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur lors de la récupération des informations du lien');
    }

    return data;
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
      const linkInfo = await this.getLinkInfo(linkId);
      return {
        isValid: true,
        link: linkInfo.data // Utiliser linkInfo.data au lieu de linkInfo.link
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Erreur lors de la validation du lien'
      };
    }
  }
  
  /**
   * Rejoint une conversation via un lien de partage (utilisateurs authentifiés)
   */
  static async joinConversation(
    linkId: string,
    authToken: string
  ): Promise<{ conversationId: string; redirectTo?: string }> {
    const endpoint = `/conversations/join/${linkId}`;
    const url = buildApiUrl(endpoint);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authToken}`
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers
      // Pas de body nécessaire, l'authentification se fait via le token
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Erreur lors de la jointure de la conversation');
    }
    
    return result.data;
  }
  
  /**
   * Récupère les statistiques d'une conversation via lien
   */
  static async getConversationStats(
    conversationShareLinkId: string, 
    options: LinkConversationOptions = {}
  ): Promise<LinkConversationData['stats']> {
    const data = await this.getConversationData(conversationShareLinkId, { ...options, limit: 1, offset: 0 });
    return data.stats;
  }
  
  /**
   * Récupère les participants d'une conversation via lien
   */
  static async getConversationParticipants(
    conversationShareLinkId: string, 
    options: LinkConversationOptions = {}
  ): Promise<{
    members: LinkConversationData['members'];
    anonymousParticipants: LinkConversationData['anonymousParticipants'];
  }> {
    const data = await this.getConversationData(conversationShareLinkId, { ...options, limit: 1, offset: 0 });
    return {
      members: data.members,
      anonymousParticipants: data.anonymousParticipants
    };
  }
}
