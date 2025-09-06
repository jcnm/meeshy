/**
 * Types partagés Meeshy - Index principal
 * 
 * Centralise tous les types utilisés à travers l'application
 * Gateway, Frontend, et Translator
 */

// ===== NOUVEAUX TYPES UNIFIÉS =====
// Export des types unifiés Phase 1
export * from './conversation';
export * from './user';
export * from './anonymous';
export * from './api-responses';
export * from './migration-utils';

// Export des types unifiés Phase 2 - Messaging
export * from './messaging';

// ===== ÉVÉNEMENTS SOCKET.IO =====
export * from './socketio-events';

// Import pour éviter les conflits de noms
import type { MessageTranslationCache, SocketIOUser, TranslationData, UserPermissions } from './socketio-events';

// Ré-export des types essentiels
export type { TranslationData, MessageTranslationCache, SocketIOUser };

// ===== ENUM DES RÔLES UNIFORMES =====
export enum UserRoleEnum {
  BIGBOSS = 'BIGBOSS',
  ADMIN = 'ADMIN',
  CREATOR = 'CREATOR',
  MODERATOR = 'MODERATOR',
  AUDIT = 'AUDIT',
  ANALYST = 'ANALYST',
  USER = 'USER',
  MEMBER = 'MEMBER'
}

// ===== TYPES SPÉCIFIQUES À LA TRADUCTION =====
export interface TranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelType?: 'basic' | 'medium' | 'premium';
  conversationId?: string;
  participantIds?: string[];
  requestType?: 'conversation_translation' | 'direct_translation' | 'forced_translation';
}

export interface TranslationResponse {
  messageId: string;
  translatedText: string;
  detectedSourceLanguage: string;
  status: number;
  metadata?: {
    confidenceScore: number;
    fromCache: boolean;
    modelUsed: string;
    processingTimeMs?: number;
  };
}

// ===== TYPES DE SERVICE =====
export interface ServiceConfig {
  port: number;
  host: string;
  jwtSecret: string;
  databaseUrl: string;
  translationServicePort?: number;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  connections: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  timestamp: Date;
}

// ===== TYPES POUR L'API REST - LEGACY (DEPRECATED) =====
// Ces types sont remplacés par ceux dans api-responses.ts
// Gardés pour rétrocompatibilité temporaire

export interface LegacyApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends LegacyApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ===== TYPES POUR LES MESSAGES - LEGACY (DEPRECATED) =====
// Ces types sont remplacés par ceux dans conversation.ts
// Gardés pour rétrocompatibilité temporaire

// Importation du nouveau type SocketIOMessage unifié
import type { SocketIOMessage } from './socketio-events';
import type { MessageWithTranslations as UnifiedMessageWithTranslations } from './conversation';

// Alias pour rétrocompatibilité
export type Message = SocketIOMessage;
export type MessageWithTranslations = UnifiedMessageWithTranslations;

export interface BubbleTranslation {
  language: string;
  content: string;
  status: 'pending' | 'translating' | 'completed';
  timestamp: Date;
  confidence: number; // 0-1 pour la qualité de traduction
}

export interface TranslatedMessage extends SocketIOMessage {
  translation?: BubbleTranslation;
  originalContent?: string;
  translatedContent?: string;
  targetLanguage?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  showingOriginal?: boolean;
  translationError?: string;
  translationFailed?: boolean;
  translations?: TranslationData[];
}

