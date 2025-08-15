/**
 * Types partagés Meeshy - Index principal
 * 
 * Centralise tous les types utilisés à travers l'application
 * Gateway, Frontend, et Translator
 */

// ===== ÉVÉNEMENTS SOCKET.IO =====
export * from './socketio-events';

// Import pour éviter les conflits de noms
import type { MessageTranslationCache, SocketIOUser, TranslationData, UserPermissions } from './socketio-events';

// Ré-export des types essentiels
export type { TranslationData, MessageTranslationCache, SocketIOUser };

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

// ===== TYPES POUR L'API REST =====
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ===== TYPES POUR LES MESSAGES =====
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  originalLanguage: string;
  messageType: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender?: SocketIOUser;
}

export interface MessageWithTranslations extends Message {
  translations?: MessageTranslationCache[];
}

export interface BubbleTranslation {
  language: string;
  content: string;
  status: 'pending' | 'translating' | 'completed';
  timestamp: Date;
  confidence: number; // 0-1 pour la qualité de traduction
}

export interface TranslatedMessage extends Message {
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

export type UserRole = 'BIGBOSS' | 'ADMIN' | 'MODO' | 'AUDIT' | 'ANALYST' | 'USER';

// Utilitaires pour les rôles et permissions
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  BIGBOSS: 6,
  ADMIN: 5,
  MODO: 4,
  AUDIT: 3,
  ANALYST: 2,
  USER: 1,
};

export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  BIGBOSS: {
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
  ADMIN: {
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
  MODO: {
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
  AUDIT: {
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
  ANALYST: {
    canAccessAdmin: false,
    canManageUsers: false,
    canManageGroups: false,
    canManageConversations: false,
    canViewAnalytics: true,
    canModerateContent: false,
    canViewAuditLogs: false,
    canManageNotifications: false,
    canManageTranslations: false,
  },
  USER: {
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

// ===== TYPES POUR LES CONVERSATIONS =====
export interface ThreadMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: Date;
  role: 'ADMIN' | 'MEMBER';
  user: SocketIOUser;
}

// Alias pour la rétrocompatibilité
export interface ConversationMember extends ThreadMember {}

export interface Conversation {
  id: string;
  type: string;
  title?: string;
  name?: string;
  description?: string;
  groupId?: string; // Référence au groupe si c'est une conversation de groupe
  isGroup?: boolean;
  isPrivate?: boolean;
  isActive: boolean;
  maxMembers?: number;
  createdAt: Date;
  updatedAt: Date;
  participants?: ThreadMember[];
  messages?: Message[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: Date;
  role: 'ADMIN' | 'MEMBER';
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

export interface ConversationParticipant {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isOnline: boolean;
  role: string;
}

export interface ConversationLink {
  id: string;
  conversationId: string;
  linkId: string;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
  createdAt: Date;
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
