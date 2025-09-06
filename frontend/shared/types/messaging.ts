/**
 * Types pour le messaging - Phase 2.1
 * 
 * Interfaces de requête/réponse pour l'envoi de messages
 * Gateway WebSocket ↔ Frontend communication
 */

import type { Message, ApiResponse, ConversationStats } from './index';

// ===== TYPES D'AUTHENTIFICATION =====

/**
 * Types d'authentification supportés
 */
export type AuthenticationType = 'jwt' | 'session' | 'anonymous';

/**
 * Context d'authentification pour une requête
 */
export interface AuthenticationContext {
  type: AuthenticationType;
  userId?: string;           // ID User (pour JWT)
  sessionToken?: string;     // Session token (pour anonymes)
  jwtToken?: string;         // JWT Token complet
  isAnonymous: boolean;      // Dérivé du type
}

// ===== REQUÊTE DE MESSAGE =====

/**
 * Format pour toutes les requêtes d'envoi de message
 * Remplace les formats séparés REST/WebSocket
 */
export interface MessageRequest {
  // Champs requis
  conversationId: string;
  content: string;
  
  // Champs optionnels avec defaults intelligents
  originalLanguage?: string;        // Default: détection auto ou langue utilisateur
  messageType?: string;             // Default: "text"
  replyToId?: string;              // Pour les réponses/threads
  
  // Extensions pour messaging anonyme - DEPRECATED, utiliser authContext
  isAnonymous?: boolean;           // Default: false
  anonymousDisplayName?: string;   // Requis si isAnonymous = true
  
  // Metadata optionnelle
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  encrypted?: boolean;             // Default: false
  attachments?: MessageAttachment[];
  
  // Preferences de traduction spécifiques à ce message
  translationPreferences?: {
    disableAutoTranslation?: boolean;
    targetLanguages?: string[];    // Override des langues auto-détectées
    modelType?: 'basic' | 'medium' | 'premium';
  };

  // Context d'authentification - NOUVEAU
  authContext?: AuthenticationContext;

  // Metadata pour WebSocket/REST tracking
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

// ===== RÉPONSE UNIFIÉE =====

/**
 * Statut de traduction pour un message
 */
export interface TranslationStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cached';
  languagesRequested: string[];     // Langues demandées pour traduction
  languagesCompleted: string[];     // Langues avec traduction terminée
  languagesFailed: string[];        // Langues avec traduction échouée
  estimatedCompletionTime?: number; // Temps estimé en ms
  cacheHitRate?: number;           // % de traductions venant du cache
  model?: 'basic' | 'medium' | 'premium'; // Modèle utilisé pour traduire
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
  recipientCount: number;           // Nombre de destinataires
  deliveredCount: number;           // Nombre ayant reçu le message
  readCount: number;                // Nombre ayant lu le message
  recipientDetails?: Array<{        // Détail par destinataire (optionnel)
    userId: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: Date;
  }>;
}

/**
 * Metadata complète pour une réponse de message
 */
export interface MessageResponseMetadata {
  // Stats de conversation mises à jour
  conversationStats?: ConversationStats;
  
  // Statut de traduction
  translationStatus?: TranslationStatus;
  
  // Statut de livraison
  deliveryStatus?: DeliveryStatus;
  
  // Performance metrics
  performance?: {
    processingTime: number;         // Temps total de traitement en ms
    dbQueryTime: number;           // Temps des requêtes DB en ms
    translationQueueTime: number;  // Temps ajout à queue traduction en ms
    validationTime: number;        // Temps de validation en ms
  };
  
  // Informations contextuelles
  context?: {
    isFirstMessage: boolean;       // Premier message de la conversation
    triggerNotifications: boolean; // Déclenche des notifications push
    mentionedUsers: string[];      // IDs utilisateurs mentionnés (@user)
    containsLinks: boolean;        // Message contient des liens
    spamScore?: number;           // Score anti-spam (0-1)
  };
  
  // Debugging info (development only)
  debug?: {
    requestId: string;
    serverTime: Date;
    userId: string;
    conversationId: string;
    messageId: string;
    // Champs flexibles pour debugging spécifique
    error?: string;
    stack?: string;
    socketId?: string;
    source?: string;
    [key: string]: any;  // Allow additional debug fields
  };
}

/**
 * Réponse pour l'envoi de messages
 * Étend ApiResponse avec metadata complète
 */
export interface MessageResponse extends ApiResponse<Message> {
  // Message complet avec toutes les relations
  data: Message;  // Includes sender, translations, replyTo, etc.
  
  // Metadata enrichie
  metadata: MessageResponseMetadata;
}

// ===== ÉVÉNEMENTS WEBSOCKET UNIFIÉS =====

/**
 * Format d'événement WebSocket pour l'envoi de message
 */
export interface MessageSendEvent {
  type: 'message:send';
  payload: MessageRequest;
  requestId?: string;              // Pour traçabilité
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
    targetLanguage: string;        // Langue pour ce destinataire spécifique
    metadata: Omit<MessageResponseMetadata, 'debug'>;
  };
}

// ===== VALIDATION TYPES =====

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
  reason?: string;                 // Raison si canSend = false
}