export interface Translation {
  language: string;
  content: string;
  flag: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'group_invite' | 'conversation_invite' | 'system' | 'translation_error' | 'user_joined' | 'user_left' | 'typing';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

export type UserRole = UserRoleEnum;

// Utilitaires pour les rôles et permissions
export const ROLE_HIERARCHY: Record<UserRoleEnum, number> = {
  [UserRoleEnum.BIGBOSS]: 7,
  [UserRoleEnum.CREATOR]: 6,
  [UserRoleEnum.ADMIN]: 5,
  [UserRoleEnum.MODERATOR]: 4,
  [UserRoleEnum.AUDIT]: 3,
  [UserRoleEnum.ANALYST]: 2,
  [UserRoleEnum.USER]: 1,
  [UserRoleEnum.MEMBER]: 1,
};

export const DEFAULT_PERMISSIONS: Record<UserRoleEnum, UserPermissions> = {
  [UserRoleEnum.BIGBOSS]: {
    canAccessAdmin: true,
    canManageUsers: true,
    canManageGroups: true,
    canManageConversations: true,
    canViewAnalytics: true,
    canModerateContent: true,
    canViewAuditLogs: true,
    canManageNotifications: true,
    canManageTranslations: true,
  },
  [UserRoleEnum.ADMIN]: {
    canAccessAdmin: true,
    canManageUsers: true,
    canManageGroups: true,
    canManageConversations: true,
    canViewAnalytics: true,
    canModerateContent: true,
    canViewAuditLogs: true,
    canManageNotifications: true,
    canManageTranslations: false,
  },
  [UserRoleEnum.CREATOR]: {
    canAccessAdmin: true,
    canManageUsers: true,
    canManageGroups: true,
    canManageConversations: true,
    canViewAnalytics: true,
    canModerateContent: true,
    canViewAuditLogs: true,
    canManageNotifications: true,
    canManageTranslations: false,
  },
  [UserRoleEnum.MODERATOR]: {
    canAccessAdmin: true,
    canManageUsers: false,
    canManageGroups: true,
    canManageConversations: true,
    canViewAnalytics: false,
    canModerateContent: true,
    canViewAuditLogs: false,
    canManageNotifications: false,
    canManageTranslations: false,
  },
  [UserRoleEnum.AUDIT]: {
    canAccessAdmin: true,
    canManageUsers: false,
    canManageGroups: false,
    canManageConversations: false,
    canViewAnalytics: true,
    canModerateContent: false,
    canViewAuditLogs: true,
    canManageNotifications: false,
    canManageTranslations: false,
  },
  [UserRoleEnum.ANALYST]: {
    canAccessAdmin: true,
    canManageUsers: false,
    canManageGroups: false,
    canManageConversations: false,
    canViewAnalytics: true,
    canModerateContent: false,
    canViewAuditLogs: false,
    canManageNotifications: false,
    canManageTranslations: false,
  },
  [UserRoleEnum.USER]: {
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
  [UserRoleEnum.MEMBER]: {
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
};

// ===== TYPES POUR LES CONVERSATIONS - LEGACY (DEPRECATED) =====
// Ces types sont remplacés par ceux dans conversation.ts
// Gardés pour rétrocompatibilité temporaire

// Importation du nouveau type Conversation unifié
import type { 
  Conversation as UnifiedConversation, 
  ConversationParticipant as UnifiedConversationParticipant 
} from './conversation';

// Alias pour rétrocompatibilité
export interface ThreadMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: Date;
  role: UserRoleEnum;
  user: SocketIOUser;
}

// Alias pour la rétrocompatibilité
export interface ConversationMember extends ThreadMember {}

export type Conversation = UnifiedConversation;
export type ConversationParticipant = UnifiedConversationParticipant;

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: Date;
  role: UserRoleEnum;
  user: SocketIOUser;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  maxMembers?: number;
  createdAt: Date;
  updatedAt: Date;
  members: GroupMember[];
  conversations: Conversation[];
}

export interface ConversationLink {
  id: string;
  conversationId: string;
  linkId: string;
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
  conversation: Conversation;
}

// ===== TYPES POUR L'AUTHENTIFICATION =====
export interface AuthRequest {
  username: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  systemLanguage?: string;
  regionalLanguage?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: SocketIOUser;
  token?: string;
  message?: string;
}

export type AuthMode = 'welcome' | 'login' | 'register' | 'join';

// ===== TYPES POUR LES INDICATEURS =====
export interface TypingIndicator {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  user: SocketIOUser;
}

export interface OnlineStatus {
  userId: string;
  isOnline: boolean;
  lastActiveAt: Date;
}

// ===== TYPES POUR L'ERREUR HANDLING =====
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// ===== CONSTANTES =====
export interface LanguageCode {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  { code: 'auto', name: 'Détection automatique', flag: '🔍' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
];

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

export const TRANSLATION_MODELS = ['basic', 'medium', 'premium'] as const;
export type TranslationModel = typeof TRANSLATION_MODELS[number];

export const MESSAGE_TYPES = ['text', 'image', 'file', 'system'] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

// ===== TYPES POUR LES STATISTIQUES =====
export interface ConnectionStats {
  connectedSockets: number;
  connectedUsers: number;
  activeConversations: number;
  typingUsers: Record<string, number>;
  messagesPerSecond?: number;
  translationsPerSecond?: number;
}

export interface TranslationStats {
  requestsTotal: number;
  requestsSuccess: number;
  requestsError: number;
  cacheHitRate: number;
  averageProcessingTime: number;
  modelUsage: Record<TranslationModel, number>;
}

// ===== TYPES POUR MISE À JOUR UTILISATEUR =====
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  systemLanguage?: string;
  regionalLanguage?: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled?: boolean;
  translateToSystemLanguage?: boolean;
  translateToRegionalLanguage?: boolean;
  useCustomDestination?: boolean;
}

export interface UpdateUserResponse {
  success: boolean;
  data?: Partial<SocketIOUser>;
  error?: string;
  message?: string;
}

// ===== TYPES POUR LES REQUÊTES =====
export interface CreateConversationRequest {
  name: string;
  description?: string;
  isPrivate?: boolean;
  maxMembers?: number;
  participantIds?: string[];
  participants?: string[]; // Alias pour la rétrocompatibilité
  isGroup?: boolean;
}

export interface SendMessageRequest {
  content: string;
  originalLanguage?: string;
  messageType?: string;
}

// ===== RE-EXPORTS POUR RÉTROCOMPATIBILITÉ =====
export type {
  SocketIOMessage,
  SocketIOUser as User,
  SocketIOResponse as SocketResponse,
  MessageTranslationCache as TranslationCache,
  UserLanguageConfig,
  ConnectionStatus,
  ConnectionDiagnostics,
  UserPermissions
} from './socketio-events';
