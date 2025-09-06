/**
 * Types unifiés pour les événements Socket.IO Meeshy
 * Remplace les anciens types WebSocket pour correspondre à la nouvelle architecture Socket.IO
 */
export declare const SERVER_EVENTS: {
    readonly MESSAGE_NEW: "message:new";
    readonly MESSAGE_EDITED: "message:edited";
    readonly MESSAGE_DELETED: "message:deleted";
    readonly MESSAGE_TRANSLATION: "message:translation";
    readonly MESSAGE_TRANSLATED: "message_translated";
    readonly TYPING_START: "typing:start";
    readonly TYPING_STOP: "typing:stop";
    readonly USER_STATUS: "user:status";
    readonly CONVERSATION_JOINED: "conversation:joined";
    readonly CONVERSATION_LEFT: "conversation:left";
    readonly AUTHENTICATED: "authenticated";
    readonly MESSAGE_SENT: "message_sent";
    readonly ERROR: "error";
    readonly TRANSLATION_RECEIVED: "translation_received";
    readonly TRANSLATION_ERROR: "translation_error";
    readonly NOTIFICATION: "notification";
    readonly SYSTEM_MESSAGE: "system_message";
    readonly CONVERSATION_STATS: "conversation:stats";
    readonly CONVERSATION_ONLINE_STATS: "conversation:online_stats";
};
export declare const CLIENT_EVENTS: {
    readonly MESSAGE_SEND: "message:send";
    readonly MESSAGE_EDIT: "message:edit";
    readonly MESSAGE_DELETE: "message:delete";
    readonly CONVERSATION_JOIN: "conversation:join";
    readonly CONVERSATION_LEAVE: "conversation:leave";
    readonly TYPING_START: "typing:start";
    readonly TYPING_STOP: "typing:stop";
    readonly USER_STATUS: "user:status";
    readonly AUTHENTICATE: "authenticate";
    readonly REQUEST_TRANSLATION: "request_translation";
};
export type ServerEventNames = typeof SERVER_EVENTS[keyof typeof SERVER_EVENTS];
export type ClientEventNames = typeof CLIENT_EVENTS[keyof typeof CLIENT_EVENTS];
export interface ServerToClientEvents {
    [SERVER_EVENTS.MESSAGE_NEW]: (message: SocketIOMessage) => void;
    [SERVER_EVENTS.MESSAGE_EDITED]: (message: SocketIOMessage) => void;
    [SERVER_EVENTS.MESSAGE_DELETED]: (data: {
        messageId: string;
        conversationId: string;
    }) => void;
    [SERVER_EVENTS.MESSAGE_TRANSLATION]: (data: TranslationEvent) => void;
    [SERVER_EVENTS.MESSAGE_TRANSLATED]: (data: TranslationEvent) => void;
    [SERVER_EVENTS.TYPING_START]: (data: TypingEvent) => void;
    [SERVER_EVENTS.TYPING_STOP]: (data: TypingEvent) => void;
    [SERVER_EVENTS.USER_STATUS]: (data: UserStatusEvent) => void;
    [SERVER_EVENTS.CONVERSATION_JOINED]: (data: {
        conversationId: string;
        userId: string;
    }) => void;
    [SERVER_EVENTS.CONVERSATION_LEFT]: (data: {
        conversationId: string;
        userId: string;
    }) => void;
    [SERVER_EVENTS.AUTHENTICATED]: (data: {
        success: boolean;
        user?: any;
        error?: string;
    }) => void;
    [SERVER_EVENTS.MESSAGE_SENT]: (data: {
        messageId: string;
        status: string;
        timestamp: string;
    }) => void;
    [SERVER_EVENTS.ERROR]: (data: {
        message: string;
        code?: string;
    }) => void;
    [SERVER_EVENTS.TRANSLATION_RECEIVED]: (data: {
        messageId: string;
        translatedText: string;
        targetLanguage: string;
        confidenceScore?: number;
    }) => void;
    [SERVER_EVENTS.TRANSLATION_ERROR]: (data: {
        messageId: string;
        targetLanguage: string;
        error: string;
    }) => void;
    [SERVER_EVENTS.NOTIFICATION]: (data: any) => void;
    [SERVER_EVENTS.SYSTEM_MESSAGE]: (data: any) => void;
    [SERVER_EVENTS.CONVERSATION_STATS]: (data: {
        conversationId: string;
        stats: ConversationStatsDTO;
    }) => void;
    [SERVER_EVENTS.CONVERSATION_ONLINE_STATS]: (data: {
        conversationId: string;
        onlineUsers: ConversationOnlineUser[];
        updatedAt: Date;
    }) => void;
}
export interface ClientToServerEvents {
    [CLIENT_EVENTS.MESSAGE_SEND]: (data: {
        conversationId: string;
        content: string;
    }, callback?: (response: SocketIOResponse<{
        messageId: string;
    }>) => void) => void;
    [CLIENT_EVENTS.MESSAGE_EDIT]: (data: {
        messageId: string;
        content: string;
    }, callback?: (response: SocketIOResponse) => void) => void;
    [CLIENT_EVENTS.MESSAGE_DELETE]: (data: {
        messageId: string;
    }, callback?: (response: SocketIOResponse) => void) => void;
    [CLIENT_EVENTS.CONVERSATION_JOIN]: (data: {
        conversationId: string;
    }) => void;
    [CLIENT_EVENTS.CONVERSATION_LEAVE]: (data: {
        conversationId: string;
    }) => void;
    [CLIENT_EVENTS.TYPING_START]: (data: {
        conversationId: string;
    }) => void;
    [CLIENT_EVENTS.TYPING_STOP]: (data: {
        conversationId: string;
    }) => void;
    [CLIENT_EVENTS.USER_STATUS]: (data: {
        isOnline: boolean;
    }) => void;
    [CLIENT_EVENTS.AUTHENTICATE]: (data: {
        userId?: string;
        sessionToken?: string;
        language?: string;
    }) => void;
    [CLIENT_EVENTS.REQUEST_TRANSLATION]: (data: {
        messageId: string;
        targetLanguage: string;
    }) => void;
}
export interface SocketIOMessage {
    id: string;
    conversationId: string;
    senderId?: string;
    content: string;
    originalLanguage: string;
    messageType: string;
    isEdited: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    sender?: SocketIOUser;
}
export interface UserPermissions {
    canAccessAdmin: boolean;
    canManageUsers: boolean;
    canManageGroups: boolean;
    canManageConversations: boolean;
    canViewAnalytics: boolean;
    canModerateContent: boolean;
    canViewAuditLogs: boolean;
    canManageNotifications: boolean;
    canManageTranslations: boolean;
}
export interface SocketIOUser {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    displayName?: string;
    avatar?: string;
    role: string;
    permissions?: UserPermissions;
    isOnline: boolean;
    lastSeen: Date;
    lastActiveAt: Date;
    systemLanguage: string;
    regionalLanguage: string;
    customDestinationLanguage?: string;
    autoTranslateEnabled: boolean;
    translateToSystemLanguage: boolean;
    translateToRegionalLanguage: boolean;
    useCustomDestination: boolean;
    isActive: boolean;
    deactivatedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    isAnonymous?: boolean;
    nickname?: string;
}
export interface SocketIOResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface TranslationEvent {
    messageId: string;
    translations: TranslationData[];
}
export interface TranslationData {
    messageId: string;
    sourceLanguage: string;
    targetLanguage: string;
    translatedContent: string;
    translationModel: string;
    cacheKey: string;
    cached: boolean;
    confidenceScore?: number;
    createdAt?: Date;
}
export interface TypingEvent {
    userId: string;
    username: string;
    conversationId: string;
    isTyping?: boolean;
}
export interface UserStatusEvent {
    userId: string;
    username: string;
    isOnline: boolean;
}
export interface ConversationOnlineUser {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
}
export interface ConversationStatsDTO {
    messagesPerLanguage: Record<string, number>;
    participantCount: number;
    participantsPerLanguage: Record<string, number>;
    onlineUsers: ConversationOnlineUser[];
    updatedAt: Date;
}
export interface UserLanguageConfig {
    systemLanguage: string;
    regionalLanguage: string;
    customDestinationLanguage?: string;
    autoTranslateEnabled: boolean;
    translateToSystemLanguage: boolean;
    translateToRegionalLanguage: boolean;
    useCustomDestination: boolean;
}
export interface MessageTranslationCache {
    messageId: string;
    sourceLanguage: string;
    targetLanguage: string;
    translatedContent: string;
    translationModel: 'basic' | 'medium' | 'premium';
    cacheKey: string;
    cached: boolean;
    createdAt: Date;
    confidenceScore?: number;
}
export interface ConnectionStatus {
    isConnected: boolean;
    hasSocket: boolean;
    currentUser: string;
    connectedAt?: Date;
    lastReconnectAttempt?: Date;
    reconnectAttempts?: number;
}
export interface ConnectionDiagnostics {
    connectionStatus: ConnectionStatus;
    socketId?: string;
    transport?: string;
    connectedSockets?: number;
    serverStatus?: 'online' | 'offline' | 'unknown';
}
export interface BaseSocket {
    id: string;
    emit: (event: string, ...args: any[]) => boolean;
    on: (event: string, listener: (...args: any[]) => void) => void;
    join: (room: string) => void;
    leave: (room: string) => void;
}
export interface AuthenticatedSocket extends BaseSocket {
    userId: string;
    username: string;
    userData: SocketIOUser;
    connectedAt: Date;
    currentConversations: string[]; // Changé de Set<string> à string[] pour compatibilité
}
export type Message = SocketIOMessage;
export type User = SocketIOUser;
export type Response<T = unknown> = SocketIOResponse<T>;
export type { ServerToClientEvents as SocketIOServerEvents, ClientToServerEvents as SocketIOClientEvents };
//# sourceMappingURL=socketio-events.d.ts.map