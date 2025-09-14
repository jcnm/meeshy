/**
 * TYPES DE MESSAGES UNIFIÉS POUR MEESHY
 * ======================================
 * 
 * Architecture simplifiée avec 2 types principaux :
 * 1. Message - Type de base pour toutes les communications
 * 2. MessageWithTranslations - Message enrichi avec traductions et états UI
 * 
 * RÈGLES :
 * - TOUS les services utilisent ces types
 * - Pas de duplication de types message
 * - Compatibilité totale Gateway ↔ Frontend ↔ Translator
 */

import type { SocketIOUser as User, MessageType } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';

// ===== 1. TYPE DE BASE UNIFIÉ =====

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
 * MESSAGE UNIFIÉ - Type principal pour toutes les communications
 * Utilisé par :
 * - Gateway (API, WebSocket, Socket.IO)
 * - Frontend (affichage, état)
 * - Translator (traitement)
 * 
 * Remplace : SocketIOMessage, GatewayMessage, Message de conversation.ts
 */
export interface Message {
  // ===== IDENTIFIANTS =====
  id: string;
  conversationId: string;
  senderId?: string;           // ID utilisateur authentifié
  anonymousSenderId?: string;  // ID utilisateur anonyme
  
  // ===== CONTENU =====
  content: string;
  originalLanguage: string;
  messageType: MessageType;
  
  // ===== MÉTADONNÉES =====
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  replyToId?: string;
  
  // ===== TIMESTAMPS =====
  createdAt: Date;
  updatedAt?: Date;
  
  // ===== EXPÉDITEUR RÉSOLU =====
  // Union type pour sender (authentifié ou anonyme)
  sender?: User | AnonymousParticipant;
  
  // ===== TRADUCTIONS =====
  // Peut être vide pour nouveaux messages
  translations: MessageTranslation[];
  
  // ===== MESSAGE DE RÉPONSE =====
  replyTo?: Message;
  
  // ===== COMPATIBILITÉ =====
  // Champs pour compatibilité avec l'ancien système
  timestamp: Date;  // Alias pour createdAt (required for compatibility)
  anonymousSender?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    language: string;
    isMeeshyer: boolean;
  };
}

// ===== 2. TYPE ENRICHI POUR UI =====

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
 * MESSAGE AVEC TRADUCTIONS - Type enrichi pour l'interface utilisateur
 * Utilisé par :
 * - BubbleMessage (affichage avec états visuels)
 * - ConversationLayoutResponsive (gestion des traductions)
 * - MessagesDisplay (rendu des messages)
 * 
 * Remplace : UIMessage, TranslatedMessage, MessageWithTranslations legacy
 */
export interface MessageWithTranslations extends Message {
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
  readStatus?: Array<{ userId: string; readAt: Date }>;
  
  // Localisation (pour messages géolocalisés)
  location?: string;
  
  // ===== ACTIONS DISPONIBLES =====
  
  // Actions possibles selon les permissions
  canEdit: boolean;
  canDelete: boolean;
  canTranslate: boolean;
  canReply: boolean;
  
  // ===== COMPATIBILITÉ LEGACY =====
  // Champs pour compatibilité avec l'ancien système
  translation?: {
    content: string;
    targetLanguage: string;
    isTranslated: boolean;
    isTranslating: boolean;
    showingOriginal: boolean;
    translationError?: string;
    translationFailed?: boolean;
  };
  translatedContent?: string;
  targetLanguage?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  translationError?: string;
  translationFailed?: boolean;
}

// ===== 3. UTILITAIRES DE CONVERSION =====

/**
 * Convertit un Message en MessageWithTranslations
 */
export function messageToMessageWithTranslations(
  message: Message,
  userLanguage: string,
  userPermissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canTranslate?: boolean;
    canReply?: boolean;
  }
): MessageWithTranslations {
  // Convertir les traductions en états UI
  const uiTranslations: UITranslationState[] = message.translations.map(t => ({
    language: t.targetLanguage,
    content: t.translatedContent,
    status: 'completed' as const,
    timestamp: t.createdAt,
    confidence: t.confidenceScore,
    model: t.translationModel,
    fromCache: t.cached
  }));

  return {
    ...message,
    uiTranslations,
    translatingLanguages: new Set(),
    currentDisplayLanguage: userLanguage,
    showingOriginal: message.originalLanguage === userLanguage,
    originalContent: message.content,
    canEdit: userPermissions?.canEdit ?? false,
    canDelete: userPermissions?.canDelete ?? false,
    canTranslate: userPermissions?.canTranslate ?? true,
    canReply: userPermissions?.canReply ?? true
  };
}

/**
 * Ajoute un état de traduction en cours à un MessageWithTranslations
 */
export function addTranslatingState(
  message: MessageWithTranslations,
  targetLanguage: string
): MessageWithTranslations {
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
 * Met à jour le résultat d'une traduction dans un MessageWithTranslations
 */
export function updateTranslationResult(
  message: MessageWithTranslations,
  targetLanguage: string,
  result: {
    content?: string;
    status: 'completed' | 'failed';
    error?: string;
    confidence?: number;
    model?: 'basic' | 'medium' | 'premium';
    fromCache?: boolean;
  }
): MessageWithTranslations {
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
export function getDisplayContent(message: MessageWithTranslations): string {
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
export function isTranslating(message: MessageWithTranslations, targetLanguage: string): boolean {
  return message.translatingLanguages.has(targetLanguage);
}

/**
 * Vérifie si une traduction est disponible pour une langue
 */
export function hasTranslation(message: MessageWithTranslations, targetLanguage: string): boolean {
  return message.uiTranslations.some(
    t => t.language === targetLanguage && t.status === 'completed'
  );
}

// ===== 4. EXPORTS POUR COMPATIBILITÉ =====

// Types legacy pour compatibilité (à supprimer progressivement)
export type GatewayMessage = Message;
export type UIMessage = MessageWithTranslations;
export type BubbleStreamMessage = MessageWithTranslations;

// Export des types principaux
export type {
  Message,
  MessageWithTranslations,
  MessageTranslation,
  UITranslationState
};
