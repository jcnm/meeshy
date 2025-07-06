'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/context/AppContext';
import { io, Socket } from 'socket.io-client';

interface UseOptimizedWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
}

interface SocketEvent {
  event: string;
  data: unknown;
  timestamp: Date;
}

export function useOptimizedWebSocket(options: UseOptimizedWebSocketOptions = {}) {
  const { url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', autoConnect = true } = options;
  const { user } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersRef = useRef<Map<string, (data: unknown) => void>>(new Map());

  const connect = useCallback(() => {
    if (socket?.connected) {
      return;
    }

    try {
      const newSocket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        auth: {
          userId: user?.id,
          token: localStorage.getItem('auth_token'),
        },
      });

      newSocket.on('connect', () => {
        console.log('WebSocket connecté');
        setIsConnected(true);
        setConnectionError(null);
        
        // Rejoindre les rooms appropriées
        if (user?.id) {
          newSocket.emit('join-user-room', user.id);
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket déconnecté:', reason);
        setIsConnected(false);
        
        // Reconnexion automatique si nécessaire
        if (reason === 'io server disconnect') {
          // Le serveur a fermé la connexion, reconnecter automatiquement
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 1000);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Erreur de connexion WebSocket:', error);
        setConnectionError(error.message);
        setIsConnected(false);
      });

      // Réenregistrer tous les listeners existants
      eventListenersRef.current.forEach((callback, event) => {
        newSocket.on(event, callback);
      });

      setSocket(newSocket);
      
    } catch (error) {
      console.error('Erreur lors de la création du socket:', error);
      setConnectionError(error instanceof Error ? error.message : 'Erreur de connexion');
    }
  }, [url, user?.id, socket?.connected]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socket?.connected) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }, [socket]);

  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    // Stocker le listener pour le réenregistrer lors de reconnexions
    eventListenersRef.current.set(event, callback);
    
    if (socket) {
      socket.on(event, (data: unknown) => {
        setLastEvent({ event, data, timestamp: new Date() });
        callback(data);
      });
    }
  }, [socket]);

  const off = useCallback((event: string) => {
    eventListenersRef.current.delete(event);
    
    if (socket) {
      socket.off(event);
    }
  }, [socket]);

  // Gérer les changements d'utilisateur
  useEffect(() => {
    if (user && autoConnect) {
      connect();
    } else if (!user) {
      disconnect();
    }
  }, [user, autoConnect, connect, disconnect]);

  // Cleanup à la fin du composant
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Méthodes de convenance pour les événements communs
  const joinConversation = useCallback((conversationId: string) => {
    return emit('join-conversation', { conversationId });
  }, [emit]);

  const leaveConversation = useCallback((conversationId: string) => {
    return emit('leave-conversation', { conversationId });
  }, [emit]);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    return emit('send-message', { conversationId, content });
  }, [emit]);

  const sendTypingIndicator = useCallback((conversationId: string, isTyping: boolean) => {
    return emit('typing', { conversationId, isTyping });
  }, [emit]);

  return {
    socket,
    isConnected,
    connectionError,
    lastEvent,
    connect,
    disconnect,
    emit,
    on,
    off,
    // Méthodes de convenance
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTypingIndicator,
  };
}
