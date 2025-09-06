/**
 * Types unifiés pour les conversations Meeshy
 * Harmonisation Gateway ↔ Frontend
 */

import type { SocketIOMessage, SocketIOUser as User, MessageType } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';

/**
 * Statistiques d'une conversation
 */
export interface ConversationStats {
  totalMessages: number;
  totalParticipants: number;
  activeParticipants: number;          // Participants actifs dernières 24h
  messagesLast24h: number;
  messagesLast7days: number;
  averageResponseTime: number;         // En minutes
  topLanguages: Array<{
    language: string;
    messageCount: number;
    percentage: number;
  }>;
  translationStats: {
    totalTranslations: number;
    cacheHitRate: number;             // % traductions depuis cache
    averageTranslationTime: number;   // En ms
    topLanguagePairs: Array<{
      from: string;
      to: string;
      count: number;
    }>;
  };
  lastActivity: Date;
  createdAt: Date;
}

/**
 * Types d'identifiants supportés pour une conversation
 * - id: ObjectId MongoDB (TOUJOURS pour API/WebSocket)
 * - identifier: Human-readable (OPTIONNEL pour URLs)
 */
export interface ConversationIdentifiers {
  id: string;           // ObjectId MongoDB - TOUJOURS pour API/WebSocket
  identifier?: string;  // Human-readable - OPTIONNEL pour URLs
}

/**
 * Conversation unifiée
 * Contient TOUS les champs utilisés dans Gateway et Frontend pour compatibilité totale
 */
export interface Conversation extends ConversationIdentifiers {
  type: 'direct' | 'group' | 'public' | 'global';
  title?: string;
  name?: string;  // Alias pour title
  description?: string;
  image?: string;
  avatar?: string;
  communityId?: string;
  isActive: boolean;
  isArchived: boolean;
  isGroup: boolean;
  isPrivate: boolean;
  lastMessageAt: Date;
  lastMessage?: SocketIOMessage;
  createdAt: Date;
  updatedAt: Date;
  participants: ConversationParticipant[];
  unreadCount?: number;
  
  // Champs additionnels pour compatibilité
  messages?: SocketIOMessage[];  // Pour certains usages frontend
  groupId?: string;      // Référence au groupe si c'est une conversation de groupe
  maxMembers?: number;   // Limite de participants
  
  // Champs pour compatibilité avec frontend.ts
  linkId?: string;       // Pour compatibilité avec ConversationLink
}

/**
 * Participant de conversation (utilisateur authentifié)
 */
export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: 'admin' | 'moderator' | 'member';
  canSendMessage: boolean;
  canSendFiles: boolean;
  canSendImages: boolean;
  canSendVideos: boolean;
  canSendAudios: boolean;
  canSendLocations: boolean;
  canSendLinks: boolean;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
  user: User;
}

/**
 * Traduction de message
 */
export interface MessageTranslation {
  id: string;
  messageId: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedContent: string;
  translationModel: 'basic' | 'medium' | 'premium';
  cacheKey: string;
  confidenceScore?: number;
  createdAt: Date;
}

/**
 * Message avec traductions
 */
export interface MessageWithTranslations extends SocketIOMessage {
  translations: MessageTranslation[];
}

/**
 * Message avec attachements
 */
export interface messagesWithAttachements extends SocketIOMessage {
  
  // Attachements multiples (tableau)
  attachments?: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    thumbnailUrl?: string; // Pour images/vidéos
    metadata?: {
      width?: number; // Pour images/vidéos
      height?: number; // Pour images/vidéos
      duration?: number; // Pour audio/vidéo
      latitude?: number; // Pour location
      longitude?: number; // Pour location
      address?: string; // Pour location
    };
    uploadedAt: Date;
    uploadedBy: string; // ID de l'utilisateur qui a uploadé
  }[];
}

/**
 * Statut de lecture de message
 */
export interface MessageReadStatus {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

/**
 * Données pour l'envoi d'un message
 */
export interface SendMessageRequest {
  conversationId: string;
  content: string;
  originalLanguage?: string;
  messageType?: MessageType;
  replyToId?: string;
}

/**
 * Données pour la création d'une conversation
 */
export interface CreateConversationRequest {
  type: 'direct' | 'group' | 'public' | 'global';
  title?: string;
  description?: string;
  participantIds?: string[];
  communityId?: string;
}

/**
 * Statistiques de conversation
 */
export interface ConversationStats {
  messagesPerLanguage: Record<string, number>;
  participantCount: number;
  participantsPerLanguage: Record<string, number>;
  onlineUsers: Array<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  }>;
  updatedAt: Date;
}

/**
 * Préférences de conversation
 */
export interface ConversationPreference {
  id: string;
  conversationId: string;
  userId: string;
  key: string;
  value: string;
  valueType: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lien de partage pour accès anonyme à une conversation
 */
export interface ConversationShareLink {
  id: string;
  linkId: string;
  identifier?: string;
  conversationId: string;
  createdBy: string;
  name?: string;
  description?: string;
  maxUses?: number;
  currentUses: number;
  maxConcurrentUsers?: number;
  currentConcurrentUsers: number;
  maxUniqueSessions?: number;
  currentUniqueSessions: number;
  expiresAt?: Date;
  isActive: boolean;
  allowAnonymousMessages: boolean;
  allowAnonymousFiles: boolean;
  allowAnonymousImages: boolean;
  allowViewHistory: boolean;
  requireNickname: boolean;
  requireEmail: boolean;
  allowedCountries: string[];
  allowedLanguages: string[];
  allowedIpRanges: string[];
  createdAt: Date;
  updatedAt: Date;
}
