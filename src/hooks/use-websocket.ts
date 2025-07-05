'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Message } from '@/types';
import webSocketService from '@/lib/websocket-service';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Connecter au WebSocket au montage du composant
    webSocketService.connect();

    // Event listeners
    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    const handleMessageSent = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    const handleUserStatusChanged = (data: { userId: string; isOnline: boolean }) => {
      setOnlineUsers(prev => 
        prev.map(user => 
          user.id === data.userId 
            ? { ...user, isOnline: data.isOnline }
            : user
        )
      );
    };

    // Ajouter les event listeners
    if (webSocketService.isConnected) {
      setIsConnected(true);
      setConnectionError(null);
    }

    webSocketService.onNewMessage(handleNewMessage);
    webSocketService.onMessageSent(handleMessageSent);
    webSocketService.onUserStatusChanged(handleUserStatusChanged);

    // Cleanup
    return () => {
      webSocketService.removeListener('newMessage');
      webSocketService.removeListener('messageSent');
      webSocketService.removeListener('userStatusChanged');
    };
  }, []);

  const loginUser = useCallback(async (userId: string) => {
    try {
      const response = await webSocketService.loginUser(userId);
      if (response.success && response.data) {
        setCurrentUser(response.data);
        setConnectionError(null);
        
        // Récupérer la liste des utilisateurs en ligne
        const onlineResponse = await webSocketService.getOnlineUsers();
        if (onlineResponse.success && onlineResponse.data) {
          setOnlineUsers(onlineResponse.data);
        }
      } else {
        setConnectionError(response.error || 'Erreur de connexion');
      }
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setConnectionError(errorMessage);
      throw error;
    }
  }, []);

  const sendMessage = useCallback(async (
    recipientId: string,
    content: string,
    originalLanguage: string
  ) => {
    try {
      const response = await webSocketService.sendMessage(recipientId, content, originalLanguage);
      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de l\'envoi du message');
      }
      return response;
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      throw error;
    }
  }, []);

  const getChatHistory = useCallback(async (otherUserId: string) => {
    try {
      const response = await webSocketService.getChatHistory(otherUserId);
      if (response.success && response.data) {
        setMessages(response.data);
      }
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      throw error;
    }
  }, []);

  const updateUserSettings = useCallback(async (settings: Partial<User>) => {
    try {
      const response = await webSocketService.updateUserSettings(settings);
      if (response.success && response.data) {
        setCurrentUser(response.data);
      }
      return response;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
    setIsConnected(false);
    setCurrentUser(null);
    setOnlineUsers([]);
    setMessages([]);
    setConnectionError(null);
  }, []);

  return {
    // État
    isConnected,
    currentUser,
    onlineUsers,
    messages,
    connectionError,
    
    // Actions
    loginUser,
    sendMessage,
    getChatHistory,
    updateUserSettings,
    disconnect,
  };
}
