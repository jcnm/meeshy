/**
 * Types partagés Meeshy - Index principal
 *
 * Centralise tous les types utilisés à travers l'application
 * Gateway, Frontend, et Translator
 */
export * from './conversation';
export * from './user';
export * from './anonymous';
export * from './api-responses';
export * from './migration-utils';
export * from './messaging';
export * from './affiliate';
export * from './socketio-events';
import type { MessageTranslationCache, SocketIOUser, TranslationData, UserPermissions } from './socketio-events';
export type { TranslationData, MessageTranslationCache, SocketIOUser };
export declare enum UserRoleEnum {
    BIGBOSS = "BIGBOSS",
    ADMIN = "ADMIN",
    CREATOR = "CREATOR",
    MODERATOR = "MODERATOR",
    AUDIT = "AUDIT",
    ANALYST = "ANALYST",
    USER = "USER",
    MEMBER = "MEMBER"
}
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
import type { Message as ConsolidatedMessage, MessageWithTranslations as ConsolidatedMessageWithTranslations } from './conversation';
export type Message = ConsolidatedMessage;
export type MessageWithTranslations = ConsolidatedMessageWithTranslations;
export interface BubbleTranslation {
    language: string;
    content: string;
    status: 'pending' | 'translating' | 'completed';
    timestamp: Date;
    confidence: number;
}
export interface TranslatedMessage {
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
export declare const ROLE_HIERARCHY: Record<UserRoleEnum, number>;
export declare const DEFAULT_PERMISSIONS: Record<UserRoleEnum, UserPermissions>;
import type { Conversation as UnifiedConversation, ConversationParticipant as UnifiedConversationParticipant } from './conversation';
export interface ThreadMember {
    id: string;
    conversationId: string;
    userId: string;
    joinedAt: Date;
    role: UserRoleEnum;
    conversationRole?: UserRoleEnum;
    user: SocketIOUser;
}
export interface ConversationMember extends ThreadMember {
}
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
export declare const SUPPORTED_LANGUAGES: readonly [{
    readonly code: "fr";
    readonly name: "Français";
    readonly flag: "🇫🇷";
    readonly color: "bg-blue-500";
    readonly translateText: "Traduire ce message en français";
}, {
    readonly code: "en";
    readonly name: "English";
    readonly flag: "🇬🇧";
    readonly color: "bg-red-500";
    readonly translateText: "Translate this message to English";
}, {
    readonly code: "es";
    readonly name: "Español";
    readonly flag: "🇪🇸";
    readonly color: "bg-yellow-500";
    readonly translateText: "Traducir este mensaje al español";
}, {
    readonly code: "de";
    readonly name: "Deutsch";
    readonly flag: "🇩🇪";
    readonly color: "bg-gray-800";
    readonly translateText: "Diese Nachricht ins Deutsche übersetzen";
}, {
    readonly code: "pt";
    readonly name: "Português";
    readonly flag: "🇵🇹";
    readonly color: "bg-green-500";
    readonly translateText: "Traduzir esta mensagem para português";
}, {
    readonly code: "zh";
    readonly name: "中文";
    readonly flag: "🇨🇳";
    readonly color: "bg-red-600";
    readonly translateText: "将此消息翻译成中文";
}, {
    readonly code: "ja";
    readonly name: "日本語";
    readonly flag: "🇯🇵";
    readonly color: "bg-white border";
    readonly translateText: "このメッセージを日本語に翻訳";
}, {
    readonly code: "ar";
    readonly name: "العربية";
    readonly flag: "🇸🇦";
    readonly color: "bg-green-600";
    readonly translateText: "ترجمة هذه الرسالة إلى العربية";
}];
export interface LanguageCode {
    code: string;
    name: string;
    flag: string;
    translateText: string;
}
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
 * Obtient les informations complètes d'une langue par son code
 * Version optimisée avec cache et fallback robuste
 */
export declare function getLanguageInfo(code: string | undefined): SupportedLanguageInfo;
/**
 * Obtient le nom d'une langue par son code
 */
export declare function getLanguageName(code: string | undefined): string;
/**
 * Obtient le drapeau d'une langue par son code
 */
export declare function getLanguageFlag(code: string | undefined): string;
/**
 * Obtient la couleur d'une langue par son code
 */
export declare function getLanguageColor(code: string | undefined): string;
/**
 * Obtient le texte de traduction d'une langue par son code
 */
export declare function getLanguageTranslateText(code: string | undefined): string;
/**
 * Vérifie si un code de langue est supporté
 */
export declare function isSupportedLanguage(code: string | undefined): boolean;
/**
 * Obtient tous les codes de langue supportés
 */
export declare function getSupportedLanguageCodes(): string[];
/**
 * Filtre les langues supportées selon un critère
 */
export declare function filterSupportedLanguages(predicate: (lang: SupportedLanguageInfo) => boolean): SupportedLanguageInfo[];
export declare const TRANSLATION_MODELS: readonly ["basic", "medium", "premium"];
export type TranslationModel = typeof TRANSLATION_MODELS[number];
export declare const MESSAGE_TYPES: readonly ["text", "image", "file", "system"];
export type MessageType = typeof MESSAGE_TYPES[number];
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
export interface CreateConversationRequest {
    name: string;
    description?: string;
    isPrivate?: boolean;
    maxMembers?: number;
    participantIds?: string[];
    participants?: string[];
    isGroup?: boolean;
}
export interface SendMessageRequest {
    content: string;
    originalLanguage?: string;
    messageType?: string;
}
export type { SocketIOMessage, SocketIOUser as User, SocketIOResponse as SocketResponse, MessageTranslationCache as TranslationCache, UserLanguageConfig, ConnectionStatus, ConnectionDiagnostics, UserPermissions } from './socketio-events';
//# sourceMappingURL=index.d.ts.map