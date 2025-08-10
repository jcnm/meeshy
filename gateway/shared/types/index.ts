/**
 * Types partagés Meeshy - Index principal
 * 
 * Centralise tous les types utilisés à travers l'application
 * Gateway, Frontend, et Translator
 */

// ===== ÉVÉNEMENTS SOCKET.IO =====
export * from './socketio-events';

// Import pour éviter les conflits de noms
import type { MessageTranslationCache, SocketIOUser, TranslationData } from './socketio-events';

// Ré-export des types essentiels
export type { TranslationData, MessageTranslationCache, SocketIOUser };

// ===== TYPES SPÉCIFIQUES À LA TRADUCTION =====
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

// ===== TYPES DE SERVICE =====
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

// ===== TYPES POUR L'API REST =====
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

// ===== TYPES POUR LES MESSAGES =====
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

// ===== TYPES POUR LES CONVERSATIONS =====
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

// ===== TYPES POUR L'ERREUR HANDLING =====
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

// ===== CONSTANTES =====
export const SUPPORTED_LANGUAGES = [
  'fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar', 'it', 'ru'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const TRANSLATION_MODELS = ['basic', 'medium', 'premium'] as const;
export type TranslationModel = typeof TRANSLATION_MODELS[number];

export const MESSAGE_TYPES = ['text', 'image', 'file', 'system'] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

// ===== TYPES POUR LES STATISTIQUES =====
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

// ===== RE-EXPORTS POUR RÉTROCOMPATIBILITÉ =====
export type {
  SocketIOMessage as Message,
  SocketIOUser as User,
  SocketIOResponse as SocketResponse,
  MessageTranslationCache as TranslationCache,
  UserLanguageConfig,
  ConnectionStatus,
  ConnectionDiagnostics
} from './socketio-events';
