/**
 * Types partagés Meeshy - Index principal
 *
 * Centralise tous les types utilisés à travers l'application
 * Gateway, Frontend, et Translator
 */
export * from './socketio-events';
import type { MessageTranslationCache, SocketIOUser, TranslationData } from './socketio-events';
export type { TranslationData, MessageTranslationCache, SocketIOUser };
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
export interface MessageWithTranslations {
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
    translations?: MessageTranslationCache[];
    sender?: SocketIOUser;
}
export interface ConversationMember {
    userId: string;
    conversationId: string;
    role: 'admin' | 'member';
    joinedAt: Date;
    leftAt?: Date;
    user: SocketIOUser;
}
export interface Conversation {
    id: string;
    name?: string;
    type: 'private' | 'group';
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    members: ConversationMember[];
    lastMessage?: MessageWithTranslations;
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
export declare const SUPPORTED_LANGUAGES: readonly ["fr", "en", "es", "de", "pt", "zh", "ja", "ar", "it", "ru"];
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
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
export type { SocketIOMessage as Message, SocketIOUser as User, SocketIOResponse as SocketResponse, MessageTranslationCache as TranslationCache, UserLanguageConfig, ConnectionStatus, ConnectionDiagnostics } from './socketio-events';
//# sourceMappingURL=index.d.ts.map