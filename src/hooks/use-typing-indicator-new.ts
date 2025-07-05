'use client';

import { useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { User } from '@/types';

interface TypingUser {
  id: string;
  username: string;
  displayName?: string;
  lastUpdate: number;
}

interface UseTypingIndicatorReturn {
  typingUsers: Record<string, TypingUser[]>;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  isUserTyping: (userId: string, conversationId: string) => boolean;
}

export function useTypingIndicator(
  socket: Socket | null,
  currentUserId?: string
): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});

  // Nettoyer les indicateurs de frappe expirés
  useEffect(() => {
    const cleanup = setInterval(() => {
      setTypingUsers(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(conversationId => {
          const filtered = updated[conversationId].filter(user => {
            // Garder les utilisateurs qui tapent encore
            return Date.now() - user.lastUpdate < 5000;
          });
          
          if (filtered.length !== updated[conversationId].length) {
            updated[conversationId] = filtered;
            hasChanges = true;
          }
          
          if (filtered.length === 0) {
            delete updated[conversationId];
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Écouter les événements de frappe
  useEffect(() => {
    if (!socket) return;

    const handleTypingStart = (data: { 
      userId: string; 
      conversationId: string; 
      user: TypingUser;
    }) => {
      if (data.userId === currentUserId) return; // Ignorer sa propre frappe

      setTypingUsers(prev => ({
        ...prev,
        [data.conversationId]: [
          ...(prev[data.conversationId] || []).filter(u => u.id !== data.userId),
          { ...data.user, lastUpdate: Date.now() }
        ]
      }));
    };

    const handleTypingStop = (data: { 
      userId: string; 
      conversationId: string;
    }) => {
      if (data.userId === currentUserId) return;

      setTypingUsers(prev => {
        const updated = { ...prev };
        if (updated[data.conversationId]) {
          updated[data.conversationId] = updated[data.conversationId].filter(
            u => u.id !== data.userId
          );
          if (updated[data.conversationId].length === 0) {
            delete updated[data.conversationId];
          }
        }
        return updated;
      });
    };

    socket.on('userStartTyping', handleTypingStart);
    socket.on('userStopTyping', handleTypingStop);

    return () => {
      socket.off('userStartTyping', handleTypingStart);
      socket.off('userStopTyping', handleTypingStop);
    };
  }, [socket, currentUserId]);

  const startTyping = useCallback((conversationId: string) => {
    if (socket && currentUserId) {
      socket.emit('startTyping', { conversationId });
    }
  }, [socket, currentUserId]);

  const stopTyping = useCallback((conversationId: string) => {
    if (socket && currentUserId) {
      socket.emit('stopTyping', { conversationId });
    }
  }, [socket, currentUserId]);

  const isUserTyping = useCallback((userId: string, conversationId: string) => {
    return typingUsers[conversationId]?.some(user => user.id === userId) || false;
  }, [typingUsers]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    isUserTyping
  };
}
