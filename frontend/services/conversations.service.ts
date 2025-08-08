import { apiService } from './api.service';
import type { 
  Conversation, 
  Message, 
  User,
  UserRole,
  UserPermissions,
  CreateConversationRequest,
  SendMessageRequest 
} from '../types';

export class ConversationsService {
  // Cache simple pour les conversations
  private conversationsCache: { data: Conversation[], timestamp: number } | null = null;
  private readonly CACHE_DURATION = 30000; // 30 secondes
  
  // Gestion des requêtes en cours pour éviter les race conditions
  private pendingRequests: Map<string, AbortController> = new Map();

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
      lastSeen: undefined,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
    
    return {
      id: String(msg.id),
      content: String(msg.content),
      senderId: String(msg.senderId),
      conversationId: String(msg.conversationId),
      originalLanguage: String(msg.originalLanguage) || 'fr',
      isEdited: Boolean(msg.isEdited),
      isDeleted: Boolean(msg.isDeleted),
      editedAt: msg.editedAt ? new Date(String(msg.editedAt)) : undefined,
      createdAt: new Date(String(msg.createdAt)),
      updatedAt: new Date(String(msg.updatedAt)),
      sender: sender ? {
        id: String(sender.id),
        username: String(sender.username),
        firstName: sender.firstName as string,
        lastName: sender.lastName as string,
        displayName: sender.displayName as string,
        email: String(sender.email),
        phoneNumber: sender.phoneNumber as string,
        role: (sender.role as UserRole) || 'USER',
        permissions: (sender.permissions as UserPermissions) || {
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
        systemLanguage: String(sender.systemLanguage) || 'fr',
        regionalLanguage: String(sender.regionalLanguage) || 'fr',
        customDestinationLanguage: sender.customDestinationLanguage as string,
        autoTranslateEnabled: Boolean(sender.autoTranslateEnabled),
        translateToSystemLanguage: Boolean(sender.translateToSystemLanguage),
        translateToRegionalLanguage: Boolean(sender.translateToRegionalLanguage),
        useCustomDestination: Boolean(sender.useCustomDestination),
        isOnline: Boolean(sender.isOnline),
        avatar: sender.avatar as string,
        lastSeen: sender.lastSeen ? new Date(String(sender.lastSeen)) : undefined,
        createdAt: new Date(String(sender.createdAt)),
        lastActiveAt: new Date(String(sender.lastActiveAt)),
      } : defaultSender
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
          role: (participant.role as 'ADMIN' | 'MEMBER') || 'MEMBER',
          user: {
            id: String(user.id),
            username: String(user.username),
            firstName: user.firstName as string,
            lastName: user.lastName as string,
            displayName: user.displayName as string,
            email: String(user.email),
            phoneNumber: user.phoneNumber as string,
            role: (user.role as UserRole) || 'USER',
            permissions: (user.permissions as UserPermissions) || {
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
            systemLanguage: String(user.systemLanguage) || 'fr',
            regionalLanguage: String(user.regionalLanguage) || 'fr',
            customDestinationLanguage: user.customDestinationLanguage as string,
            autoTranslateEnabled: Boolean(user.autoTranslateEnabled),
            translateToSystemLanguage: Boolean(user.translateToSystemLanguage),
            translateToRegionalLanguage: Boolean(user.translateToRegionalLanguage),
            useCustomDestination: Boolean(user.useCustomDestination),
            isOnline: Boolean(user.isOnline),
            avatar: user.avatar as string,
            lastSeen: user.lastSeen ? new Date(String(user.lastSeen)) : undefined,
            createdAt: new Date(String(user.createdAt)),
            lastActiveAt: new Date(String(user.lastActiveAt)),
          }
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
      }>(`/api/conversations/${conversationId}/messages`, { page, limit }, {
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
  async getParticipants(conversationId: string): Promise<User[]> {
    const response = await apiService.get<User[]>(`/api/conversations/${conversationId}/participants`);
    return response.data;
  }

  /**
   * Mettre à jour les paramètres d'une conversation
   */
  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const response = await apiService.patch<Conversation>(`/conversations/${id}`, data);
    return response.data;
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
