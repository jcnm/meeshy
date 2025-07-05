import { useState, useEffect, useCallback, useMemo } from 'react';
import { SocketService } from '@/lib/socket.service';
import { User, Message } from '@/types';

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketService = useMemo(() => SocketService.getInstance(), []);

  useEffect(() => {
    const connect = async () => {
      try {
        await socketService.connect();
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de connexion');
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      socketService.disconnect();
      setIsConnected(false);
      setCurrentUser(null);
    };
  }, [socketService]);

  const loginUser = useCallback(async (userId: string) => {
    try {
      const user = await socketService.loginUser(userId);
      setCurrentUser(user);
      setError(null);
      
      // Récupérer la liste des utilisateurs en ligne
      const users = await socketService.getOnlineUsers();
      setOnlineUsers(users);
      
      return user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion utilisateur';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socketService]);

  const sendMessage = useCallback(async (recipientId: string, content: string, originalLanguage: string) => {
    try {
      const message = await socketService.sendMessage(recipientId, content, originalLanguage);
      setError(null);
      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur d\'envoi du message';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socketService]);

  const getChatHistory = useCallback(async (otherUserId: string) => {
    try {
      const messages = await socketService.getChatHistory(otherUserId);
      setError(null);
      return messages;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de récupération de l\'historique';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socketService]);

  const updateUserSettings = useCallback(async (settings: Partial<User>) => {
    try {
      const user = await socketService.updateUserSettings(settings);
      setCurrentUser(user);
      setError(null);
      return user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de mise à jour des paramètres';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socketService]);

  const onNewMessage = useCallback((callback: (message: Message) => void) => {
    socketService.onNewMessage(callback);
  }, [socketService]);

  const onMessageSent = useCallback((callback: (message: Message) => void) => {
    socketService.onMessageSent(callback);
  }, [socketService]);

  const onUserStatusChanged = useCallback((callback: (data: { userId: string; isOnline: boolean }) => void) => {
    socketService.onUserStatusChanged((data) => {
      // Mettre à jour la liste des utilisateurs en ligne
      setOnlineUsers(prev => {
        if (data.isOnline) {
          // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
          const existingUser = prev.find(user => user.id === data.userId);
          if (!existingUser) {
            // On devrait récupérer les détails de l'utilisateur ici
            // Pour l'instant, on met juste à jour le statut
            return prev;
          }
          return prev.map(user => 
            user.id === data.userId ? { ...user, isOnline: true } : user
          );
        } else {
          // Marquer l'utilisateur comme hors ligne
          return prev.map(user => 
            user.id === data.userId ? { ...user, isOnline: false } : user
          );
        }
      });
      
      callback(data);
    });
  }, [socketService]);

  const offNewMessage = useCallback((callback?: (message: Message) => void) => {
    socketService.offNewMessage(callback);
  }, [socketService]);

  const offMessageSent = useCallback((callback?: (message: Message) => void) => {
    socketService.offMessageSent(callback);
  }, [socketService]);

  const offUserStatusChanged = useCallback((callback?: (data: { userId: string; isOnline: boolean }) => void) => {
    socketService.offUserStatusChanged(callback);
  }, [socketService]);

  return {
    isConnected,
    currentUser,
    onlineUsers,
    error,
    loginUser,
    sendMessage,
    getChatHistory,
    updateUserSettings,
    onNewMessage,
    onMessageSent,
    onUserStatusChanged,
    offNewMessage,
    offMessageSent,
    offUserStatusChanged,
  };
};
