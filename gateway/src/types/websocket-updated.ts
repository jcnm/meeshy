/**
 * Types et interfaces WebSocket mis à jour pour Meeshy
 * Support complet de la traduction temps réel et authentification avancée
 */

import { WebSocket } from 'ws';

// Types d'événements WebSocket étendus
export enum WebSocketEventType {
  // Authentification
  AUTH_REQUEST = 'auth_request',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILED = 'auth_failed',
  AUTH_REQUIRED = 'auth_required',

  // Messages
  MESSAGE_SEND = 'message_send',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_TRANSLATE = 'message_translate',
  MESSAGE_TRANSLATED = 'message_translated',
  AUTO_TRANSLATION_RECEIVED = 'auto_translation_received',

  // Indicateurs de frappe
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',

  // Conversations
  CONVERSATION_JOIN = 'conversation_join',
  CONVERSATION_JOINED = 'conversation_joined',
  CONVERSATION_LEAVE = 'conversation_leave',
  CONVERSATION_LEFT = 'conversation_left',

  // Présence utilisateur
  PRESENCE_UPDATE = 'presence_update',
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',

  // Erreurs et statut
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  PONG = 'pong'
}

// Interface pour les messages WebSocket
export interface WebSocketMessage {
  type: WebSocketEventType;
  data: any;
  timestamp: Date;
  messageId?: string;
}

// Interface pour les connexions authentifiées
export interface AuthenticatedConnection {
  id: string;
  socket: WebSocket;
  userId: string | null;
  isAuthenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
  metadata: {
    userAgent: string;
    ip: string;
  };
}

// Interface pour les données de message
export interface MessageData {
  messageId?: string;
  conversationId: string;
  content: string;
  senderId: string;
  senderUsername?: string;
  messageType?: 'text' | 'image' | 'file' | 'audio' | 'video';
  timestamp?: Date;
  replyToMessageId?: string;
}

// Interface pour les données de traduction
export interface MessageTranslationData {
  messageId: string;
  targetLanguages: string[];
  sourceLanguage?: string;
}

// Interface pour les données de frappe
export interface TypingData {
  conversationId: string;
  userId?: string;
  username?: string;
}

// Interface pour les données de conversation
export interface ConversationData {
  conversationId: string;
  conversationName?: string;
}

// Interface pour les données de présence
export interface UserPresenceData {
  status: 'online' | 'away' | 'busy' | 'offline';
  customMessage?: string;
}

// Interface pour les données d'authentification
export interface AuthData {
  token: string;
  refreshToken?: string;
}

// Interface pour les données d'erreur
export interface ErrorData {
  message: string;
  code?: string;
  details?: any;
}

// Interface pour les traductions automatiques
export interface AutoTranslationData {
  messageId: string;
  targetLanguage: string;
  translatedContent: string;
  confidence: number;
  model: string;
  sourceLanguage: string;
}

// Interface pour les traductions manuelles complètes
export interface MessageTranslationResult {
  messageId: string;
  sourceLanguage: string;
  translations: Array<{
    language: string;
    content: string;
    confidence: number;
    model: string;
    fromCache: boolean;
  }>;
}

// Interface pour les statistiques de connexion
export interface ConnectionStats {
  totalConnections: number;
  authenticatedConnections: number;
  activeConversations: number;
  translationServiceReady: boolean;
}

// Interface pour la gestion des abonnements
export interface UserSubscription {
  userId: string;
  conversationIds: Set<string>;
  notificationPreferences: {
    enableSound: boolean;
    enableDesktop: boolean;
    enableTranslation: boolean;
  };
}

// Interface pour les événements de conversation
export interface ConversationEvent {
  conversationId: string;
  eventType: 'user_joined' | 'user_left' | 'message_sent' | 'typing' | 'translation';
  userId: string;
  timestamp: Date;
  data?: any;
}

// Interface pour les préférences de traduction
export interface TranslationPreferences {
  autoTranslate: boolean;
  preferredLanguage: string;
  enabledLanguages: string[];
  translationQuality: 'basic' | 'medium' | 'premium';
}

// Types d'union pour les données des messages
export type WebSocketMessageData = 
  | MessageData 
  | MessageTranslationData
  | TypingData 
  | ConversationData 
  | UserPresenceData 
  | AuthData 
  | ErrorData
  | AutoTranslationData
  | MessageTranslationResult;

// Interface pour les gestionnaires d'événements
export interface WebSocketEventHandlers {
  onConnect: (connection: AuthenticatedConnection) => void;
  onDisconnect: (connectionId: string) => void;
  onMessage: (connectionId: string, message: WebSocketMessage) => void;
  onError: (connectionId: string, error: Error) => void;
}

// Configuration WebSocket
export interface WebSocketConfig {
  port?: number;
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
  authTimeout?: number;
  enableTranslation?: boolean;
}

// Interface pour les événements de présence
export interface PresenceEvent {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen?: Date;
  device?: string;
}


