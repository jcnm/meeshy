/**
 * Utilitaires réutilisables pour la messagerie
 * Basés sur l'approche éprouvée de BubbleStreamPage
 */

import type { User, Message } from '@/types';

export interface MessageSenderConfig {
  conversationId?: string;
  currentUser?: User;
  maxMessageLength?: number;
}

export interface MessageSendOptions {
  content: string;
  sourceLanguage?: string;
  onSuccess?: (content: string, language: string) => void;
  onError?: (content: string, error: Error) => void;
  onRestoreMessage?: (content: string) => void;
}

/**
 * Validation du contenu d'un message avant envoi
 */
export function validateMessageContent(
  content: string, 
  maxLength: number = 2000
): { isValid: boolean; error?: string } {
  if (!content.trim()) {
    return { isValid: false, error: 'Le message ne peut pas être vide' };
  }
  
  if (content.length > maxLength) {
    return { isValid: false, error: `Le message ne peut pas dépasser ${maxLength} caractères` };
  }
  
  return { isValid: true };
}

/**
 * Prépare les métadonnées d'un message pour l'envoi
 */
export function prepareMessageMetadata(
  content: string,
  sourceLanguage: string,
  userLanguageChoices?: string[]
) {
  return {
    content: content.trim(),
    sourceLanguage,
    userLanguageChoices: userLanguageChoices || [],
    timestamp: Date.now()
  };
}

/**
 * Log standardisé pour l'envoi de messages
 */
export function logMessageSend(
  content: string,
  sourceLanguage: string,
  conversationId?: string
) {
  console.log('📤 Envoi du message avec langue sélectionnée:', {
    conversationId,
    content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
    sourceLanguage,
    contentLength: content.length
  });
}

/**
 * Log standardisé pour le succès d'envoi
 */
export function logMessageSuccess(
  content: string,
  sourceLanguage: string
) {
  console.log('✅ Message envoyé via WebSocket avec succès');
  console.log(`🔤 Langue source du message: ${sourceLanguage}`);
}

/**
 * Configuration standard pour les callbacks de messagerie
 */
export function createStandardMessageCallbacks(options: {
  onNewMessage?: (message: Message) => void;
  onMessageSent?: (content: string, language: string) => void;
  onMessageFailed?: (content: string, error: Error) => void;
  onUserTyping?: (userId: string, username: string, isTyping: boolean) => void;
  onUserStatus?: (userId: string, username: string, isOnline: boolean) => void;
  onTranslation?: (messageId: string, translations: any[]) => void;
  onConversationStats?: (data: any) => void;
  onConversationOnlineStats?: (data: any) => void;
}) {
  return {
    onNewMessage: (message: Message) => {
      console.log('📩 Message reçu via WebSocket:', { 
        id: message.id, 
        content: message.content, 
        senderId: message.senderId 
      });
      options.onNewMessage?.(message);
    },
    
    onUserTyping: (userId: string, username: string, isTyping: boolean) => {
      console.log('⌨️ Utilisateur en train de taper:', { userId, username, isTyping });
      options.onUserTyping?.(userId, username, isTyping);
    },
    
    onUserStatus: (userId: string, username: string, isOnline: boolean) => {
      console.log('👤 Statut utilisateur changé:', { userId, username, isOnline });
      options.onUserStatus?.(userId, username, isOnline);
    },
    
    onTranslation: (messageId: string, translations: any[]) => {
      console.log('🌐 Traductions reçues pour message:', messageId, translations);
      options.onTranslation?.(messageId, translations);
    },
    
    onConversationStats: (data: any) => {
      console.log('📊 Statistiques de conversation reçues:', data);
      options.onConversationStats?.(data);
    },
    
    onConversationOnlineStats: (data: any) => {
      console.log('📈 Statistiques en ligne reçues:', data);
      options.onConversationOnlineStats?.(data);
    }
  };
}

/**
 * Gestionnaire d'erreurs standardisé pour la messagerie
 */
export function handleMessageError(
  error: unknown,
  content: string,
  onRestoreMessage?: (content: string) => void
): string {
  console.error('❌ Erreur lors de l\'envoi du message:', error);
  
  // Restaurer le message en cas d'erreur
  onRestoreMessage?.(content);
  
  // Déterminer le message d'erreur approprié
  if (error instanceof Error) {
    if (error.message.includes('not authenticated') || error.message.includes('User not authenticated')) {
      return 'Erreur d\'authentification. Veuillez vous reconnecter.';
    }
    if (error.message.includes('not connected') || error.message.includes('WebSocket')) {
      return 'Connexion perdue. Reconnexion en cours...';
    }
    if (error.message.includes('permission') || error.message.includes('authorized')) {
      return 'Vous n\'avez pas les permissions pour envoyer des messages dans cette conversation.';
    }
    return error.message;
  }
  
  return 'Erreur lors de l\'envoi du message';
}
