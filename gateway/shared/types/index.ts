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

// Message types are now consolidated

// Export des types unifiés Phase 2 - Messaging
export * from './messaging';

// Export des types unifiés Phase 3 - Affiliate
export * from './affiliate';

// Export des types unifiés Phase 4 - Tracking Links
export * from './tracking-link';

// Export des types unifiés Phase 5 - Attachments
export * from './attachment';

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

// Legacy API types removed - use api-responses.ts instead

// ===== TYPES POUR LES MESSAGES - LEGACY (DEPRECATED) =====
// Ces types sont remplacés par ceux dans conversation.ts
// Gardés pour rétrocompatibilité temporaire

// Importation des types de messages consolidés
import type { Message as ConsolidatedMessage, MessageWithTranslations as ConsolidatedMessageWithTranslations } from './conversation';

// Alias pour rétrocompatibilité
export type Message = ConsolidatedMessage;
export type MessageWithTranslations = ConsolidatedMessageWithTranslations;

export interface BubbleTranslation {
  language: string;
  content: string;
  status: 'pending' | 'translating' | 'completed';
  timestamp: Date;
  confidence: number; // 0-1 pour la qualité de traduction
}

export interface TranslatedMessage {
  // Core message properties
  id: string;
  conversationId: string;
  senderId?: string;
  anonymousSenderId?: string;
  content: string;
  originalLanguage: string;
  messageType: any;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  replyToId?: string;
  createdAt: Date;
  updatedAt?: Date;
  timestamp: Date;
  sender?: any;
  anonymousSender?: any;
  
  // Translation-specific properties
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
  role: UserRoleEnum; // Rôle global de l'utilisateur
  conversationRole?: UserRoleEnum; // Rôle dans cette conversation spécifique
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
  creator?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName: string;
    avatar?: string;
  };
  stats?: {
    totalParticipants: number;
    memberCount: number;
    anonymousCount: number;
    languageCount: number;
    spokenLanguages: string[];
  };
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
// Langues supportées avec définition complète
export const SUPPORTED_LANGUAGES = [
  { 
    code: 'fr', 
    name: 'Français', 
    flag: '🇫🇷', 
    color: 'bg-blue-500',
    translateText: 'Traduire ce message en français' 
  },
  { 
    code: 'en', 
    name: 'English', 
    flag: '🇬🇧', 
    color: 'bg-red-500',
    translateText: 'Translate this message to English' 
  },
  { 
    code: 'es', 
    name: 'Español', 
    flag: '🇪🇸', 
    color: 'bg-yellow-500',
    translateText: 'Traducir este mensaje al español' 
  },
  { 
    code: 'de', 
    name: 'Deutsch', 
    flag: '🇩🇪', 
    color: 'bg-gray-800',
    translateText: 'Diese Nachricht ins Deutsche übersetzen' 
  },
  { 
    code: 'pt', 
    name: 'Português', 
    flag: '🇵🇹', 
    color: 'bg-green-500',
    translateText: 'Traduzir esta mensagem para português' 
  },
  { 
    code: 'zh', 
    name: '中文', 
    flag: '🇨🇳', 
    color: 'bg-red-600',
    translateText: '将此消息翻译成中文' 
  },
  { 
    code: 'ja', 
    name: '日本語', 
    flag: '🇯🇵', 
    color: 'bg-white border',
    translateText: 'このメッセージを日本語に翻訳' 
  },
  { 
    code: 'ar', 
    name: 'العربية', 
    flag: '🇸🇦', 
    color: 'bg-green-600',
    translateText: 'ترجمة هذه الرسالة إلى العربية' 
  },
] as const;

// Maintenir la compatibilité avec l'ancien type LanguageCode
export interface LanguageCode {
  code: string;
  name: string;
  flag: string;
  translateText: string;
}

// Type pour les codes de langue supportés
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

/**
 * Interface complète pour une langue supportée (avec toutes les propriétés)
 */
export interface SupportedLanguageInfo {
  code: string;
  name: string;
  flag: string;
  color?: string;
  translateText?: string;
}

/**
 * Cache pour améliorer les performances des recherches répétées
 */
const languageCache = new Map<string, typeof SUPPORTED_LANGUAGES[number]>();

/**
 * Initialise le cache des langues
 */
function initializeLanguageCache() {
  if (languageCache.size === 0) {
    SUPPORTED_LANGUAGES.forEach(lang => {
      languageCache.set(lang.code, lang);
    });
  }
}

/**
 * Obtient les informations complètes d'une langue par son code
 * Version optimisée avec cache et fallback robuste
 */
export function getLanguageInfo(code: string | undefined): SupportedLanguageInfo {
  // Initialiser le cache si nécessaire
  initializeLanguageCache();
  
  // Gérer les cas edge
  if (!code || code.trim() === '' || code === 'unknown') {
    return { 
      code: 'fr', 
      name: 'Français', 
      flag: '🇫🇷', 
      color: 'bg-blue-500',
      translateText: 'Traduire ce message en français' 
    };
  }
  
  // Normaliser le code (minuscules, trim)
  const normalizedCode = code.toLowerCase().trim();
  
  // Recherche dans le cache
  const found = languageCache.get(normalizedCode);
  if (found) {
    return found;
  }
  
  // Fallback: créer un objet pour langues non supportées
  return { 
    code: normalizedCode, 
    name: normalizedCode.toUpperCase(), 
    flag: '🌐',
    color: 'bg-gray-500',
    translateText: `Translate this message to ${normalizedCode}`
  };
}

/**
 * Obtient le nom d'une langue par son code
 */
export function getLanguageName(code: string | undefined): string {
  const lang = getLanguageInfo(code);
  return lang.name;
}

/**
 * Obtient le drapeau d'une langue par son code
 */
export function getLanguageFlag(code: string | undefined): string {
  const lang = getLanguageInfo(code);
  return lang.flag;
}

/**
 * Obtient la couleur d'une langue par son code
 */
export function getLanguageColor(code: string | undefined): string {
  const lang = getLanguageInfo(code);
  return lang.color || 'bg-gray-500';
}

/**
 * Obtient le texte de traduction d'une langue par son code
 */
export function getLanguageTranslateText(code: string | undefined): string {
  const lang = getLanguageInfo(code);
  return lang.translateText || `Translate this message to ${lang.name}`;
}

/**
 * Vérifie si un code de langue est supporté
 */
export function isSupportedLanguage(code: string | undefined): boolean {
  if (!code) return false;
  initializeLanguageCache();
  return languageCache.has(code.toLowerCase().trim());
}

/**
 * Obtient tous les codes de langue supportés
 */
export function getSupportedLanguageCodes(): string[] {
  return SUPPORTED_LANGUAGES.map(lang => lang.code);
}

/**
 * Filtre les langues supportées selon un critère
 */
export function filterSupportedLanguages(
  predicate: (lang: SupportedLanguageInfo) => boolean
): SupportedLanguageInfo[] {
  return SUPPORTED_LANGUAGES.filter(predicate);
}

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
