import { apiService } from './apiService';
import type { 
  Conversation, 
  Message, 
  User,
  CreateConversationRequest,
  SendMessageRequest 
} from '../types';

export class ConversationsService {
  /**
   * Obtenir toutes les conversations de l'utilisateur
   */
  async getConversations(): Promise<Conversation[]> {
    const response = await apiService.get<Conversation[]>('/conversations');
    return response.data;
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
