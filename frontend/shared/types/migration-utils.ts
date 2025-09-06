/**
 * Utilitaires de migration pour les types unifiés
 * Facilite la transition vers les nouveaux types Phase 1
 */

import type { Message, Conversation, ConversationParticipant } from './conversation';
import type { SocketIOUser as User } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';
import type { ApiResponse } from './api-responses';
import type { SocketIOUser, SocketIOMessage } from './socketio-events';

/**
 * Convertit un SocketIOUser vers User unifié
 */
export function socketIOUserToUser(socketUser: SocketIOUser): User {
  return {
    id: socketUser.id,
    username: socketUser.username,
    firstName: socketUser.firstName,
    lastName: socketUser.lastName,
    email: socketUser.email,
    phoneNumber: socketUser.phoneNumber,
    displayName: socketUser.displayName,
    avatar: socketUser.avatar,
    role: socketUser.role, // Déjà string, compatible directement
    permissions: socketUser.permissions,
    isOnline: socketUser.isOnline,
    lastSeen: socketUser.lastSeen,
    lastActiveAt: socketUser.lastActiveAt,
    systemLanguage: socketUser.systemLanguage,
    regionalLanguage: socketUser.regionalLanguage,
    customDestinationLanguage: socketUser.customDestinationLanguage,
    autoTranslateEnabled: socketUser.autoTranslateEnabled,
    translateToSystemLanguage: socketUser.translateToSystemLanguage,
    translateToRegionalLanguage: socketUser.translateToRegionalLanguage,
    useCustomDestination: socketUser.useCustomDestination,
    isActive: socketUser.isActive,
    deactivatedAt: socketUser.deactivatedAt,
    createdAt: socketUser.createdAt,
    updatedAt: socketUser.updatedAt,
    isAnonymous: socketUser.isAnonymous,
    isMeeshyer: socketUser.isMeeshyer
  };
}

/**
 * Convertit un SocketIOMessage vers Message unifié
 */
export function socketIOMessageToMessage(socketMessage: SocketIOMessage): Message {
  return {
    id: socketMessage.id,
    conversationId: socketMessage.conversationId,
    senderId: socketMessage.senderId,
    content: socketMessage.content,
    originalLanguage: socketMessage.originalLanguage,
    messageType: socketMessage.messageType as any, // Type conversion
    createdAt: socketMessage.createdAt,
    updatedAt: socketMessage.updatedAt,
    sender: socketMessage.sender ? socketIOUserToUser(socketMessage.sender as SocketIOUser) : undefined
  };
}

/**
 * Vérifie si un ID est un ObjectId MongoDB valide
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Extrait l'ObjectId d'un objet conversation pour les API
 */
export function getApiConversationId(conversation: any): string {
  if (!conversation) {
    throw new Error('Conversation object is null or undefined');
  }
  
  if (conversation.id && isValidObjectId(conversation.id)) {
    return conversation.id;
  }
  
  throw new Error(`Invalid conversation object: missing valid ObjectId. Got: ${JSON.stringify(conversation)}`);
}

/**
 * Extrait l'identifier d'affichage d'une conversation
 */
export function getDisplayConversationId(conversation: any): string {
  if (!conversation) {
    throw new Error('Conversation object is null or undefined');
  }
  
  // Priorité à l'identifier pour les URLs
  if (conversation.identifier && typeof conversation.identifier === 'string') {
    return conversation.identifier;
  }
  
  // Fallback sur l'ID
  if (conversation.id) {
    return conversation.id;
  }
  
  throw new Error(`Invalid conversation object: missing identifier and id. Got: ${JSON.stringify(conversation)}`);
}

/**
 * Crée une réponse API de succès
 */
export function createApiSuccessResponse<T>(data: T, meta?: any): ApiResponse<T> {
  return {
    success: true,
    data,
    meta
  };
}

/**
 * Crée une réponse API d'erreur
 */
export function createApiErrorResponse(error: string, code?: string): ApiResponse<never> {
  return {
    success: false,
    error,
    code
  };
}

/**
 * Type guard pour vérifier si c'est un utilisateur authentifié
 */
export function isAuthenticatedUser(sender: User | AnonymousParticipant | undefined): sender is User {
  return sender !== undefined && 'email' in sender;
}

/**
 * Type guard pour vérifier si c'est un participant anonyme
 */
export function isAnonymousParticipant(sender: User | AnonymousParticipant | undefined): sender is AnonymousParticipant {
  return sender !== undefined && 'sessionToken' in sender;
}

/**
 * Normalise un message depuis différentes sources
 * Assure la synchronisation entre createdAt et timestamp
 */
export function normalizeMessage(rawMessage: any): Message {
  const normalizedMessage: Message = {
    id: String(rawMessage.id),
    conversationId: String(rawMessage.conversationId),
    senderId: rawMessage.senderId ? String(rawMessage.senderId) : undefined,
    anonymousSenderId: rawMessage.anonymousSenderId ? String(rawMessage.anonymousSenderId) : undefined,
    content: String(rawMessage.content),
    originalLanguage: String(rawMessage.originalLanguage || 'fr'),
    messageType: rawMessage.messageType || 'text',
    isEdited: Boolean(rawMessage.isEdited),
    isDeleted: Boolean(rawMessage.isDeleted),
    replyToId: rawMessage.replyToId ? String(rawMessage.replyToId) : undefined,
    createdAt: new Date(rawMessage.createdAt || rawMessage.timestamp),
    updatedAt: new Date(rawMessage.updatedAt || rawMessage.createdAt || rawMessage.timestamp),
    editedAt: rawMessage.editedAt ? new Date(rawMessage.editedAt) : undefined,
    deletedAt: rawMessage.deletedAt ? new Date(rawMessage.deletedAt) : undefined,
    
    sender: rawMessage.sender || rawMessage.anonymousSender,
    anonymousSender: rawMessage.anonymousSender,
    replyTo: rawMessage.replyTo ? normalizeMessage(rawMessage.replyTo) : undefined
  };
  
  return normalizedMessage;
}

/**
 * Normalise une conversation depuis différentes sources
 * Assure la synchronisation entre les alias de champs
 */
export function normalizeConversation(rawConversation: any): Conversation {
  const normalizedConversation: Conversation = {
    id: String(rawConversation.id),
    identifier: rawConversation.identifier,
    type: rawConversation.type || 'direct',
    title: rawConversation.title,
    name: rawConversation.name || rawConversation.title,
    description: rawConversation.description,
    image: rawConversation.image,
    avatar: rawConversation.avatar,
    communityId: rawConversation.communityId,
    isActive: Boolean(rawConversation.isActive ?? true),
    isArchived: Boolean(rawConversation.isArchived),
    isGroup: Boolean(rawConversation.isGroup || rawConversation.type === 'group'),
    isPrivate: Boolean(rawConversation.isPrivate),
    lastMessageAt: new Date(rawConversation.lastMessageAt || rawConversation.updatedAt),
    lastMessage: rawConversation.lastMessage ? normalizeMessage(rawConversation.lastMessage) : undefined,
    createdAt: new Date(rawConversation.createdAt),
    updatedAt: new Date(rawConversation.updatedAt),
    participants: Array.isArray(rawConversation.participants) ? rawConversation.participants : [],
    unreadCount: Number(rawConversation.unreadCount || 0),
    
    // Champs additionnels pour compatibilité
    messages: Array.isArray(rawConversation.messages) ? rawConversation.messages.map(normalizeMessage) : undefined,
    groupId: rawConversation.groupId,
    maxMembers: rawConversation.maxMembers,
    linkId: rawConversation.linkId
  };
  
  return normalizedConversation;
}
