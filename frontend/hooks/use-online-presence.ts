'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '@/lib/config';

interface OnlineUser {
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface UseOnlinePresenceReturn {
  onlineUsers: Map<string, OnlineUser>;
  isUserOnline: (userId: string) => boolean;
  connectToPresence: (token: string) => void;
  disconnectFromPresence: () => void;
}

export const useOnlinePresence = (): UseOnlinePresenceReturn => {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [socket, setSocket] = useState<Socket | null>(null);

  const connectToPresence = useCallback((token: string) => {
    // Ne pas se connecter pendant le build SSR
    if (typeof window === 'undefined') {
      return;
    }
    
    if (socket?.connected) return;

    const newSocket = io(APP_CONFIG.getBackendUrl(), {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('🟢 Connecté au service de présence');
    });

    newSocket.on('userStatusUpdate', (data: OnlineUser) => {
      setOnlineUsers(prev => new Map(prev.set(data.userId, data)));
    });

    newSocket.on('userConnected', (data: OnlineUser) => {
      setOnlineUsers(prev => new Map(prev.set(data.userId, { ...data, isOnline: true })));
    });

    newSocket.on('userDisconnected', (data: OnlineUser) => {
      setOnlineUsers(prev => new Map(prev.set(data.userId, { 
        ...data, 
        isOnline: false, 
        lastSeen: new Date() 
      })));
    });

    newSocket.on('disconnect', () => {
      console.log('🔴 Déconnecté du service de présence');
    });

    setSocket(newSocket);
  }, [socket]);

  const disconnectFromPresence = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [socket]);

  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUsers.get(userId)?.isOnline || false;
  }, [onlineUsers]);

  useEffect(() => {
    return () => {
      disconnectFromPresence();
    };
  }, [disconnectFromPresence]);

  return {
    onlineUsers,
    isUserOnline,
    connectToPresence,
    disconnectFromPresence,
  };
};
