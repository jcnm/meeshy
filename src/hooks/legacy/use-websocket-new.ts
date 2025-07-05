'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, User } from '@/types';
import { buildApiUrl } from '@/lib/config';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  connect: (userId: string) => void;
  disconnect: () => void;
}

export function useWebSocket(userId?: string): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = (userId: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const token = localStorage.getItem('auth_token');
    const newSocket = io(buildApiUrl(''), {
      auth: { token, userId },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connecté');
      setIsConnected(true);
      setConnectionError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket déconnecté');
      setIsConnected(false);
      setConnectionError('Connexion interrompue');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Erreur de connexion WebSocket:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (userId) {
      connect(userId);
    }

    return () => {
      disconnect();
    };
  }, [userId]);

  return {
    socket,
    isConnected,
    connectionError,
    connect,
    disconnect
  };
}
