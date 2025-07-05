'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveLayout } from '@/components/responsive-layout';
import { ConversationList } from '@/components/conversation-list';
import { ConversationView } from '@/components/conversation-view';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { User, Conversation, Message } from '@/types';
import { useWebSocket } from '@/hooks/use-websocket-new';
import { useTypingIndicator } from '@/hooks/use-typing-indicator-new';
import { toast } from 'sonner';

interface NewChatLayoutProps {
  currentUser: User;
}

export function NewChatLayout({ currentUser }: NewChatLayoutProps) {
  const router = useRouter();
  
  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // État pour l'expansion des groupes
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupConversations, setGroupConversations] = useState<Record<string, Conversation[]>>({});
  
  // Hooks personnalisés
  const { socket, isConnected } = useWebSocket(currentUser?.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(socket, currentUser?.id);

  // Fonctions de chargement
  const loadConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.LIST), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(Array.isArray(data) ? data : []);
      } else if (response.status === 401) {
        localStorage.removeItem('auth_token');
        toast.error('Session expirée, veuillez vous reconnecter');
        router.push('/');
      }
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      toast.error('Erreur lors du chargement des conversations');
    }
  }, [router]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.MESSAGE.LIST + '/' + conversationId), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  }, []);

  const loadGroupConversations = useCallback(async (groupId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.GET_GROUP_CONVERSATIONS(groupId)), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setGroupConversations(prev => ({ ...prev, [groupId]: data }));
      }
    } catch (error) {
      console.error('Erreur chargement conversations du groupe:', error);
      toast.error('Erreur lors du chargement des conversations du groupe');
    }
  }, []);

  // Gestionnaires d'événements
  const handleConversationClick = (conversation: Conversation) => {
    if (conversation.type === 'group' && conversation.groupId) {
      // Pour les conversations de groupe, gérer l'expansion/collapse du groupe
      if (expandedGroupId === conversation.groupId) {
        setExpandedGroupId(null);
      } else {
        setExpandedGroupId(conversation.groupId);
        // Charger les conversations du groupe si pas encore chargées
        if (!groupConversations[conversation.groupId]) {
          loadGroupConversations(conversation.groupId);
        }
      }
    } else {
      // Pour les conversations directes, ouvrir normalement
      openConversation(conversation.id);
    }
  };

  const openConversation = useCallback(async (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
      await loadMessages(conversationId);
      
      // Réinitialiser le compteur non lus
      setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
      
      // Rejoindre la room WebSocket
      if (socket) {
        socket.emit('joinConversation', { conversationId });
      }
    }
  }, [conversations, socket, loadMessages]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || !socket) return;

    try {
      const messageData = {
        conversationId: selectedConversation.id,
        content: newMessage.trim(),
        originalLanguage: currentUser.systemLanguage
      };

      // Envoyer via WebSocket
      socket.emit('sendMessage', messageData);
      
      // Arrêter l'indicateur de frappe
      stopTyping(selectedConversation.id);
      
      // Réinitialiser le champ
      setNewMessage('');
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    }
  }, [newMessage, selectedConversation, socket, currentUser.systemLanguage, stopTyping]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewMessageChange = (message: string) => {
    setNewMessage(message);
    
    // Gérer l'indicateur de frappe
    if (selectedConversation && socket) {
      if (message.trim()) {
        startTyping(selectedConversation.id);
      } else {
        stopTyping(selectedConversation.id);
      }
    }
  };

  // Effects
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // WebSocket - Écouter les nouveaux messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      // Si c'est la conversation active, ajouter le message
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, message]);
      } else {
        // Sinon, incrémenter le compteur non lus
        setUnreadCounts(prev => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1
        }));
      }

      // Mettre à jour la liste des conversations (dernier message)
      setConversations(prev => prev.map(conv => 
        conv.id === message.conversationId 
          ? { ...conv, lastMessage: message }
          : conv
      ));
    };

    const handleMessageError = (error: { message: string }) => {
      toast.error(error.message || 'Erreur lors de l\'envoi du message');
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageError', handleMessageError);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageError', handleMessageError);
    };
  }, [socket, selectedConversation]);

  // Contenu de la sidebar
  const sidebarContent = (
    <ConversationList
      conversations={conversations}
      selectedConversation={selectedConversation}
      expandedGroupId={expandedGroupId}
      groupConversations={groupConversations}
      unreadCounts={unreadCounts}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onConversationClick={handleConversationClick}
      onOpenConversation={openConversation}
      currentUser={currentUser}
    />
  );

  // Contenu principal
  const mainContent = selectedConversation ? (
    <ConversationView
      conversation={selectedConversation}
      messages={messages}
      newMessage={newMessage}
      onNewMessageChange={handleNewMessageChange}
      onSendMessage={sendMessage}
      onKeyPress={handleKeyPress}
      currentUser={currentUser}
      isConnected={isConnected}
      typingUsers={typingUsers}
    />
  ) : null;

  return (
    <ResponsiveLayout
      currentUser={currentUser}
      sidebarTitle="Conversations"
      sidebarContent={sidebarContent}
      showMainContent={!!selectedConversation}
      mainContentTitle={selectedConversation?.title || 
        selectedConversation?.participants?.map(p => p.user?.displayName || p.user?.username).join(', ')}
      mainContentSubtitle={selectedConversation?.type === 'group' 
        ? `${selectedConversation.participants?.length || 0} membre${(selectedConversation.participants?.length || 0) > 1 ? 's' : ''}`
        : undefined}
      mainContent={mainContent}
      onBackToList={() => setSelectedConversation(null)}
    />
  );
}
