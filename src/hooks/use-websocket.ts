'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseWebSocketReturn {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
  isConnected: boolean;
}

export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Récupérer le token JWT depuis localStorage
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.warn('⚠️ Aucun token JWT trouvé, connexion WebSocket refusée');
      return;
    }

    // Créer la connexion socket avec authentification
    const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: {
        token: token,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connecté');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket déconnecté');
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('❌ Erreur WebSocket:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, ...args);
    }
  }, [isConnected]);

  return {
    on,
    off,
    emit,
    isConnected,
  };
}
