'use client';

import { useState, useEffect } from 'react';
import { useMessaging } from './use-messaging';
import { messagingService } from '@/services/messaging.service';

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
  
  // Hook de messagerie unifié
  const messaging = useMessaging({
    conversationId,
    currentUser: undefined, // sera récupéré du contexte par le hook
  });

  // Écouter les événements de frappe via le service de messagerie
  useEffect(() => {
    console.log('🔄 TypingIndicator: Initialisation pour conversation', conversationId, 'utilisateur', currentUserId);
    
    const unsubscribeTyping = messagingService.onTyping((event: TypingEvent) => {
      // Filtrer pour la conversation actuelle et exclure l'utilisateur actuel
      if (event.conversationId === conversationId && event.userId !== currentUserId) {
        if (event.isTyping) {
          // Ajouter l'utilisateur en train de taper
          setTypingUsers(prev => {
            const existingIndex = prev.findIndex(user => user.userId === event.userId);
            const typingUser: TypingUser = {
              userId: event.userId,
              username: event.username,
              conversationId: event.conversationId,
              timestamp: Date.now()
            };
            
            if (existingIndex >= 0) {
              // Mettre à jour le timestamp
              const updated = [...prev];
              updated[existingIndex] = typingUser;
              return updated;
            } else {
              // Ajouter un nouveau utilisateur
              return [...prev, typingUser];
            }
          });
        } else {
          // Retirer l'utilisateur qui a arrêté de taper
          setTypingUsers(prev => prev.filter(user => user.userId !== event.userId));
        }
      }
    });
    
    return () => {
      console.log('🔄 TypingIndicator: Nettoyage pour conversation', conversationId);
      unsubscribeTyping();
    };
  }, [conversationId, currentUserId]);

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
