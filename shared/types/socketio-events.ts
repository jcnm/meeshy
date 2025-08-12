/**
 * Types unifiés pour les événements Socket.IO Meeshy
 * Remplace les anciens types WebSocket pour correspondre à la nouvelle architecture Socket.IO
 */

// ===== ÉVÉNEMENTS SOCKET.IO =====

// Événements du serveur vers le client
export interface ServerToClientEvents {
  'message:new': (message: SocketIOMessage) => void;
  'message:edited': (message: SocketIOMessage) => void;
  'message:deleted': (data: { messageId: string; conversationId: string }) => void;
  'message:translation': (data: TranslationEvent) => void;
  'message_translated': (data: TranslationEvent) => void; // Alias pour compatibilité
  'typing:start': (data: TypingEvent) => void;
  'typing:stop': (data: TypingEvent) => void;
  'user:status': (data: UserStatusEvent) => void;
  'conversation:joined': (data: { conversationId: string; userId: string }) => void;
  'conversation:left': (data: { conversationId: string; userId: string }) => void;
  'authenticated': (data: { success: boolean; user?: any; error?: string }) => void;
  'message_sent': (data: { messageId: string; status: string; timestamp: string }) => void;
  'error': (data: { message: string; code?: string }) => void;
}

// Événements du client vers le serveur
export interface ClientToServerEvents {
  'message:send': (data: { conversationId: string; content: string }, callback?: (response: SocketIOResponse<{ messageId: string }>) => void) => void;
  'message:edit': (data: { messageId: string; content: string }, callback?: (response: SocketIOResponse) => void) => void;
  'message:delete': (data: { messageId: string }, callback?: (response: SocketIOResponse) => void) => void;
  'conversation:join': (data: { conversationId: string }) => void;
  'conversation:leave': (data: { conversationId: string }) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;
  'user:status': (data: { isOnline: boolean }) => void;
  'authenticate': (data: { userId?: string; sessionToken?: string; language?: string }) => void;
  'request_translation': (data: { messageId: string; targetLanguage: string }) => void;
}

// ===== STRUCTURES DE DONNÉES =====

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
}

export interface TypingEvent {
  userId: string;
  username: string;
  conversationId: string;
  isTyping?: boolean; // Ajouté côté service pour distinguer start/stop
}

export interface UserStatusEvent {
  userId: string;
  username: string;
  isOnline: boolean;
}

// ===== TYPES DE CONFIGURATION =====

export interface UserLanguageConfig {
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage?: string;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
}

// ===== HELPERS POUR LA GESTION DES TRADUCTIONS =====

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

// ===== TYPES POUR LES CONNEXIONS =====

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

// ===== TYPES POUR L'AUTHENTIFICATION =====

// Base Socket interface pour éviter l'import de socket.io dans shared
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
  currentConversations: Set<string>;
}

// ===== EXPORTS POUR RÉTROCOMPATIBILITÉ =====

// Aliases pour faciliter la migration
export type Message = SocketIOMessage;
export type User = SocketIOUser;
export type Response<T = unknown> = SocketIOResponse<T>;

// Export des interfaces principales
export type {
  ServerToClientEvents as SocketIOServerEvents,
  ClientToServerEvents as SocketIOClientEvents
};
