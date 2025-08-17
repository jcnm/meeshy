import { apiService } from './api.service';
import { socketIOUserToUser } from '@/utils/user-adapter';
import { UserRoleEnum } from '@/shared/types';
import type { 
  Conversation, 
  Message, 
  User,
  UserRole,
  UserPermissions,
  CreateConversationRequest,
  SendMessageRequest 
} from '../types';

/**
 * Options de filtrage pour les participants
 */
export interface ParticipantsFilters {
  onlineOnly?: boolean;
  role?: string;
  search?: string;
  limit?: number;
}

export class ConversationsService {
  // Cache simple pour les conversations
  private conversationsCache: { data: Conversation[], timestamp: number } | null = null;
  private readonly CACHE_DURATION = 30000; // 30 secondes
  
  // Gestion des requêtes en cours pour éviter les race conditions
  private pendingRequests: Map<string, AbortController> = new Map();

  /**
   * Convertir un rôle string en UserRoleEnum
   */
  private stringToUserRole(role: string): UserRoleEnum {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return UserRoleEnum.ADMIN;
      case 'MODERATOR':
        return UserRoleEnum.MODERATOR;
      case 'BIGBOSS':
        return UserRoleEnum.BIGBOSS;
      case 'CREATOR':
        return UserRoleEnum.CREATOR;
      case 'AUDIT':
        return UserRoleEnum.AUDIT;
      case 'ANALYST':
        return UserRoleEnum.ANALYST;
      case 'USER':
        return UserRoleEnum.USER;
      case 'MEMBER':
      default:
        return UserRoleEnum.MEMBER;
    }
  }

  /**
   * Vérifie si le cache des conversations est valide
   */
  private isCacheValid(): boolean {
    if (!this.conversationsCache) return false;
    return (Date.now() - this.conversationsCache.timestamp) < this.CACHE_DURATION;
  }

  /**
   * Met en cache les conversations
   */
  private setCacheConversations(conversations: Conversation[]): void {
    this.conversationsCache = {
      data: conversations,
      timestamp: Date.now()
    };
  }

  /**
   * Transforme les données d'un message du backend vers le format frontend
   */
  private transformMessageData(backendMessage: unknown): Message {
    const msg = backendMessage as Record<string, unknown>;
    const sender = msg.sender as Record<string, unknown> | undefined;
    
    // Créer un sender par défaut si non fourni
    const defaultSender: User = {
      id: String(msg.senderId) || 'unknown',
      username: 'Unknown User',
      firstName: '',
      lastName: '',
      displayName: 'Utilisateur Inconnu',
      email: 'unknown@example.com',
      phoneNumber: '',
      role: 'USER',
      permissions: {
        canAccessAdmin: false,
        canManageUsers: false,
        canManageGroups: false,
        canManageConversations: false,
        canViewAnalytics: false,
        canModerateContent: false,
        canViewAuditLogs: false,
        canManageNotifications: false,
        canManageTranslations: false,
      },
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      customDestinationLanguage: undefined,
      autoTranslateEnabled: false,
      translateToSystemLanguage: false,
      translateToRegionalLanguage: false,
      useCustomDestination: false,
      isOnline: false,
      avatar: undefined,
      lastSeen: new Date(),
      createdAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true,
      updatedAt: new Date(),
    };
    
    return {
      id: String(msg.id),
      content: String(msg.content),
      senderId: String(msg.senderId),
      conversationId: String(msg.conversationId),
      originalLanguage: String(msg.originalLanguage) || 'fr',
      messageType: String(msg.messageType) || 'text',
      isEdited: Boolean(msg.isEdited),
      isDeleted: Boolean(msg.isDeleted),
      createdAt: new Date(String(msg.createdAt)),
      updatedAt: new Date(String(msg.updatedAt)),
      sender: sender ? socketIOUserToUser(sender as any) : defaultSender
    };
  }

  /**
   * Transforme les données de conversation du backend vers le format frontend
   */
  private transformConversationData(backendConversation: unknown): Conversation {
    const conv = backendConversation as Record<string, unknown>;
    
    return {
      id: String(conv.id),
      type: String(conv.type)?.toUpperCase() || 'DIRECT',
      title: conv.title as string,
      name: (conv.name as string) || (conv.title as string),
      description: conv.description as string,
      isGroup: Boolean(conv.isGroup) || String(conv.type) === 'group',
      isPrivate: Boolean(conv.isPrivate),
      isActive: Boolean(conv.isActive),
      createdAt: new Date(String(conv.createdAt)),
      updatedAt: new Date(String(conv.updatedAt)),
      participants: Array.isArray(conv.participants) ? conv.participants.map((p: unknown) => {
        const participant = p as Record<string, unknown>;
        const user = participant.user as Record<string, unknown>;
        
        return {
          id: String(participant.id),
          conversationId: String(participant.conversationId),
          userId: String(participant.userId),
          joinedAt: new Date(String(participant.joinedAt)),
          role: this.stringToUserRole(String(participant.role || 'MEMBER')),
          user: socketIOUserToUser(user as any)
        };
      }) : [],
      lastMessage: conv.lastMessage ? this.transformMessageData(conv.lastMessage) : undefined,
      unreadCount: Number(conv.unreadCount) || 0
    };
  }

  /**
   * Obtenir toutes les conversations de l'utilisateur
   */
  async getConversations(): Promise<Conversation[]> {
    // Vérifier le cache
    if (this.isCacheValid()) {
      console.log('🔄 Utilisation du cache pour les conversations');
      return this.conversationsCache!.data;
    }
    
    const response = await apiService.get<{ success: boolean; data: unknown[] }>('/conversations');
    
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('Format de réponse invalide pour les conversations');
    }
    
    const conversations = response.data.data.map(conv => this.transformConversationData(conv));
    
    // Mettre en cache les conversations
    this.setCacheConversations(conversations);
    
    return conversations;
  }

  /**
   * Obtenir une conversation spécifique par ID
   */
  async getConversation(id: string): Promise<Conversation> {
    const response = await apiService.get<Conversation>(`/conversations/${id}`);
    return response.data;
  }

  /**
   * Créer une nouvelle conversation
   */
  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const response = await apiService.post<Conversation>('/conversations', data);
    return response.data;
  }

  /**
   * Supprimer une conversation
   */
  async deleteConversation(id: string): Promise<void> {
    await apiService.delete(`/conversations/${id}`);
  }

  /**
   * Obtenir les messages d'une conversation
   */
  async getMessages(conversationId: string, page = 1, limit = 50): Promise<{
    messages: Message[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Créer un controller pour annuler les requêtes précédentes
      const requestKey = `messages-${conversationId}`;
      const controller = this.createRequestController(requestKey);
      
      const response = await apiService.get<{
        success: boolean;
        data: {
          messages: unknown[];
          hasMore: boolean;
        };
      }>(`/conversations/${conversationId}/messages`, { page, limit }, {
        signal: controller.signal
      });
      
      // Nettoyer le controller une fois la requête terminée
      this.pendingRequests.delete(requestKey);
      
      // Vérifier la structure de la réponse
      if (!response.data?.success || !response.data?.data) {
        console.warn('⚠️ Structure de réponse inattendue:', response.data);
        return {
          messages: [],
          total: 0,
          hasMore: false,
        };
      }
      
      // Transformer les messages du backend vers le format frontend
      const transformedMessages = (response.data.data.messages || []).map(msg => this.transformMessageData(msg));
      
      // Vérification de sécurité pour éviter les erreurs undefined
      return {
        messages: transformedMessages,
        total: transformedMessages.length, // Pour l'instant on utilise la longueur des messages
        hasMore: response.data.data.hasMore || false,
      };
    } catch (error) {
      // Vérifier si l'erreur est due à l'annulation
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🚫 Requête getMessages annulée pour:', conversationId);
        // Retourner une erreur spéciale pour indiquer l'annulation
        throw new Error('REQUEST_CANCELLED');
      }
      
      console.error('❌ Erreur lors du chargement des messages:', error);
      // Retourner des données par défaut en cas d'erreur
      return {
        messages: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Envoyer un message dans une conversation
   */
  async sendMessage(conversationId: string, data: SendMessageRequest): Promise<Message> {
    const response = await apiService.post<{ success: boolean; data: Message }>(`/conversations/${conversationId}/messages`, data);
    return response.data.data;
  }

  /**
   * Marquer une conversation comme lue
   */
  async markAsRead(conversationId: string): Promise<void> {
    await apiService.post(`/conversations/${conversationId}/read`);
  }

  /**
   * Ajouter un participant à une conversation
   */
  async addParticipant(conversationId: string, userId: string): Promise<void> {
    await apiService.post(`/conversations/${conversationId}/participants`, { userId });
  }

  /**
   * Supprimer un participant d'une conversation
   */
  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await apiService.delete(`/conversations/${conversationId}/participants/${userId}`);
  }

  /**
   * Rechercher dans les conversations
   */
  async searchConversations(query: string): Promise<Conversation[]> {
    const response = await apiService.get<Conversation[]>('/conversations/search', { q: query });
    return response.data;
  }

  /**
   * Obtenir les participants d'une conversation
   */
  async getParticipants(conversationId: string, filters?: ParticipantsFilters): Promise<User[]> {
    const params: Record<string, string> = {};
    
    if (filters?.onlineOnly) {
      params.onlineOnly = 'true';
    }
    
    if (filters?.role) {
      params.role = filters.role;
    }
    
    if (filters?.search) {
      params.search = filters.search;
    }
    
    if (filters?.limit) {
      params.limit = filters.limit.toString();
    }

    const response = await apiService.get<{ success: boolean; data: User[] }>(
      `/conversations/${conversationId}/participants`,
      params
    );
    return response.data.data || [];
  }

  /**
   * Obtenir tous les participants d'une conversation (authentifiés et anonymes)
   * Cette méthode utilise l'endpoint /links/:conversationId pour récupérer les participants anonymes
   */
  async getAllParticipants(conversationId: string): Promise<{
    authenticatedParticipants: User[];
    anonymousParticipants: Array<{
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      language: string;
      isOnline: boolean;
      joinedAt: string;
      canSendMessages: boolean;
      canSendFiles: boolean;
      canSendImages: boolean;
    }>;
  }> {
    try {
      // Récupérer les participants authentifiés
      const authenticatedParticipants = await this.getParticipants(conversationId);
      
      // Récupérer les participants anonymes via l'endpoint /links/:conversationId
      const linkResponse = await apiService.get<{
        success: boolean;
        data: {
          anonymousParticipants: Array<{
            id: string;
            username: string;
            firstName: string;
            lastName: string;
            language: string;
            isOnline: boolean;
            joinedAt: string;
            canSendMessages: boolean;
            canSendFiles: boolean;
            canSendImages: boolean;
          }>;
        };
      }>(`/links/${conversationId}`);
      
      const anonymousParticipants = linkResponse.data.data?.anonymousParticipants || [];
      
      return {
        authenticatedParticipants,
        anonymousParticipants
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de tous les participants:', error);
      // En cas d'erreur, retourner au moins les participants authentifiés
      const authenticatedParticipants = await this.getParticipants(conversationId);
      return {
        authenticatedParticipants,
        anonymousParticipants: []
      };
    }
  }

  /**
   * Mettre à jour les paramètres d'une conversation
   */
  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const response = await apiService.patch<Conversation>(`/conversations/${id}`, data);
    return response.data;
  }

  /**
   * Créer un lien d'invitation pour une conversation
   */
  async createInviteLink(conversationId: string, linkData?: {
    name?: string;
    description?: string;
    maxUses?: number;
    expiresAt?: string;
    allowAnonymousMessages?: boolean;
    allowAnonymousFiles?: boolean;
    allowAnonymousImages?: boolean;
    allowViewHistory?: boolean;
    requireNickname?: boolean;
    requireEmail?: boolean;
  }): Promise<string> {
    try {
      // Utiliser l'endpoint existant /conversations/:id/new-link
      const response = await apiService.post<{ 
        success: boolean; 
        data: { link: string; code: string; shareLink: any } 
      }>(`/conversations/${conversationId}/new-link`, {
        name: linkData?.name || 'Lien d\'invitation',
        description: linkData?.description || 'Rejoignez cette conversation',
        maxUses: linkData?.maxUses,
        expiresAt: linkData?.expiresAt,
        allowAnonymousMessages: linkData?.allowAnonymousMessages ?? true,
        allowAnonymousFiles: linkData?.allowAnonymousFiles ?? false,
        allowAnonymousImages: linkData?.allowAnonymousImages ?? true,
        allowViewHistory: linkData?.allowViewHistory ?? true,
        requireNickname: linkData?.requireNickname ?? true,
        requireEmail: linkData?.requireEmail ?? false
      });
      
      return response.data.data.link;
    } catch (error: any) {
      // Gérer les erreurs spécifiques
      if (error.status === 403) {
        if (error.message?.includes('Accès non autorisé')) {
          throw new Error('Vous n\'êtes pas membre de cette conversation. Seuls les membres peuvent créer des liens de partage.');
        } else if (error.message?.includes('Seuls les administrateurs')) {
          throw new Error('Seuls les administrateurs et modérateurs peuvent créer des liens de partage pour cette conversation.');
        } else {
          throw new Error('Vous n\'avez pas les permissions nécessaires pour créer un lien de partage.');
        }
      } else if (error.status === 404) {
        throw new Error('Conversation non trouvée.');
      } else {
        throw new Error('Erreur lors de la création du lien de partage. Veuillez réessayer.');
      }
    }
  }

  /**
   * Créer une nouvelle conversation avec un lien d'invitation
   */
  async createConversationWithLink(linkData: {
    name?: string;
    description?: string;
    maxUses?: number;
    expiresAt?: string;
    allowAnonymousMessages?: boolean;
    allowAnonymousFiles?: boolean;
    allowAnonymousImages?: boolean;
    allowViewHistory?: boolean;
    requireNickname?: boolean;
    requireEmail?: boolean;
  } = {}): Promise<string> {
    // Créer une nouvelle conversation sans conversationId (le backend créera automatiquement la conversation)
    const response = await apiService.post<{ 
      success: boolean; 
      data: { linkId: string; conversationId: string; shareLink: any } 
    }>('/links', {
      // Pas de conversationId - le backend créera une nouvelle conversation
      name: linkData.name || 'Nouvelle conversation',
      description: linkData.description || 'Rejoignez cette conversation',
      maxUses: linkData.maxUses,
      expiresAt: linkData.expiresAt,
      allowAnonymousMessages: linkData.allowAnonymousMessages ?? true,
      allowAnonymousFiles: linkData.allowAnonymousFiles ?? false,
      allowAnonymousImages: linkData.allowAnonymousImages ?? true,
      allowViewHistory: linkData.allowViewHistory ?? true,
      requireNickname: linkData.requireNickname ?? true,
      requireEmail: linkData.requireEmail ?? false
    });
    
    // Retourner le lien complet
    return `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3100'}/join/${response.data.data.linkId}`;
  }

  /**
   * Annule toutes les requêtes en cours pour un type donné
   */
  private cancelPendingRequest(key: string): void {
    const controller = this.pendingRequests.get(key);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Crée un nouveau controller pour une requête
   */
  private createRequestController(key: string): AbortController {
    this.cancelPendingRequest(key);
    const controller = new AbortController();
    this.pendingRequests.set(key, controller);
    return controller;
  }
}

export const conversationsService = new ConversationsService();
