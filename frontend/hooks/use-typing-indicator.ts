'use client';

import { useState, useEffect } from 'react';
import { useSocketIOMessaging } from './use-socketio-messaging';

interface TypingUser {
  userId: string;
  username: string;
  conversationId: string;
  timestamp: number;
}

interface TypingEvent {
  userId: string;
  username: string;
  conversationId: string;
  isTyping: boolean;
}

export function useTypingIndicator(conversationId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // Hook de messagerie Socket.IO
  const messaging = useSocketIOMessaging({
    conversationId,
    currentUser: undefined, // sera récupéré du contexte par le hook
    onUserTyping: (userId: string, username: string, isTyping: boolean) => {
      if (userId === currentUserId) return; // Ignorer ses propres événements
      
      const now = Date.now();
      if (isTyping) {
        setTypingUsers(prev => {
          // Ajouter ou mettre à jour l'utilisateur qui tape
          const filtered = prev.filter(u => u.userId !== userId);
          return [...filtered, { userId, username, conversationId, timestamp: now }];
        });
      } else {
        setTypingUsers(prev => prev.filter(u => u.userId !== userId));
      }
    }
  });

  // Nettoyer les anciens indicateurs de frappe (timeout automatique)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => 
        prev.filter(user => now - user.timestamp < 3000) // 3 secondes
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    typingUsers,
    startTyping: messaging.startTyping,
    stopTyping: messaging.stopTyping,
    isTypingActive: typingUsers.length > 0
  };
}
