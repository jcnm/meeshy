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

// Import pour usage interne
import type { AnonymousParticipant } from './anonymous';

// Message types are now consolidated

// Export des types unifiés Phase 2 - Messaging
export * from './messaging';

// Export des types unifiés Phase 3 - Affiliate
export * from './affiliate';

// Export des types unifiés Phase 4 - Tracking Links
export * from './tracking-link';

// Export des types unifiés Phase 5 - Attachments
export * from './attachment';

// Export des types unifiés Phase 6 - Video Calls
export * from './video-call';
export * from './attachment';

// Export des types communauté
export * from './community';

// Export des types réactions
export * from './reaction';

// Export des types d'erreurs
export * from './errors';

// Export des types signalement
export * from './report';

// Export des types de préférences utilisateur
export * from './user-preferences';

// ===== UTILITAIRES PARTAGÉS =====
export * from '../utils';

// ===== ÉVÉNEMENTS SOCKET.IO =====
export * from './socketio-events';

// Import pour éviter les conflits de noms
import type { MessageTranslationCache, SocketIOUser, TranslationData, UserPermissions } from './socketio-events';

// Ré-export des types essentiels
export type { TranslationData, MessageTranslationCache, SocketIOUser };

// ===== ENUM DES RÔLES UNIFORMES =====
/**
 * Rôles globaux des utilisateurs (aligné avec schema.prisma User.role)
 * @see shared/schema.prisma ligne 35
 */
export enum UserRoleEnum {
  BIGBOSS = 'BIGBOSS',
  ADMIN = 'ADMIN',
  MODO = 'MODO',        // Moderator global (schema.prisma)
  AUDIT = 'AUDIT',
  ANALYST = 'ANALYST',
  USER = 'USER',
  // Aliases pour rétrocompatibilité
  MODERATOR = 'MODO',   // Alias de MODO
  CREATOR = 'ADMIN',    // Alias de ADMIN (créateur de communauté)
  MEMBER = 'USER'       // Alias de USER (membre standard)
}

/**
 * Rôles dans une conversation ou communauté (aligné avec ConversationMember.role)
 * @see shared/schema.prisma ligne 94
 */
export type ConversationRole = 'admin' | 'moderator' | 'member';

// ===== TYPES SPÉCIFIQUES À LA TRADUCTION =====
export interface TranslationRequest {
  messageId: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelType?: 'basic' | 'medium' | 'premium';
  conversationId?: string;
  participantIds?: string[];
  requestType?: 'conversation' | 'direct' | 'forced' | 'batch';
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
  translationModel?: 'basic' | 'medium' | 'premium'; // Modèle utilisé pour cette traduction
  cached?: boolean; // Indique si la traduction vient du cache
}

/**
 * Types de notification supportés
 */
export type NotificationType = 
  | 'message' 
  | 'group_invite' 
  | 'conversation_invite' 
  | 'system' 
  | 'translation_error' 
  | 'user_joined' 
  | 'user_left' 
  | 'typing';

/**
 * Message traduit (legacy, utiliser MessageWithTranslations à la place)
 * @deprecated Utilisez les types de message-types.ts
 */
export interface TranslatedMessage {
  // Core message properties
  readonly id: string;
  readonly conversationId: string;
  readonly senderId?: string;
  readonly anonymousSenderId?: string;
  readonly content: string;
  readonly originalLanguage: string;
  readonly messageType: MessageType;
  readonly isEdited: boolean;
  readonly editedAt?: Date;
  readonly isDeleted: boolean;
  readonly deletedAt?: Date;
  readonly replyToId?: string;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly timestamp: Date;
  readonly sender?: SocketIOUser | AnonymousParticipant;
  readonly anonymousSender?: AnonymousParticipant;
  
  // Translation-specific properties
  readonly translation?: BubbleTranslation;
  readonly originalContent?: string;
  readonly translatedContent?: string;
  readonly targetLanguage?: string;
  readonly isTranslated?: boolean;
  readonly isTranslating?: boolean;
  readonly showingOriginal?: boolean;
  readonly translationError?: string;
  readonly translationFailed?: boolean;
  readonly translations?: readonly TranslationData[];
}

