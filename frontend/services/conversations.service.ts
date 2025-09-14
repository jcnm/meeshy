import { apiService } from './api.service';
import { socketIOUserToUser } from '@/utils/user-adapter';
import { UserRoleEnum } from '@shared/types';
import type { 
  Conversation, 
  Message, 
  User,
  UserRole,
  UserPermissions,
  CreateConversationRequest,
  SendMessageRequest 
} from '@shared/types';

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
   * Convertir un rôle UserRoleEnum en string pour ConversationParticipant
   */
  private mapUserRoleToString(role: string): 'admin' | 'moderator' | 'member' {
    switch (role.toUpperCase()) {
      case 'ADMIN':
      case 'BIGBOSS':
      case 'CREATOR':
        return 'admin';
      case 'MODERATOR':
      case 'AUDIT':
      case 'ANALYST':
        return 'moderator';
      case 'USER':
      case 'MEMBER':
      default:
        return 'member';
    }
  }

  /**
   * Convertir un type de conversation en format valide
   */
  private mapConversationType(type: string): 'direct' | 'group' | 'public' | 'global' {
    switch (type.toLowerCase()) {
      case 'group':
        return 'group';
      case 'public':
        return 'public';
      case 'global':
        return 'global';
      case 'direct':
      default:
        return 'direct';
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
      type: this.mapConversationType(String(conv.type) || 'direct'),
      title: conv.title as string,
      name: (conv.name as string) || (conv.title as string),
      description: conv.description as string,
      image: conv.image as string,
      avatar: conv.avatar as string,
      communityId: conv.communityId as string,
      isActive: Boolean(conv.isActive),
      isArchived: Boolean(conv.isArchived),
      isGroup: Boolean(conv.isGroup) || String(conv.type) === 'group',
      isPrivate: Boolean(conv.isPrivate),
      lastMessageAt: conv.lastMessageAt ? new Date(String(conv.lastMessageAt)) : new Date(String(conv.updatedAt)),
      createdAt: new Date(String(conv.createdAt)),
      updatedAt: new Date(String(conv.updatedAt)),
      participants: Array.isArray(conv.members) ? conv.members.map((p: unknown) => {
        const participant = p as Record<string, unknown>;
        const user = participant.user as Record<string, unknown>;
        
        return {
          id: String(participant.id),
          conversationId: String(participant.conversationId),
          userId: String(participant.userId),
          role: this.mapUserRoleToString(String(participant.role || 'MEMBER')),
          canSendMessage: Boolean(participant.canSendMessage ?? true),
          canSendFiles: Boolean(participant.canSendFiles ?? true),
          canSendImages: Boolean(participant.canSendImages ?? true),
          canSendVideos: Boolean(participant.canSendVideos ?? true),
          canSendAudios: Boolean(participant.canSendAudios ?? true),
          canSendLocations: Boolean(participant.canSendLocations ?? true),
          canSendLinks: Boolean(participant.canSendLinks ?? true),
          joinedAt: new Date(String(participant.joinedAt)),
          leftAt: participant.leftAt ? new Date(String(participant.leftAt)) : undefined,
          isActive: Boolean(participant.isActive ?? true),
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
    
    const response = await apiService.get<{ success: boolean; data: unknown[] }>('/api/conversations');
    
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
    const response = await apiService.get<Conversation>(`/api/conversations/${id}`);
    return response.data;
  }

  /**
   * Créer une nouvelle conversation
   */
  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const response = await apiService.post<Conversation>('/api/conversations', data);
    return response.data;
  }

  /**
   * Supprimer une conversation
   */
  async deleteConversation(id: string): Promise<void> {
    await apiService.delete(`/api/conversations/${id}`);
  }

  /**
   * Obtenir les messages d'une conversation
   */
  async getMessages(conversationId: string, page = 1, limit = 20): Promise<{
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
    const response = await apiService.post<{ success: boolean; data: Message }>(`/api/conversations/${conversationId}/messages`, data);
    return response.data.data;
  }

  /**
   * Marquer une conversation comme lue
   */
  async markAsRead(conversationId: string): Promise<void> {
    await apiService.post(`/api/conversations/${conversationId}/read`);
  }

  /**
   * Ajouter un participant à une conversation
   */
  async addParticipant(conversationId: string, userId: string): Promise<void> {
    await apiService.post(`/api/conversations/${conversationId}/participants`, { userId });
  }

  /**
   * Supprimer un participant d'une conversation
   */
  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await apiService.delete(`/api/conversations/${conversationId}/participants/${userId}`);
  }

  /**
   * Rechercher dans les conversations
   */
  async searchConversations(query: string): Promise<Conversation[]> {
    const response = await apiService.get<Conversation[]>('/api/conversations/search', { q: query });
    return response.data;
  }

  /**
   * Obtenir les participants d'une conversation
   */
  async getParticipants(conversationId: string, filters?: ParticipantsFilters): Promise<User[]> {
    try {
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

      console.log('[ConversationsService] Récupération des participants pour conversation:', conversationId, 'avec filtres:', filters);
      
      const response = await apiService.get<{ success: boolean; data: User[] }>(
        `/api/conversations/${conversationId}/participants`,
        params
      );
      
      console.log('[ConversationsService] Réponse reçue:', response);
      return response.data.data || [];
    } catch (error) {
      console.error('[ConversationsService] Erreur lors de la récupération des participants:', error);
      console.error('[ConversationsService] Conversation ID:', conversationId);
      console.error('[ConversationsService] Filtres:', filters);
      // Retourner un tableau vide en cas d'erreur pour éviter de casser l'interface
      return [];
    }
  }

  /**
   * Obtenir tous les participants d'une conversation (authentifiés et anonymes)
   * Cette méthode utilise l'endpoint /conversations/:conversationId/participants qui retourne tous les participants
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
      // Récupérer tous les participants via l'endpoint /api/conversations/:conversationId/participants
      const response = await apiService.get<{
        success: boolean;
        data: Array<User & {
          isAnonymous?: boolean;
          canSendMessages?: boolean;
          canSendFiles?: boolean;
          canSendImages?: boolean;
        }>;
      }>(`/api/conversations/${conversationId}/participants`);
      
      const allParticipants = response.data.data || [];
      
      // Séparer les participants authentifiés et anonymes
      const authenticatedParticipants: User[] = [];
      const anonymousParticipants: Array<{
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
      }> = [];
      
      allParticipants.forEach(participant => {
        if (participant.isAnonymous) {
          anonymousParticipants.push({
            id: participant.id,
            username: participant.username,
            firstName: participant.firstName,
            lastName: participant.lastName,
            language: participant.systemLanguage || 'fr',
            isOnline: participant.isOnline,
            joinedAt: participant.createdAt?.toISOString() || new Date().toISOString(),
            canSendMessages: participant.canSendMessages || false,
            canSendFiles: participant.canSendFiles || false,
            canSendImages: participant.canSendImages || false
          });
        } else {
          authenticatedParticipants.push(participant);
        }
      });
      
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
    const response = await apiService.patch<Conversation>(`/api/conversations/${id}`, data);
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
      }>(`/api/conversations/${conversationId}/new-link`, {
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
    return `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://meeshy.me'}/join/${response.data.data.linkId}`;
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
   * Marque tous les messages d'une conversation comme lus
   */
  async markConversationAsRead(conversationId: string): Promise<{
    success: boolean;
    message: string;
    markedCount: number;
  }> {
    const requestKey = `mark-read-${conversationId}`;
    const controller = this.createRequestController(requestKey);
    
    try {
      const response = await apiService.post<{
        success: boolean;
        message: string;
        markedCount: number;
      }>(`/api/conversations/${conversationId}/mark-read`, {}, {
        signal: controller.signal
      });
      
      // Nettoyer le controller une fois la requête terminée
      this.pendingRequests.delete(requestKey);
      
      return response.data;
    } catch (error) {
      this.pendingRequests.delete(requestKey);
      throw error;
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
