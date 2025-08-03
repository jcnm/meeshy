/**
 * Types TypeScript pour la gestion des WebSockets
 * Gestion complète des fonctionnalités temps réel avec authentification
 */

import { User, Message, Conversation, MessageTranslation } from '../../../shared/generated';

// Types de base pour les événements WebSocket
export interface WebSocketUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  isOnline: boolean;
  lastSeen: Date;
}

// États de connexion WebSocket
export interface WebSocketConnection {
  id: string;
  userId: string;
  user: WebSocketUser;
  socket: any; // WebSocket instance
  connectedAt: Date;
  lastPingAt: Date;
  subscriptions: Set<string>; // IDs des conversations abonnées
}

// Types d'événements temps réel
export enum WebSocketEventType {
  // Connexion
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  
  // Messages
  MESSAGE_SEND = 'message:send',
  MESSAGE_RECEIVE = 'message:receive',
  MESSAGE_EDIT = 'message:edit',
  MESSAGE_DELETE = 'message:delete',
  MESSAGE_REACTION = 'message:reaction',
  
  // Indicateurs de frappe
  TYPING_START = 'typing:start',
  TYPING_STOP = 'typing:stop',
  TYPING_STATUS = 'typing:status',
  
  // Statuts de lecture
  MESSAGE_READ = 'message:read',
  MESSAGE_DELIVERED = 'message:delivered',
  
  // Présence utilisateur
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USER_STATUS_UPDATE = 'user:status:update',
  
  // Conversations
  CONVERSATION_JOIN = 'conversation:join',
  CONVERSATION_LEAVE = 'conversation:leave',
  CONVERSATION_UPDATE = 'conversation:update',
  
  // Notifications
  NOTIFICATION_RECEIVE = 'notification:receive',
  NOTIFICATION_READ = 'notification:read',
  
  // Erreurs
  ERROR = 'error',
  RATE_LIMIT = 'rate_limit'
}

// Événement d'authentification
export interface AuthenticateEvent {
  type: WebSocketEventType.AUTHENTICATE;
  data: {
    token: string;
    userId: string;
  };
}

// Événement d'envoi de message
export interface MessageSendEvent {
  type: WebSocketEventType.MESSAGE_SEND;
  data: {
    conversationId: string;
    content: string;
    tempId?: string; // ID temporaire pour le suivi côté client
    replyToId?: string;
    attachments?: Array<{
      type: 'image' | 'file' | 'voice';
      url: string;
      name: string;
      size: number;
    }>;
  };
}

// Événement de réception de message (avec traductions)
export interface MessageReceiveEvent {
  type: WebSocketEventType.MESSAGE_RECEIVE;
  data: {
    message: {
      id: string;
      content: string;
      originalLanguage: string;
      conversationId: string;
      senderId: string;
      sender: {
        id: string;
        username: string;
        displayName?: string;
        avatar?: string;
      };
      createdAt: Date;
      updatedAt: Date;
      isEdited: boolean;
      tempId?: string;
    };
    translation?: {
      translatedContent: string;
      targetLanguage: string;
      translationModel: 'basic' | 'medium' | 'premium';
    };
  };
}

// Événement d'édition de message
export interface MessageEditEvent {
  type: WebSocketEventType.MESSAGE_EDIT;
  data: {
    messageId: string;
    conversationId: string;
    newContent: string;
    editedAt: Date;
  };
}

// Événement de suppression de message
export interface MessageDeleteEvent {
  type: WebSocketEventType.MESSAGE_DELETE;
  data: {
    messageId: string;
    conversationId: string;
    deletedAt: Date;
  };
}

// Événement d'indicateur de frappe
export interface TypingEvent {
  type: WebSocketEventType.TYPING_START | WebSocketEventType.TYPING_STOP;
  data: {
    conversationId: string;
    userId: string;
    username: string;
    displayName?: string;
    timestamp: Date;
  };
}

// Événement de statut de frappe (pour notifier les autres)
export interface TypingStatusEvent {
  type: WebSocketEventType.TYPING_STATUS;
  data: {
    conversationId: string;
    typingUsers: Array<{
      userId: string;
      username: string;
      displayName?: string;
      startedAt: Date;
    }>;
  };
}

