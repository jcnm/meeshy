/**
 * Types unifiés pour les réponses API Meeshy
 * Harmonisation Gateway ↔ Frontend - WebSocket et REST
 */

import type { ConversationStats } from './conversation';

/**
 * Métadonnées de pagination
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

/**
 * Métadonnées enrichies pour les réponses
 */
export interface ResponseMeta {
  conversationStats?: ConversationStats;
  pagination?: PaginationMeta;
  timestamp?: string;
  requestId?: string;
  processingTime?: number;
}

/**
 * Format de réponse API unifié (REST et WebSocket)
 * Base commune pour toutes les réponses du système
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  meta?: ResponseMeta;
}

/**
 * Réponse WebSocket (même format que ApiResponse)
 * Assure la cohérence entre REST et WebSocket
 */
export interface SocketResponse<T = unknown> extends ApiResponse<T> {
  // Identique à ApiResponse pour garantir la cohérence
}

/**
 * Réponse pour l'envoi de message
 */
export interface SendMessageResponse extends ApiResponse<{
  messageId: string;
  status?: string;
  timestamp?: string;
}> {}

/**
 * Réponse pour la liste des messages
 */
export interface GetMessagesResponse extends ApiResponse<{
  messages: any[]; // Will be typed as Message[] when used
  hasMore: boolean;
}> {}

/**
 * Réponse pour la liste des conversations
 */
export interface GetConversationsResponse extends ApiResponse<any[]> {} // Will be typed as Conversation[] when used

/**
 * Réponse pour une conversation spécifique
 */
export interface GetConversationResponse extends ApiResponse<any> {} // Will be typed as Conversation when used

/**
 * Réponse pour la création d'une conversation
 */
export interface CreateConversationResponse extends ApiResponse<any> {} // Will be typed as Conversation when used

/**
 * Erreur API standardisée
 */
export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Configuration API
 */
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  headers: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

/**
 * Options pour les requêtes API
 */
export interface ApiRequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Réponse d'authentification
 */
export interface AuthResponse extends ApiResponse<{
  user: any; // Will be typed as User when used
  token?: string;
  sessionToken?: string;
  expiresAt?: string;
}> {}

/**
 * Réponse pour les traductions
 */
export interface TranslationResponse extends ApiResponse<{
  messageId: string;
  translations: Array<{
    targetLanguage: string;
    translatedContent: string;
    translationModel: string;
    confidenceScore?: number;
    cached: boolean;
  }>;
}> {}

/**
 * Réponse pour les statistiques
 */
export interface StatsResponse extends ApiResponse<{
  stats: ConversationStats;
}> {}

/**
 * Type guard pour vérifier si une réponse est un succès
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard pour vérifier si une réponse est une erreur
 */
export function isErrorResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: false; error: string } {
  return response.success === false && response.error !== undefined;
}

/**
 * Utilitaire pour créer une réponse de succès
 */
export function createSuccessResponse<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    meta
  };
}

/**
 * Utilitaire pour créer une réponse d'erreur
 */
export function createErrorResponse(error: string, code?: string, meta?: ResponseMeta): ApiResponse<never> {
  return {
    success: false,
    error,
    code,
    meta
  };
}
