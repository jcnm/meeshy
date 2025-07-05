import { Injectable } from '@nestjs/common';
import { ConversationLink, Conversation, Message } from '../types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ConversationService {
  private conversationLinks: Map<string, ConversationLink> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();

  constructor() {}

  // Créer un lien de conversation
  createConversationLink(createdBy: string, expiresInHours: number = 24 * 7): ConversationLink {
    const link: ConversationLink = {
      id: uuidv4(),
      createdBy,
      participants: [createdBy],
      isActive: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
    };

    this.conversationLinks.set(link.id, link);
    console.log(`📎 Lien de conversation créé: ${link.id} par ${createdBy}`);
    return link;
  }

  // Obtenir un lien de conversation
  getConversationLink(linkId: string): ConversationLink | undefined {
    const link = this.conversationLinks.get(linkId);
    if (link && (!link.expiresAt || link.expiresAt > new Date())) {
      return link;
    }
    return undefined;
  }

  // Rejoindre une conversation via un lien
  joinConversationViaLink(linkId: string, userId: string): Conversation | null {
    const link = this.getConversationLink(linkId);
    if (!link || !link.isActive) {
      return null;
    }

    // Ajouter l'utilisateur aux participants du lien
    if (!link.participants.includes(userId)) {
      link.participants.push(userId);
    }

    // Créer ou obtenir la conversation
    let conversation = this.getConversationByLinkId(linkId);
    if (!conversation) {
      conversation = {
        id: uuidv4(),
        linkId,
        participants: [userId],
        messages: [],
        createdAt: new Date(),
        lastMessageAt: new Date(),
      };
      this.conversations.set(conversation.id, conversation);
      this.messages.set(conversation.id, []);
    } else if (!conversation.participants.includes(userId)) {
      conversation.participants.push(userId);
    }

    console.log(`👥 Utilisateur ${userId} a rejoint la conversation ${conversation.id}`);
    return conversation;
  }

  // Obtenir une conversation par ID de lien
  getConversationByLinkId(linkId: string): Conversation | undefined {
    return Array.from(this.conversations.values()).find(conv => conv.linkId === linkId);
  }

  // Obtenir toutes les conversations d'un utilisateur
  getUserConversations(userId: string): Conversation[] {
    return Array.from(this.conversations.values()).filter(conv => 
      conv.participants.includes(userId)
    );
  }

  // Ajouter un message à une conversation
  addMessage(conversationId: string, senderId: string, content: string, originalLanguage: string): Message | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || !conversation.participants.includes(senderId)) {
      return null;
    }

    const message: Message = {
      id: uuidv4(),
      conversationId,
      senderId,
      content,
      timestamp: new Date(),
      originalLanguage,
    };

    const messages = this.messages.get(conversationId) || [];
    messages.push(message);
    this.messages.set(conversationId, messages);

    // Mettre à jour la dernière activité de la conversation
    conversation.lastMessageAt = new Date();

    console.log(`💬 Message ajouté à la conversation ${conversationId}`);
    return message;
  }

  // Obtenir les messages d'une conversation
  getConversationMessages(conversationId: string, userId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      return [];
    }

    return this.messages.get(conversationId) || [];
  }

  // Obtenir une conversation par ID
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  // Désactiver un lien de conversation
  deactivateConversationLink(linkId: string, userId: string): boolean {
    const link = this.conversationLinks.get(linkId);
    if (!link || link.createdBy !== userId) {
      return false;
    }

    link.isActive = false;
    console.log(`🔒 Lien de conversation ${linkId} désactivé`);
    return true;
  }

  // Obtenir tous les liens d'un utilisateur
  getUserConversationLinks(userId: string): ConversationLink[] {
    return Array.from(this.conversationLinks.values()).filter(link => 
      link.createdBy === userId
    );
  }

  // Nettoyer les liens expirés
  cleanupExpiredLinks(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, link] of this.conversationLinks.entries()) {
      if (link.expiresAt && link.expiresAt < now) {
        this.conversationLinks.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} liens de conversation expirés supprimés`);
    }

    return cleaned;
  }
}
