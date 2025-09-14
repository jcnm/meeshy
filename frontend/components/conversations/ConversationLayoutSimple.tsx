'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useMessageSender } from '@/hooks/use-message-sender';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  ArrowLeft,
  Info
} from 'lucide-react';
import type {
  Conversation,
  Message,
  SocketIOUser as User
} from '@shared/types';
import { conversationsService } from '@/services/conversations.service';

import { useConversationMessages } from '@/hooks/use-conversation-messages';

interface ConversationLayoutSimpleProps {
  selectedConversationId?: string;
}

export function ConversationLayoutSimple({ selectedConversationId }: ConversationLayoutSimpleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthChecking } = useUser();
  const { t } = useTranslations('conversationLayout');

  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // États UI responsive
  const [showConversationList, setShowConversationList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Hook pour les messages
  const {
    messages,
    isLoading: isLoadingMessages,
    loadMore,
    clearMessages,
    addMessage
  } = useConversationMessages(selectedConversation?.id || null, user!, {
    limit: 20,
    enabled: !!selectedConversation?.id,
    threshold: 100,
    containerRef: messagesContainerRef
  });

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Gérer l'affichage responsive
  useEffect(() => {
    if (isMobile) {
      setShowConversationList(!selectedConversation);
    } else {
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversation]);

  // Hook de messagerie
  const {
    sendMessage: sendMessageToService,
    startTyping,
    stopTyping,
  } = useMessageSender({
    conversationId: selectedConversation?.id,
    currentUser: user!,
    onNewMessage: addMessage,
  });

  // Fonction utilitaire pour obtenir le nom d'affichage d'une conversation
  const getConversationDisplayName = useCallback((conversation: Conversation): string => {
    if (conversation.type !== 'direct') {
      return conversation.name || conversation.title || 'Groupe sans nom';
    } else {
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        return otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
      }
      return conversation.name || conversation.title || 'Conversation privée';
    }
  }, [user]);

  // Fonction pour obtenir l'avatar d'une conversation
  const getConversationAvatar = useCallback((conversation: Conversation): string => {
    const name = getConversationDisplayName(conversation);
    return name.slice(0, 2).toUpperCase();
  }, [getConversationDisplayName]);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const conversationsData = await conversationsService.getConversations();
      setConversations(conversationsData);

      // Sélectionner une conversation si spécifiée dans l'URL
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        const conversation = conversationsData.find(c => c.id === conversationIdFromUrl);
        if (conversation) {
          setSelectedConversation(conversation);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, selectedConversationId]);

  // Effet pour charger les données initiales
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Sélectionner une conversation
  const handleSelectConversation = (conversation: Conversation) => {
    if (selectedConversation?.id === conversation.id) {
      return;
    }

    setSelectedConversation(conversation);

    if (isMobile) {
      setShowConversationList(false);
    }

    router.push(`/conversations?id=${conversation.id}`, { scroll: false });
  };

  // Retour à la liste (mobile uniquement)
  const handleBackToList = () => {
    if (isMobile) {
      setShowConversationList(true);
      setSelectedConversation(null);
      router.push('/conversations', { scroll: false });
    }
  };

  // Envoyer un message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!newMessage.trim() || !selectedConversation || !user) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');

    const success = await sendMessageToService(messageContent, user.systemLanguage || 'fr');

    if (success) {
      stopTyping();
    }
  };

  // Gestion de l'état de chargement d'authentification
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('authChecking')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout title={t('conversations.title')}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('loadingConversations')}</p>
          </div>
        </div>
      ) : (
        <div className="h-full flex">
          {/* Liste des conversations - CSS simple et responsive */}
          <div className={cn(
            "bg-white border-r",
            // Simple responsive avec Tailwind
            isMobile 
              ? (showConversationList ? "w-full" : "hidden")
              : "w-80 flex-shrink-0"
          )}>
            {/* Header */}
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">{t('conversations.title')}</h2>
            </div>

            {/* Liste scrollable */}
            <div className="overflow-y-auto h-full">
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">{t('noConversations')}</h3>
                  <p className="text-muted-foreground">{t('noConversationsDescription')}</p>
                </div>
              ) : (
                <div className="p-2">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={cn(
                        "flex items-center p-3 rounded-lg cursor-pointer transition-colors",
                        selectedConversation?.id === conversation.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-gray-50"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {getConversationAvatar(conversation)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="ml-3 flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {getConversationDisplayName(conversation)}
                        </h3>
                        {conversation.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                      
                      {conversation.lastMessage && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Zone de messages - CSS simple et responsive */}
          <div className={cn(
            "flex flex-col",
            // Simple responsive avec Tailwind
            isMobile 
              ? (showConversationList ? "hidden" : "w-full") 
              : "flex-1"
          )}>
            {selectedConversation ? (
              <>
                {/* En-tête de la conversation */}
                <div className="p-4 border-b bg-white">
                  <div className="flex items-center gap-3">
                    {/* Bouton retour sur mobile */}
                    {isMobile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleBackToList}
                        className="p-2"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {getConversationAvatar(selectedConversation)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h2 className="font-bold truncate">
                        {getConversationDisplayName(selectedConversation)}
                      </h2>
                    </div>
                    
                    <Button size="sm" variant="ghost" className="p-2">
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Messages scrollables */}
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 bg-gray-50"
                >
                  {isLoadingMessages ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
                        <p className="text-muted-foreground">{t('noMessages')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            message.senderId === user?.id ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
                              message.senderId === user?.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-white border"
                            )}
                          >
                            <p className="text-sm">{message.content}</p>
                            <div className="text-xs opacity-70 mt-1">
                              {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Zone de saisie */}
                <div className="p-4 border-t bg-white">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('typeMessage')}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button type="submit" disabled={!newMessage.trim()}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">{t('selectConversation')}</h3>
                  <p className="text-muted-foreground">{t('selectConversationDescription')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}