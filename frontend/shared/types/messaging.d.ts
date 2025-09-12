/**
 * Types pour le messaging - Phase 2.1
 *
 * Interfaces de requête/réponse pour l'envoi de messages
 * Gateway WebSocket ↔ Frontend communication
 */
import type { SocketIOMessage as Message, ApiResponse, ConversationStats } from './index';
/**
 * Types d'authentification supportés
 */
export type AuthenticationType = 'jwt' | 'session' | 'anonymous';
/**
 * Context d'authentification pour une requête
 */
export interface AuthenticationContext {
    type: AuthenticationType;
    userId?: string;
    sessionToken?: string;
    jwtToken?: string;
    isAnonymous: boolean;
}
/**
 * Format pour toutes les requêtes d'envoi de message
 * Remplace les formats séparés REST/WebSocket
 */
export interface MessageRequest {
    conversationId: string;
    content: string;
    originalLanguage?: string;
    messageType?: string;
    replyToId?: string;
    isAnonymous?: boolean;
    anonymousDisplayName?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    encrypted?: boolean;
    attachments?: MessageAttachment[];
    translationPreferences?: {
        disableAutoTranslation?: boolean;
        targetLanguages?: string[];
        modelType?: 'basic' | 'medium' | 'premium';
    };
    authContext?: AuthenticationContext;
    metadata?: {
        source?: 'websocket' | 'rest' | 'api';
        socketId?: string;
        clientTimestamp?: number;
        requestId?: string;
        userAgent?: string;
    };
}
/**
 * Pièce jointe de message
 */
export interface MessageAttachment {
    id: string;
    type: 'image' | 'file' | 'audio' | 'video' | 'link';
    url: string;
    filename?: string;
    size?: number;
    mimeType?: string;
    thumbnail?: string;
}
/**
 * Statut de traduction pour un message
 */
export interface TranslationStatus {
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cached';
    languagesRequested: string[];
    languagesCompleted: string[];
    languagesFailed: string[];
    estimatedCompletionTime?: number;
    cacheHitRate?: number;
    model?: 'basic' | 'medium' | 'premium';
}
/**
 * Statut de livraison pour un message
 */
export interface DeliveryStatus {
    status: 'sent' | 'delivered' | 'read' | 'failed';
    sentAt: Date;
    deliveredAt?: Date;
    readAt?: Date;
    failedAt?: Date;
    recipientCount: number;
    deliveredCount: number;
    readCount: number;
    recipientDetails?: Array<{
        userId: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: Date;
    }>;
}
/**
 * Metadata complète pour une réponse de message
 */
export interface MessageResponseMetadata {
    conversationStats?: ConversationStats;
    translationStatus?: TranslationStatus;
    deliveryStatus?: DeliveryStatus;
    performance?: {
        processingTime: number;
        dbQueryTime: number;
        translationQueueTime: number;
        validationTime: number;
    };
    context?: {
        isFirstMessage: boolean;
        triggerNotifications: boolean;
        mentionedUsers: string[];
        containsLinks: boolean;
        spamScore?: number;
    };
    debug?: {
        requestId: string;
        serverTime: Date;
        userId: string;
        conversationId: string;
        messageId: string;
        error?: string;
        stack?: string;
        socketId?: string;
        source?: string;
        [key: string]: any;
    };
}
/**
 * Réponse pour l'envoi de messages
 * Étend ApiResponse avec metadata complète
 */
export interface MessageResponse extends ApiResponse<Message> {
    data: Message;
    metadata: MessageResponseMetadata;
}
/**
 * Format d'événement WebSocket pour l'envoi de message
 */
export interface MessageSendEvent {
    type: 'message:send';
    payload: MessageRequest;
    requestId?: string;
}
/**
 * Format de callback/ACK WebSocket
 */
export interface MessageSendCallback {
    (response: MessageResponse): void;
}
/**
 * Événement de diffusion temps réel vers autres clients
 */
export interface MessageBroadcastEvent {
    type: 'message:new';
    payload: {
        message: Message;
        conversationId: string;
        targetLanguage: string;
        metadata: Omit<MessageResponseMetadata, 'debug'>;
    };
}
/**
 * Résultat de validation pour une requête de message
 */
export interface MessageValidationResult {
    isValid: boolean;
    errors: Array<{
        field: keyof MessageRequest;
        message: string;
        code: string;
    }>;
    warnings?: Array<{
        field: keyof MessageRequest;
        message: string;
        code: string;
    }>;
}
/**
 * Résultat de vérification des permissions
 */
export interface MessagePermissionResult {
    canSend: boolean;
    canSendAnonymous?: boolean;
    canAttachFiles?: boolean;
    canMentionUsers?: boolean;
    canUseHighPriority?: boolean;
    restrictions?: {
        maxContentLength?: number;
        maxAttachments?: number;
        allowedAttachmentTypes?: string[];
        rateLimitRemaining?: number;
    };
    reason?: string;
}
//# sourceMappingURL=messaging.d.ts.map