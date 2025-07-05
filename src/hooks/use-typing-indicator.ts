'use client';

import { useState, useEffect } from 'react';
import { useOptimizedWebSocket } from './optimized';

interface TypingUser {
  userId: string;
  username: string;
  conversationId: string;
  timestamp: number;
}

export function useTypingIndicator(conversationId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { on, off, emit, isConnected } = useOptimizedWebSocket();

  // Nettoyer les anciens indicateurs de frappe
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => 
        prev.filter(user => now - user.timestamp < 3000) // 3 secondes
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Écouter les indicateurs de frappe
  useEffect(() => {
    if (!isConnected) return;

    const handleUserTyping = (data: unknown) => {
      const typingData = data as {
        userId: string;
        username: string;
        conversationId: string;
      };

      if (typingData.conversationId === conversationId && typingData.userId !== currentUserId) {
        setTypingUsers(prev => {
          const filtered = prev.filter(user => user.userId !== typingData.userId);
          return [...filtered, {
            ...typingData,
            timestamp: Date.now()
          }];
        });
      }
    };

    const handleUserStoppedTyping = (data: unknown) => {
      const typingData = data as {
        userId: string;
        conversationId: string;
      };

      if (typingData.conversationId === conversationId) {
        setTypingUsers(prev => 
          prev.filter(user => user.userId !== typingData.userId)
        );
      }
    };

    on('user_typing', handleUserTyping);
    on('user_stopped_typing', handleUserStoppedTyping);

    return () => {
      off('user_typing');
      off('user_stopped_typing');
    };
  }, [isConnected, conversationId, currentUserId, on, off]);

  // Envoyer un indicateur de frappe
  const startTyping = () => {
    if (isConnected) {
      emit('start_typing', { conversationId });
    }
  };

  // Arrêter l'indicateur de frappe
  const stopTyping = () => {
    if (isConnected) {
      emit('stop_typing', { conversationId });
    }
  };

  return {
    typingUsers,
    startTyping,
    stopTyping
  };
}
