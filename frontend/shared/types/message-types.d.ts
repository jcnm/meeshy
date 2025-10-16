/**
* Types de messages unifiés pour Meeshy
* Architecture simplifiée avec 2 types principaux :
* 1. GatewayMessage - Messages retournés par la Gateway
* 2. UIMessage - Messages avec détails visuels pour BubbleMessage
*/
import type { SocketIOUser as User, MessageType } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';
/**
 * Type de base pour toutes les réponses de traduction
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
 * Message retourné par la Gateway
 * Utilisé pour :
 * - Réception de nouveaux messages via Socket.IO
 * - Chargement de messages d'une conversation
 * - Réponses API
 */
export interface GatewayMessage {
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
    createdAt: Date;
    updatedAt?: Date;
    sender?: User | AnonymousParticipant;
    translations: MessageTranslation[];
    replyTo?: GatewayMessage;
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
}
/**
 * État de traduction pour l'interface utilisateur
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
 * Message enrichi pour l'interface utilisateur
 * Utilisé par BubbleMessage pour affichage avec états visuels
 */
export interface UIMessage extends GatewayMessage {
    uiTranslations: UITranslationState[];
    translatingLanguages: Set<string>;
    currentDisplayLanguage: string;
    showingOriginal: boolean;
    originalContent: string;
    readStatus?: Array<{
        userId: string;
        readAt?: Date;
        receivedAt?: Date;
    }>;
    location?: string;
    canEdit: boolean;
    canDelete: boolean;
    canTranslate: boolean;
    canReply: boolean;
}
/**
 * Convertit un GatewayMessage en UIMessage
 */
export declare function gatewayToUIMessage(gatewayMessage: GatewayMessage, userLanguage: string, userPermissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canTranslate?: boolean;
    canReply?: boolean;
}): UIMessage;
/**
 * Ajoute un état de traduction en cours à un UIMessage
 */
export declare function addTranslatingState(message: UIMessage, targetLanguage: string): UIMessage;
/**
 * Met à jour le résultat d'une traduction dans un UIMessage
 */
export declare function updateTranslationResult(message: UIMessage, targetLanguage: string, result: {
    content?: string;
    status: 'completed' | 'failed';
    error?: string;
    confidence?: number;
    model?: 'basic' | 'medium' | 'premium';
    fromCache?: boolean;
}): UIMessage;
/**
 * Obtient le contenu à afficher selon la langue
 */
export declare function getDisplayContent(message: UIMessage): string;
/**
 * Vérifie si une traduction est en cours pour une langue
 */
export declare function isTranslating(message: UIMessage, targetLanguage: string): boolean;
/**
 * Vérifie si une traduction est disponible pour une langue
 */
export declare function hasTranslation(message: UIMessage, targetLanguage: string): boolean;
export type Message = GatewayMessage;
export type MessageWithTranslations = GatewayMessage;
export type BubbleStreamMessage = UIMessage;
//# sourceMappingURL=message-types.d.ts.map