// Événement de lecture de message
export interface MessageReadEvent {
  type: WebSocketEventType.MESSAGE_READ;
  data: {
    messageId: string;
    conversationId: string;
    userId: string;
    readAt: Date;
  };
}

// Événement de statut utilisateur
export interface UserStatusEvent {
  type: WebSocketEventType.USER_ONLINE | WebSocketEventType.USER_OFFLINE;
  data: {
    userId: string;
    username: string;
    isOnline: boolean;
    lastSeen: Date;
  };
}

// Événement de mise à jour de conversation
export interface ConversationUpdateEvent {
  type: WebSocketEventType.CONVERSATION_UPDATE;
  data: {
    conversationId: string;
    changes: {
      name?: string;
      description?: string;
      avatar?: string;
      membersAdded?: string[];
      membersRemoved?: string[];
    };
    updatedBy: {
      userId: string;
      username: string;
    };
    updatedAt: Date;
  };
}

// Événement de notification
export interface NotificationEvent {
  type: WebSocketEventType.NOTIFICATION_RECEIVE;
  data: {
    id: string;
    type: 'message' | 'friend_request' | 'group_invite' | 'system';
    title: string;
    message: string;
    data?: Record<string, any>;
    createdAt: Date;
    isRead: boolean;
  };
}

// Événement d'erreur
export interface ErrorEvent {
  type: WebSocketEventType.ERROR;
  data: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// Union de tous les événements
export type WebSocketEvent = 
  | AuthenticateEvent
  | MessageSendEvent
  | MessageReceiveEvent
  | MessageEditEvent
  | MessageDeleteEvent
  | TypingEvent
  | TypingStatusEvent
  | MessageReadEvent
  | UserStatusEvent
  | ConversationUpdateEvent
  | NotificationEvent
  | ErrorEvent;

// État de la session utilisateur
export interface UserSession {
  userId: string;
  user: WebSocketUser;
  connections: Map<string, WebSocketConnection>; // Plusieurs connexions possibles (multi-device)
  activeConversations: Set<string>;
  typingState: Map<string, Date>; // conversationId -> timestamp
  lastActivity: Date;
}

// Gestionnaire d'événements WebSocket
export interface WebSocketEventHandler {
  onConnect(connection: WebSocketConnection): Promise<void>;
  onDisconnect(connection: WebSocketConnection): Promise<void>;
  onAuthenticate(connection: WebSocketConnection, event: AuthenticateEvent): Promise<void>;
  onMessageSend(connection: WebSocketConnection, event: MessageSendEvent): Promise<void>;
  onMessageEdit(connection: WebSocketConnection, event: MessageEditEvent): Promise<void>;
  onMessageDelete(connection: WebSocketConnection, event: MessageDeleteEvent): Promise<void>;
  onTypingStart(connection: WebSocketConnection, event: TypingEvent): Promise<void>;
  onTypingStop(connection: WebSocketConnection, event: TypingEvent): Promise<void>;
  onMessageRead(connection: WebSocketConnection, event: MessageReadEvent): Promise<void>;
  onConversationJoin(connection: WebSocketConnection, conversationId: string): Promise<void>;
  onConversationLeave(connection: WebSocketConnection, conversationId: string): Promise<void>;
}

// Configuration de résolution de langue pour les utilisateurs
export interface LanguageResolutionConfig {
  userId: string;
  targetLanguage: string;
  isOriginalLanguage: boolean;
}

// Gestionnaire de sessions WebSocket
export interface WebSocketSessionManager {
  getUserSession(userId: string): UserSession | undefined;
  addConnection(connection: WebSocketConnection): void;
  removeConnection(connectionId: string): void;
  broadcastToConversation(conversationId: string, event: WebSocketEvent, excludeUserId?: string): Promise<void>;
  broadcastToUser(userId: string, event: WebSocketEvent): Promise<void>;
  getConversationMembers(conversationId: string): Promise<WebSocketUser[]>;
  resolveUserLanguage(user: WebSocketUser): string;
  getUsersInConversation(conversationId: string): WebSocketUser[];
  updateUserStatus(userId: string, isOnline: boolean): Promise<void>;
  startTyping(userId: string, conversationId: string): Promise<void>;
  stopTyping(userId: string, conversationId: string): Promise<void>;
  getTypingUsers(conversationId: string): Array<{ userId: string; username: string; displayName?: string; startedAt: Date }>;
}
