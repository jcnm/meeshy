/**
 * Hook réutilisable pour l'envoi de messages
 * Basé sur la logique éprouvée de BubbleStreamPage
 */

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useSocketIOMessaging } from './use-socketio-messaging';
import { 
  validateMessageContent, 
  prepareMessageMetadata, 
  logMessageSend, 
  logMessageSuccess,
  handleMessageError,
  createStandardMessageCallbacks
} from '@/utils/messaging-utils';
import type { User } from '@/types';

interface UseMessageSenderOptions {
  conversationId?: string;
  currentUser?: User;
  onMessageSent?: (content: string, language: string) => void;
  onMessageFailed?: (content: string, error: Error) => void;
  onNewMessage?: (message: any) => void;
  onUserTyping?: (userId: string, username: string, isTyping: boolean) => void;
  onUserStatus?: (userId: string, username: string, isOnline: boolean) => void;
  onTranslation?: (messageId: string, translations: any[]) => void;
  onConversationStats?: (data: any) => void;
  onConversationOnlineStats?: (data: any) => void;
}

interface UseMessageSenderReturn {
  // États
  isSending: boolean;
  connectionStatus: {
    isConnected: boolean;
    hasSocket: boolean;
    currentUser: string;
  };
  
  // Actions principales
  sendMessage: (content: string, sourceLanguage?: string) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  
  // Actions de frappe
  startTyping: () => void;
  stopTyping: () => void;
  
  // Connexion
  reconnect: () => void;
  getDiagnostics: () => any;
}

export function useMessageSender(options: UseMessageSenderOptions): UseMessageSenderReturn {
  const {
    conversationId,
    currentUser,
    onMessageSent,
    onMessageFailed,
    ...callbackOptions
  } = options;

  const [isSending, setIsSending] = useState(false);

  // Créer les callbacks standardisés
  const standardCallbacks = createStandardMessageCallbacks(callbackOptions);

  // Utiliser le hook SocketIO avec tous les callbacks
  const {
    sendMessage: sendMessageToService,
    editMessage,
    deleteMessage,
    connectionStatus,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics
  } = useSocketIOMessaging({
    conversationId,
    currentUser,
    ...standardCallbacks
  });

  // Fonction d'envoi de message réutilisable basée sur BubbleStreamPage
  const sendMessage = useCallback(async (content: string, sourceLanguage?: string): Promise<boolean> => {
    // Validation du contenu
    const validation = validateMessageContent(content);
    if (!validation.isValid) {
      console.warn('⚠️ useMessageSender:', validation.error);
      if (validation.error) {
        toast.error(validation.error);
      }
      return false;
    }

    if (!conversationId) {
      console.error('❌ useMessageSender: Aucune conversation spécifiée');
      toast.error('Erreur: aucune conversation sélectionnée');
      return false;
    }

    const messageContent = content.trim();
    const language = sourceLanguage || 'fr';
    setIsSending(true);

    // Log standardisé
    logMessageSend(messageContent, language, conversationId);

    try {
      // Vérifier l'état de la connexion avant l'envoi (comme dans BubbleStreamPage)
      if (!connectionStatus.isConnected) {
        console.log('⚠️ useMessageSender: WebSocket non connecté - Impossible d\'envoyer le message');
        toast.warning('Connexion en cours - Veuillez patienter...');
        return false;
      }

      // Préparer les métadonnées du message
      const messageMetadata = prepareMessageMetadata(messageContent, language);
      
      console.log('📤 useMessageSender: Envoi du message avec métadonnées:', messageMetadata);
      
      // Envoyer le message avec la langue source sélectionnée
      const sendResult = await sendMessageToService(messageContent, language);
      
      if (sendResult) {
        // Log de succès standardisé
        logMessageSuccess(messageContent, language);
        toast.success('Message envoyé !');
        
        // Callback de succès
        onMessageSent?.(messageContent, language);
        
        return true;
      } else {
        throw new Error('L\'envoi du message a échoué');
      }
      
    } catch (wsError) {
      console.error('❌ useMessageSender: Erreur envoi WebSocket:', wsError);
      
      // Gestion d'erreur standardisée
      const errorMessage = handleMessageError(wsError, messageContent);
      toast.error(errorMessage);
      
      // Callback d'erreur
      const error = wsError instanceof Error ? wsError : new Error('Erreur inconnue');
      onMessageFailed?.(messageContent, error);
      
      return false;
    } finally {
      setIsSending(false);
    }
  }, [
    conversationId,
    connectionStatus.isConnected,
    sendMessageToService,
    onMessageSent,
    onMessageFailed
  ]);

  return {
    isSending,
    connectionStatus,
    sendMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics
  };
}
