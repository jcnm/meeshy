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
import type { SocketIOMessage } from './socketio-events';
import type { MessageWithTranslations as UnifiedMessageWithTranslations } from './conversation';
export type Message = import('./conversation').Message;
export type MessageWithTranslations = UnifiedMessageWithTranslations;
export interface BubbleTranslation {
    language: string;
    content: string;
    status: 'pending' | 'translating' | 'completed';
    timestamp: Date;
    confidence: number;
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
export interface LanguageCode {
    code: string;
    name: string;
    flag: string;
}
export declare const SUPPORTED_LANGUAGES: LanguageCode[];
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];
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