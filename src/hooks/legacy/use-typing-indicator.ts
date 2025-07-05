'use client';

import { useState, useCallback, useEffect } from 'react';
import webSocketService from '@/lib/websocket-service';

interface TypingUser {
  userId: string;
  chatId: string;
  timestamp: number;
}

interface UseTypingIndicatorReturn {
  typingUsers: TypingUser[];
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  isUserTyping: (userId: string, chatId: string) => boolean;
}

export const useTypingIndicator = (): UseTypingIndicatorReturn => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Nettoyer les indicateurs de frappe expirés
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => 
        prev.filter(user => now - user.timestamp < 5000) // Supprimer après 5 secondes
      );
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Écouter les événements de frappe
  useEffect(() => {
    const handleUserTyping = (data: { userId: string; chatId: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const filtered = prev.filter(user => 
          !(user.userId === data.userId && user.chatId === data.chatId)
        );

        if (data.isTyping) {
          return [...filtered, {
            userId: data.userId,
            chatId: data.chatId,
            timestamp: Date.now()
          }];
        }

        return filtered;
      });
    };

    // Ajouter l'event listener via le service WebSocket
    webSocketService.onUserTyping(handleUserTyping);

    return () => {
      webSocketService.offUserTyping(handleUserTyping);
    };
  }, []);

  const startTyping = useCallback((chatId: string) => {
    webSocketService.emitUserTyping(chatId);
  }, []);

  const stopTyping = useCallback((chatId: string) => {
    webSocketService.emitUserStoppedTyping(chatId);
  }, []);

  const isUserTyping = useCallback((userId: string, chatId: string): boolean => {
    return typingUsers.some(user => 
      user.userId === userId && 
      user.chatId === chatId &&
      Date.now() - user.timestamp < 3000
    );
  }, [typingUsers]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    isUserTyping
  };
};
