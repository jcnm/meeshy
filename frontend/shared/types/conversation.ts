/**
 * Types unifiés pour les conversations Meeshy
 * Harmonisation Gateway ↔ Frontend
 */

import type { SocketIOUser as User, MessageType, SocketIOMessage } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';
import { UserRole } from '.';

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
 * Message unifié entre Gateway et Frontend
 * Contient TOUS les champs des anciens types pour compatibilité
 * Utilise maintenant SocketIOMessage comme base
 */
export interface Message extends SocketIOMessage {
  // Champs additionnels pour compatibilité
  timestamp: Date;  // Alias pour createdAt
  
  // Union type pour sender (authentifié ou anonyme)
  sender?: User | AnonymousParticipant;
  
  // Champ pour compatibilité avec l'ancien système
  anonymousSender?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    language: string;
    isMeeshyer: boolean; // false pour les anonymes
  };
  
  // Référence au message de réponse
  replyTo?: Message;
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
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
  participants: ConversationParticipant[];
  unreadCount?: number;
  
  // Champs additionnels pour compatibilité
  messages?: Message[];  // Pour certains usages frontend
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
  role: UserRole;
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
export interface MessageWithTranslations extends Message {
  translations: MessageTranslation[];
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
