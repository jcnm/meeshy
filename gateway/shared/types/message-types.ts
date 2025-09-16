 /**
 * Types de messages unifiés pour Meeshy
 * Architecture simplifiée avec 2 types principaux :
 * 1. GatewayMessage - Messages retournés par la Gateway
 * 2. UIMessage - Messages avec détails visuels pour BubbleMessage
 */

import type { SocketIOUser as User, MessageType } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';

// ===== 1. MESSAGES GATEWAY (API/Backend) =====

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
  // Identifiants
  id: string;
  conversationId: string;
  senderId?: string;
  anonymousSenderId?: string;
  
  // Contenu
  content: string;
  originalLanguage: string;
  messageType: MessageType;
  
  // Métadonnées
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  replyToId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
  
  // Sender résolu (authentifié ou anonyme)
  sender?: User | AnonymousParticipant;
  
  // Traductions disponibles (peut être vide pour nouveaux messages)
  translations: MessageTranslation[];
  
  // Message de réponse référencé
  replyTo?: GatewayMessage;
}

// ===== 2. MESSAGES UI (Interface utilisateur) =====

/**
 * État de traduction pour l'interface utilisateur
 */
export interface UITranslationState {
  language: string;           // Langue cible
  content: string;           // Contenu traduit
  status: 'pending' | 'translating' | 'completed' | 'failed';
  timestamp: Date;
  confidence?: number;       // Score de confiance 0-1
  model?: 'basic' | 'medium' | 'premium';
  error?: string;           // Message d'erreur si échec
  fromCache: boolean;       // Indique si traduit depuis le cache
}

/**
 * Message enrichi pour l'interface utilisateur
 * Utilisé par BubbleMessage pour affichage avec états visuels
 */
export interface UIMessage extends GatewayMessage {
  // ===== ÉTATS VISUELS =====
  
  // Traductions avec états UI
  uiTranslations: UITranslationState[];
  
  // États de traduction en cours par langue
  translatingLanguages: Set<string>;
  
  // Affichage actuel
  currentDisplayLanguage: string;
  showingOriginal: boolean;
  
  // ===== MÉTADONNÉES UI =====
  
  // Contenu original conservé
  originalContent: string;
  
  // Statuts de lecture (pour conversations de groupe)
  readStatus?: Array<{ userId: string; readAt?: Date; receivedAt?: Date }>;
  
  // Localisation (pour messages géolocalisés)
  location?: string;
  
  // ===== ACTIONS DISPONIBLES =====
  
  // Actions possibles selon les permissions
  canEdit: boolean;
  canDelete: boolean;
  canTranslate: boolean;
  canReply: boolean;
}

// ===== UTILITAIRES DE CONVERSION =====

/**
 * Convertit un GatewayMessage en UIMessage
 */
export function gatewayToUIMessage(
  gatewayMessage: GatewayMessage,
  userLanguage: string,
  userPermissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canTranslate?: boolean;
    canReply?: boolean;
  }
): UIMessage {
  // Convertir les traductions Gateway en états UI
  const uiTranslations: UITranslationState[] = gatewayMessage.translations.map(t => ({
    language: t.targetLanguage,
    content: t.translatedContent,
    status: 'completed' as const,
    timestamp: t.createdAt,
    confidence: t.confidenceScore,
    model: t.translationModel,
    fromCache: t.cached
  }));

  return {
    ...gatewayMessage,
    uiTranslations,
    translatingLanguages: new Set(),
    currentDisplayLanguage: userLanguage,
    showingOriginal: gatewayMessage.originalLanguage === userLanguage,
    originalContent: gatewayMessage.content,
    canEdit: userPermissions?.canEdit ?? false,
    canDelete: userPermissions?.canDelete ?? false,
    canTranslate: userPermissions?.canTranslate ?? true,
    canReply: userPermissions?.canReply ?? true
  };
}

/**
 * Ajoute un état de traduction en cours à un UIMessage
 */
export function addTranslatingState(
  message: UIMessage,
  targetLanguage: string
): UIMessage {
  const translatingLanguages = new Set(message.translatingLanguages);
  translatingLanguages.add(targetLanguage);

  // Ajouter ou mettre à jour l'état UI
  const uiTranslations = [...message.uiTranslations];
  const existingIndex = uiTranslations.findIndex(t => t.language === targetLanguage);
  
  if (existingIndex >= 0) {
    uiTranslations[existingIndex] = {
      ...uiTranslations[existingIndex],
      status: 'translating'
    };
  } else {
    uiTranslations.push({
      language: targetLanguage,
      content: '',
      status: 'translating',
      timestamp: new Date(),
      fromCache: false
    });
  }

  return {
    ...message,
    translatingLanguages,
    uiTranslations
  };
}

/**
 * Met à jour le résultat d'une traduction dans un UIMessage
 */
export function updateTranslationResult(
  message: UIMessage,
  targetLanguage: string,
  result: {
    content?: string;
    status: 'completed' | 'failed';
    error?: string;
    confidence?: number;
    model?: 'basic' | 'medium' | 'premium';
    fromCache?: boolean;
  }
): UIMessage {
  const translatingLanguages = new Set(message.translatingLanguages);
  translatingLanguages.delete(targetLanguage);

  const uiTranslations = message.uiTranslations.map(t =>
    t.language === targetLanguage
      ? {
          ...t,
          content: result.content || t.content,
          status: result.status,
          error: result.error,
          confidence: result.confidence,
          model: result.model,
          fromCache: result.fromCache ?? false,
          timestamp: new Date()
        }
      : t
  );

  return {
    ...message,
    translatingLanguages,
    uiTranslations
  };
}

/**
 * Obtient le contenu à afficher selon la langue
 */
export function getDisplayContent(message: UIMessage): string {
  if (message.showingOriginal) {
    return message.originalContent;
  }

  const translation = message.uiTranslations.find(
    t => t.language === message.currentDisplayLanguage && t.status === 'completed'
  );

  return translation?.content || message.originalContent;
}

/**
 * Vérifie si une traduction est en cours pour une langue
 */
export function isTranslating(message: UIMessage, targetLanguage: string): boolean {
  return message.translatingLanguages.has(targetLanguage);
}

/**
 * Vérifie si une traduction est disponible pour une langue
 */
export function hasTranslation(message: UIMessage, targetLanguage: string): boolean {
  return message.uiTranslations.some(
    t => t.language === targetLanguage && t.status === 'completed'
  );
}

// ===== TYPES D'EXPORT =====

// Types legacy pour compatibilité (à supprimer progressivement)
export type Message = GatewayMessage;
export type MessageWithTranslations = GatewayMessage;
export type BubbleStreamMessage = UIMessage;