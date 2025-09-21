/**
 * Types unifiés pour les conversations Meeshy
 * Harmonisation Gateway ↔ Frontend
 */
import type { SocketIOUser as User, MessageType } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';
type UserRole = string;
/**
 * Statistiques d'une conversation
 */
export interface ConversationStats {
    totalMessages: number;
    totalParticipants: number;
    activeParticipants: number;
    messagesLast24h: number;
    messagesLast7days: number;
    averageResponseTime: number;
    topLanguages: Array<{
        language: string;
        messageCount: number;
        percentage: number;
    }>;
    translationStats: {
        totalTranslations: number;
        cacheHitRate: number;
        averageTranslationTime: number;
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
    id: string;
    identifier?: string;
}
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
    id: string;
    conversationId: string;
    senderId?: string;
    anonymousSenderId?: string;
    content: string;
    originalLanguage: string;
    messageType: MessageType;
    isEdited: boolean;
    editedAt?: Date;
    isDeleted: boolean;
    deletedAt?: Date;
    replyToId?: string;
    replyTo?: Message;
    createdAt: Date;
    updatedAt?: Date;
    sender?: User | AnonymousParticipant;
    translations: MessageTranslation[];
    timestamp: Date;
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
    uiTranslations: UITranslationState[];
    translatingLanguages: Set<string>;
    currentDisplayLanguage: string;
    showingOriginal: boolean;
    originalContent: string;
    readStatus?: Array<{
        userId: string;
        readAt: Date;
    }>;
    location?: string;
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
    id: string;
    identifier?: string;
    title?: string;
    description?: string;
    type: 'direct' | 'group' | 'anonymous' | 'broadcast';
    status: 'active' | 'archived' | 'deleted';
    visibility: 'public' | 'private' | 'restricted';
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
    lastMessage?: Message;
    messageCount?: number;
    unreadCount?: number;
    stats?: ConversationStats;
    settings?: {
        allowAnonymous: boolean;
        requireApproval: boolean;
        maxParticipants?: number;
        autoArchive?: boolean;
        translationEnabled: boolean;
        defaultLanguage?: string;
        allowedLanguages?: string[];
    };
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
    createdAt: Date;
    updatedAt: Date;
    lastActivityAt?: Date;
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
export type BubbleStreamMessage = MessageWithTranslations;
export {};
//# sourceMappingURL=conversation.d.ts.map