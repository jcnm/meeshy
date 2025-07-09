'use client';

import { useState, useEffect } from 'react';
import { useMessaging } from './use-messaging';

interface TypingUser {
  userId: string;
  username: string;
  conversationId: string;
  timestamp: number;
}

export function useTypingIndicator(conversationId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // Hook de messagerie unifié
  const messaging = useMessaging({
    conversationId,
    currentUser: undefined, // sera récupéré du contexte par le hook
  });

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

  // TODO: Implémenter l'écoute des événements de frappe via useMessaging
  // En attendant, on garde une interface compatible mais sans fonctionnalité
  
  return {
    typingUsers,
    startTyping: messaging.startTyping,
    stopTyping: messaging.stopTyping
  };
}
