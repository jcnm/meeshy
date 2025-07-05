'use client';

import { useState, useEffect } from 'react';
import { UserSelector } from '@/components/user-selector';
import { ChatInterface } from '@/components/chat-interface';
import { useWebSocket } from '@/hooks/use-websocket';
import { useTranslation } from '@/hooks/use-translation';
import { User } from '@/types';
import { toast } from 'sonner';

export default function Home() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const {
    currentUser,
    onlineUsers,
    messages,
    connectionError,
    loginUser,
    sendMessage,
    disconnect,
  } = useWebSocket();

  const {
    addMessage,
  } = useTranslation(currentUser);

  // Charger la liste des utilisateurs au démarrage
  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Simuler le chargement des utilisateurs depuis l'API
        const response = await fetch('http://localhost:3002/users');
        if (response.ok) {
          const users = await response.json();
          setAllUsers(users);
          toast.success('Utilisateurs chargés avec succès');
        } else {
          // Utilisateurs par défaut en cas d'erreur API
          const defaultUsers: User[] = [
            {
              id: '1',
              username: 'Alice',
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: false,
            },
            {
              id: '2',
              username: 'Bob',
              systemLanguage: 'en',
              regionalLanguage: 'ru',
              autoTranslateEnabled: true,
              translateToSystemLanguage: false,
              translateToRegionalLanguage: true,
              useCustomDestination: false,
              isOnline: false,
            },
            {
              id: '3',
              username: 'Carlos',
              systemLanguage: 'es',
              regionalLanguage: 'es',
              customDestinationLanguage: 'en',
              autoTranslateEnabled: true,
              translateToSystemLanguage: false,
              translateToRegionalLanguage: false,
              useCustomDestination: true,
              isOnline: false,
            },
            {
              id: '4',
              username: 'Diana',
              systemLanguage: 'de',
              regionalLanguage: 'de',
              autoTranslateEnabled: false,
              translateToSystemLanguage: false,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: false,
            },
            {
              id: '5',
              username: 'Erik',
              systemLanguage: 'sv',
              regionalLanguage: 'sv',
              customDestinationLanguage: 'en',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: false,
            },
          ];
          setAllUsers(defaultUsers);
          toast.error('Impossible de charger les utilisateurs, utilisation des utilisateurs par défaut');
        }
      } catch (error: unknown) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        toast.error('Impossible de charger les utilisateurs: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  // Afficher les erreurs de connexion
  useEffect(() => {
    if (connectionError) {
      toast.error(`Erreur de connexion: ${connectionError}`);
    }
  }, [connectionError]);

  // Ajouter les nouveaux messages au système de traduction
  useEffect(() => {
    messages.forEach(message => {
      addMessage(message);
    });
  }, [messages, addMessage]);

  const handleUserSelect = async (user: User) => {
    try {
      await loginUser(user.id);
      toast.success(`Connecté en tant que ${user.username}`);
    } catch (error) {
      console.error('Erreur de connexion:', error);
      toast.error('Impossible de se connecter');
    }
  };

  const handleSendMessage = async (
    recipientId: string,
    content: string,
    originalLanguage: string
  ) => {
    try {
      await sendMessage(recipientId, content, originalLanguage);
    } catch (error) {
      console.error('Erreur d\'envoi:', error);
      toast.error('Impossible d\'envoyer le message');
    }
  };

  const handleLogout = () => {
    disconnect();
    toast.info('Déconnecté');
  };

  // Si pas d'utilisateur connecté, afficher le sélecteur
  if (!currentUser) {
    return (
      <UserSelector
        users={allUsers}
        onUserSelect={handleUserSelect}
        isLoading={isLoadingUsers}
      />
    );
  }

  // Interface de chat principale
  return (
    <ChatInterface
      currentUser={currentUser}
      onlineUsers={onlineUsers}
      messages={messages}
      onSendMessage={handleSendMessage}
      onLogout={handleLogout}
    />
  );
}
