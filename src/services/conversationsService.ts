import { apiService } from './apiService';
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
      unreadCount: Number(conv.unreadCount) || 0
    };
  }

  /**
   * Obtenir toutes les conversations de l'utilisateur
   */
  async getConversations(): Promise<Conversation[]> {
    const response = await apiService.get<unknown[]>('/conversations');
    return response.data.map(conv => this.transformConversationData(conv));
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
    const response = await apiService.get<{
      messages: Message[];
      total: number;
      hasMore: boolean;
    }>(`/conversations/${conversationId}/messages`, { page, limit });
    return response.data;
  }

  /**
   * Envoyer un message dans une conversation
   */
  async sendMessage(conversationId: string, data: SendMessageRequest): Promise<Message> {
    const response = await apiService.post<Message>(`/conversations/${conversationId}/messages`, data);
    return response.data;
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
  async getParticipants(conversationId: string): Promise<User[]> {
    const response = await apiService.get<User[]>(`/conversations/${conversationId}/participants`);
    return response.data;
  }

  /**
   * Mettre à jour les paramètres d'une conversation
   */
  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const response = await apiService.patch<Conversation>(`/conversations/${id}`, data);
    return response.data;
  }
}

export const conversationsService = new ConversationsService();
