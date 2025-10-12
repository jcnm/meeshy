/**
 * Hook unifié pour la messagerie
 * Combine l'envoi de messages et les indicateurs de frappe
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

interface TypingUser {
  userId: string;
  username: string;
  conversationId: string;
  timestamp: number;
}

interface UseMessagingOptions {
  conversationId?: string;
  currentUser?: User;
  onMessageSent?: (content: string, language: string) => void;
  onMessageFailed?: (content: string, error: Error) => void;
  onNewMessage?: (message: any) => void;
  onUserTyping?: (userId: string, username: string, isTyping: boolean) => void;
  onUserStatus?: (userId: string, username: string, isOnline: boolean) => void;
  onTranslation?: (messageId: string, translations: any[]) => void;
  onConversationStats?: (data: any) => void;
}

interface UseMessagingReturn {
  // État d'envoi
  isSending: boolean;
  sendError: string | null;
  
  // Actions de messagerie
  sendMessage: (content: string, originalLanguage?: string, replyToId?: string) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  
  // Indicateurs de frappe
  typingUsers: TypingUser[];
  isTyping: boolean;
  startTyping: () => void;
  stopTyping: () => void;
  
  // Socket.IO messaging
  socketMessaging: ReturnType<typeof useSocketIOMessaging>;
}

export function useMessaging(options: UseMessagingOptions = {}): UseMessagingReturn {
  const {
    conversationId,
    currentUser,
    onMessageSent,
    onMessageFailed,
    onNewMessage,
    onUserTyping,
    onUserStatus,
    onTranslation,
    onConversationStats
  } = options;

  // État d'envoi
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Indicateurs de frappe
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket.IO messaging
  const socketMessaging = useSocketIOMessaging({
    conversationId,
    currentUser,
    events: {
      message: true,
      edit: true,
      delete: true,
      translation: true,
      typing: true,
      status: true,
      conversationStats: true,
      onlineStats: true
    },
    onNewMessage,
    onUserTyping: (userId, username, isTyping) => {
      handleTypingEvent(userId, username, isTyping);
      onUserTyping?.(userId, username, isTyping);
    },
    onUserStatus,
    onTranslation,
    onConversationStats
  });

  // Gestion des indicateurs de frappe
  const handleTypingEvent = useCallback((userId: string, username: string, isTyping: boolean) => {
    setTypingUsers(prev => {
      if (isTyping) {
        // Ajouter ou mettre à jour l'utilisateur qui tape
        const existingUserIndex = prev.findIndex(user => user.userId === userId);
        const newUser = {
          userId,
          username,
          conversationId: conversationId || '',
          timestamp: Date.now()
        };

        if (existingUserIndex >= 0) {
          const updated = [...prev];
          updated[existingUserIndex] = newUser;
          return updated;
        } else {
          return [...prev, newUser];
        }
      } else {
        // Retirer l'utilisateur qui ne tape plus
        return prev.filter(user => user.userId !== userId);
      }
    });
  }, [conversationId]);

  // Actions de frappe
  const startTyping = useCallback(() => {
    if (!isTyping && conversationId && currentUser) {
      setIsTyping(true);
      socketMessaging.startTyping(conversationId);
      
      // Auto-stop après 3 secondes
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    }
  }, [isTyping, conversationId, currentUser, socketMessaging]);

  const stopTyping = useCallback(() => {
    if (isTyping && conversationId && currentUser) {
      setIsTyping(false);
      socketMessaging.stopTyping(conversationId);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [isTyping, conversationId, currentUser, socketMessaging]);

  // Envoi de message
  const sendMessage = useCallback(async (content: string, originalLanguage?: string, replyToId?: string): Promise<boolean> => {
    if (!conversationId || !currentUser) {
      console.error('[MESSAGING] Cannot send message: missing conversationId or currentUser');
      return false;
    }

    // Validation du contenu
    const validationResult = validateMessageContent(content);
    if (!validationResult.isValid) {
      setSendError(validationResult.error || 'Invalid message content');
      toast.error(validationResult.error || 'Invalid message content');
      return false;
    }

    setIsSending(true);
    setSendError(null);

    try {
      // Préparer les métadonnées
      const metadata = prepareMessageMetadata(content, originalLanguage);
      
      // Log de l'envoi
      logMessageSend(content, conversationId, currentUser);

      // Envoyer via Socket.IO
      const success = await socketMessaging.sendMessage(content, originalLanguage, replyToId);

      if (success) {
        // Arrêter la frappe
        stopTyping();
        
        // Log du succès
        logMessageSuccess(content, conversationId);
        
        // Callback de succès
        onMessageSent?.(content, originalLanguage || metadata.sourceLanguage);
        
        return true;
      } else {
        throw new Error('Failed to send message via Socket.IO');
      }
    } catch (error) {
      const errorMessage = handleMessageError(error);
      setSendError(errorMessage);
      toast.error(errorMessage);
      
      // Callback d'erreur
      onMessageFailed?.(content, error as Error);
      
      return false;
    } finally {
      setIsSending(false);
    }
  }, [conversationId, currentUser, socketMessaging, onMessageSent, onMessageFailed, stopTyping]);

  // Édition de message
  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    setIsSending(true);
    setSendError(null);

    try {
      const success = await socketMessaging.editMessage(messageId, newContent);
      if (success) {
        toast.success('Message edited successfully');
      }
      return success;
    } catch (error) {
      const errorMessage = handleMessageError(error);
      setSendError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsSending(false);
    }
  }, [socketMessaging]);

  // Suppression de message
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    setIsSending(true);
    setSendError(null);

    try {
      const success = await socketMessaging.deleteMessage(messageId);
      if (success) {
        toast.success('Message deleted successfully');
      }
      return success;
    } catch (error) {
      const errorMessage = handleMessageError(error);
      setSendError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsSending(false);
    }
  }, [socketMessaging]);

  // Nettoyage des timeouts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Nettoyage des utilisateurs qui tapent (après 5 secondes)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => 
        prev.filter(user => now - user.timestamp < 5000)
      );
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  return {
    // État d'envoi
    isSending,
    sendError,
    
    // Actions de messagerie
    sendMessage,
    editMessage,
    deleteMessage,
    
    // Indicateurs de frappe
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
    
    // Socket.IO messaging
    socketMessaging
  };
}