/**
 * Traduction simple
 */
export interface Translation {
  readonly language: string;
  readonly content: string;
  readonly flag: string;
  readonly createdAt: Date;
}

/**
 * Notification utilisateur
 */
export interface Notification {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly isRead: boolean;
  readonly data?: Readonly<Record<string, string | number | boolean | null>>;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

export type UserRole = UserRoleEnum;

// Utilitaires pour les rôles et permissions
export const ROLE_HIERARCHY: Readonly<Record<string, number>> = {
  [UserRoleEnum.BIGBOSS]: 7,
  [UserRoleEnum.ADMIN]: 5,
  [UserRoleEnum.MODO]: 4,
  [UserRoleEnum.AUDIT]: 3,
  [UserRoleEnum.ANALYST]: 2,
  [UserRoleEnum.USER]: 1,
  // Aliases ne sont pas inclus dans le record car ils pointent vers les mêmes valeurs
  // Pour récupérer la hiérarchie d'un alias, utilisez la valeur de l'enum directement
};

export const DEFAULT_PERMISSIONS: Readonly<Record<string, UserPermissions>> = {
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
  [UserRoleEnum.MODO]: {
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
  // Aliases ne sont pas inclus car ils retournent les mêmes valeurs string que les rôles principaux
};

// ===== TYPES POUR LES CONVERSATIONS - LEGACY (DEPRECATED) =====
// Ces types sont remplacés par ceux dans conversation.ts
// Gardés pour rétrocompatibilité temporaire

// Importation des types unifiés depuis conversation.ts
import type { 
  Conversation as UnifiedConversation, 
  ConversationParticipant as UnifiedConversationParticipant,
  ThreadMember as UnifiedThreadMember
} from './conversation';

// Export des types unifiés (plus de duplication)
export type ThreadMember = UnifiedThreadMember;
export type ConversationMember = UnifiedThreadMember; // Alias pour rétrocompatibilité
export type Conversation = UnifiedConversation;
export type ConversationParticipant = UnifiedConversationParticipant;

/**
 * Membre d'un groupe
 */
export interface GroupMember {
  readonly id: string;
  readonly groupId: string;
  readonly userId: string;
  readonly joinedAt: Date;
  readonly role: UserRoleEnum;
  readonly user: SocketIOUser;
}

/**
 * Groupe de conversations
 */
export interface Group {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly isPrivate: boolean;
  readonly maxMembers?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly members: readonly GroupMember[];
  readonly conversations: readonly Conversation[];
}

/**
 * Informations du créateur d'un lien
 */
export interface LinkCreatorInfo {
  readonly id: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly avatar?: string;
}

/**
 * Statistiques d'un lien de conversation
 */
export interface ConversationLinkStats {
  readonly totalParticipants: number;
  readonly memberCount: number;
  readonly anonymousCount: number;
  readonly languageCount: number;
  readonly spokenLanguages: readonly string[];
}

/**
 * Lien de partage de conversation
 */
export interface ConversationLink {
  readonly id: string;
  readonly conversationId: string;
  readonly linkId: string;
  readonly name?: string;
  readonly description?: string;
  readonly maxUses?: number;
  readonly currentUses: number;
  readonly maxConcurrentUsers?: number;
  readonly currentConcurrentUsers: number;
  readonly maxUniqueSessions?: number;
  readonly currentUniqueSessions: number;
  readonly expiresAt?: Date;
  readonly isActive: boolean;
  readonly allowAnonymousMessages: boolean;
  readonly allowAnonymousFiles: boolean;
  readonly allowAnonymousImages: boolean;
  readonly allowViewHistory: boolean;
  readonly requireNickname: boolean;
  readonly requireEmail: boolean;
  readonly allowedCountries: readonly string[];
  readonly allowedLanguages: readonly string[];
  readonly allowedIpRanges: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly conversation: Conversation;
  readonly creator?: LinkCreatorInfo;
  readonly stats?: ConversationLinkStats;
}

// ===== TYPES POUR L'AUTHENTIFICATION =====

/**
 * Requête d'authentification
 */
export interface AuthRequest {
  readonly username: string;
  readonly password?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly systemLanguage?: string;
  readonly regionalLanguage?: string;
}

/**
 * Réponse d'authentification
 */
export interface AuthResponse {
  readonly success: boolean;
  readonly user?: SocketIOUser;
  readonly token?: string;
  readonly message?: string;
}

/**
 * Modes d'authentification
 */
export type AuthMode = 'welcome' | 'login' | 'register' | 'join';

// ===== TYPES POUR LES INDICATEURS =====

/**
 * Indicateur de frappe
 */
export interface TypingIndicator {
  readonly userId: string;
  readonly conversationId: string;
  readonly isTyping: boolean;
  readonly user: SocketIOUser;
}

/**
 * Statut en ligne d'un utilisateur
 */
export interface OnlineStatus {
  readonly userId: string;
  readonly isOnline: boolean;
  readonly lastActiveAt: Date;
}

// ===== TYPES POUR L'ERREUR HANDLING =====

/**
 * Réponse d'erreur standardisée
 */
export interface ErrorResponse {
  readonly success: false;
  readonly error: string;
  readonly code?: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
  readonly timestamp: Date;
}

/**
 * Erreur de validation
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly value?: string | number | boolean | null;
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

/**
 * Types de messages supportés (aligné avec schema.prisma)
 * @see shared/schema.prisma ligne 184
 */
export const MESSAGE_TYPES = ['text', 'image', 'file', 'audio', 'video', 'location', 'system'] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

// ===== TYPES POUR LES STATISTIQUES =====

/**
 * Statistiques de connexion
 */
export interface ConnectionStats {
  readonly connectedSockets: number;
  readonly connectedUsers: number;
  readonly activeConversations: number;
  readonly typingUsers: Readonly<Record<string, number>>;
  readonly messagesPerSecond?: number;
  readonly translationsPerSecond?: number;
}

/**
 * Statistiques de traduction
 */
export interface TranslationStats {
  readonly requestsTotal: number;
  readonly requestsSuccess: number;
  readonly requestsError: number;
  readonly cacheHitRate: number;
  readonly averageProcessingTime: number;
  readonly modelUsage: Readonly<Record<TranslationModel, number>>;
}

// ===== TYPES POUR MISE À JOUR UTILISATEUR =====

/**
 * Requête de mise à jour utilisateur
 */
export interface UpdateUserRequest {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly systemLanguage?: string;
  readonly regionalLanguage?: string;
  readonly customDestinationLanguage?: string;
  readonly autoTranslateEnabled?: boolean;
  readonly translateToSystemLanguage?: boolean;
  readonly translateToRegionalLanguage?: boolean;
  readonly useCustomDestination?: boolean;
}

/**
 * Réponse de mise à jour utilisateur
 */
export interface UpdateUserResponse {
  readonly success: boolean;
  readonly data?: Partial<SocketIOUser>;
  readonly error?: string;
  readonly message?: string;
}

// ===== TYPES POUR LES REQUÊTES =====

/**
 * Requête de création de conversation
 */
export interface CreateConversationRequest {
  readonly type: 'direct' | 'group' | 'public' | 'global';
  readonly name?: string;
  readonly title?: string; // Alias pour name
  readonly description?: string;
  readonly isPrivate?: boolean;
  readonly maxMembers?: number;
  readonly participantIds?: readonly string[];
  readonly participants?: readonly string[]; // Alias pour la rétrocompatibilité
  readonly communityId?: string;
  readonly identifier?: string;
}

/**
 * Requête d'envoi de message
 */
export interface SendMessageRequest {
  readonly content: string;
  readonly originalLanguage?: string;
  readonly messageType?: string;
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
