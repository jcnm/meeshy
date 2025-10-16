/**
 * Types unifiés pour les conversations Meeshy
 * Harmonisation Gateway ↔ Frontend
 */

import type { SocketIOUser as User, MessageType } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';
// UserRole will be defined locally to avoid circular dependency
type UserRole = string;

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

// ===== MESSAGE TYPES CONSOLIDATED =====

/**
 * Type de base pour toutes les traductions
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
  cached: boolean;
}

/**
 * MESSAGE - Type principal pour toutes les communications
 * Utilisé par :
 * - Gateway (API, WebSocket, Socket.IO)
 * - Frontend (affichage, état)
 * - Translator (traitement)
 */
export interface Message {
  // ===== IDENTIFIANTS =====
  id: string;
  conversationId: string;
  senderId?: string;           // ID utilisateur authentifié
  anonymousSenderId?: string;  // ID utilisateur anonyme

  // ===== CONTENU =====
  content: string;
  originalLanguage: string;
  messageType: MessageType;

  // ===== ÉTAT DU MESSAGE =====
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;

  // ===== RÉPONSE =====
  replyToId?: string;
  replyTo?: Message;           // Message de réponse (récursif)

  // ===== PIÈCES JOINTES =====
  attachments?: Array<{
    id: string;
    fileName: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    fileUrl: string;
    thumbnailUrl?: string;
    fileType: 'image' | 'video' | 'audio' | 'document' | 'other';
    metadata?: any;
    createdAt: Date;
  }>;

  // ===== MÉTADONNÉES =====
  createdAt: Date;
  updatedAt?: Date;

  // ===== EXPÉDITEUR =====
  sender?: User | AnonymousParticipant;

  // ===== TRADUCTIONS =====
  translations: MessageTranslation[];

  // ===== COMPATIBILITÉ =====
  timestamp: Date;             // Alias pour createdAt (requis pour compatibilité)

  // ===== PARTICIPANT ANONYME =====
  anonymousSender?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    language: string;
    isMeeshyer: boolean;
  };
}

/**
 * État de traduction dans l'interface utilisateur
 */
export interface UITranslationState {
  language: string;
  content: string;
  status: 'pending' | 'translating' | 'completed' | 'failed';
  timestamp: Date;
  confidence?: number;
  model?: 'basic' | 'medium' | 'premium';
  error?: string;
  fromCache: boolean;
}

/**
 * MESSAGE AVEC TRADUCTIONS - Message enrichi avec traductions et états UI
 * Utilisé par le Frontend pour l'affichage et la gestion des traductions
 */
export interface MessageWithTranslations extends Message {
  // ===== TRADUCTIONS UI =====
  uiTranslations: UITranslationState[];
  translatingLanguages: Set<string>;
  currentDisplayLanguage: string;
  showingOriginal: boolean;
  originalContent: string;

  // ===== ÉTAT DE LECTURE =====
  readStatus?: Array<{ userId: string; readAt: Date }>;

  // ===== MÉTADONNÉES SUPPLÉMENTAIRES =====
  location?: string;

  // ===== PERMISSIONS UI =====
  canEdit: boolean;
  canDelete: boolean;
  canTranslate: boolean;
  canReply: boolean;
}

/**
 * Conversation unifiée
 * Contient TOUS les champs utilisés dans Gateway et Frontend pour compatibilité totale
 */
export interface Conversation {
  // ===== IDENTIFIANTS =====
  id: string;
  identifier?: string;

  // ===== MÉTADONNÉES =====
  title?: string;
  description?: string;
  type: 'direct' | 'group' | 'anonymous' | 'broadcast';
  status: 'active' | 'archived' | 'deleted';
  visibility: 'public' | 'private' | 'restricted';

  // ===== PARTICIPANTS =====
  participants: Array<{
    userId: string;
    role: UserRole;
    joinedAt: Date;
    isActive: boolean;
    permissions?: {
      canInvite: boolean;
      canRemove: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canModerate: boolean;
    };
  }>;

  // ===== MESSAGES =====
  lastMessage?: Message;
  messageCount?: number;
  unreadCount?: number;

  // ===== STATISTIQUES =====
  stats?: ConversationStats;

  // ===== CONFIGURATION =====
  settings?: {
    allowAnonymous: boolean;
    requireApproval: boolean;
    maxParticipants?: number;
    autoArchive?: boolean;
    translationEnabled: boolean;
    defaultLanguage?: string;
    allowedLanguages?: string[];
  };

  // ===== LIENS ET PARTAGE =====
  links?: Array<{
    id: string;
    type: 'invite' | 'share' | 'embed';
    url: string;
    expiresAt?: Date;
    maxUses?: number;
    currentUses: number;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
  }>;

  // ===== TIMESTAMPS =====
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date;

  // ===== CRÉATEUR =====
  createdBy?: string;
  createdByUser?: User;
}

/**
 * Membre d'une conversation (ThreadMember)
 */
export interface ThreadMember {
  id: string;
  conversationId: string;
  userId: string;
  user: User;
  role: UserRole;
  joinedAt: Date;
  isActive: boolean;
  isAnonymous: boolean;
  permissions?: {
    canInvite: boolean;
    canRemove: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerate: boolean;
  };
}

/**
 * Données de traduction reçues via Socket.IO
 */
export interface TranslationData {
  messageId: string;
  translations: Array<{
    targetLanguage: string;
    translatedContent: string;
    confidence?: number;
    model?: 'basic' | 'medium' | 'premium';
    fromCache: boolean;
  }>;
  timestamp: Date;
}

/**
 * Message traduit pour l'affichage
 */
export interface TranslatedMessage extends Message {
  translatedContent?: string;
  targetLanguage?: string;
  translationConfidence?: number;
  translationModel?: 'basic' | 'medium' | 'premium';
  isTranslationCached?: boolean;
}

// ===== SHARE LINK TYPES =====
export interface ConversationShareLink {
  id: string;
  type: 'invite' | 'share' | 'embed';
  url: string;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

// ===== CONVERSATION PARTICIPANT =====
export interface ConversationParticipant {
  userId: string;
  role: UserRole;
  joinedAt: Date;
  isActive: boolean;
  permissions?: {
    canInvite: boolean;
    canRemove: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerate: boolean;
  };
}

// ===== TYPE ALIASES FOR COMPATIBILITY =====
export type BubbleStreamMessage = MessageWithTranslations;