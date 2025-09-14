'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useMessageSender } from '@/hooks/use-message-sender';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MessageSquare, ArrowLeft, Info, Send } from 'lucide-react';
import type { Conversation, Message, SocketIOUser as User } from '@shared/types';
import { conversationsService } from '@/services/conversations.service';
import { useMessageLoaderSimple } from '@/hooks/use-message-loader-simple';
import '../../styles/meeshy-simple.css';

interface ConversationLayoutCleanProps {
  selectedConversationId?: string;
}

export function ConversationLayoutClean({ selectedConversationId }: ConversationLayoutCleanProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthChecking } = useUser();
  const { t } = useTranslations('conversationLayout');

  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Hook pour les messages (version simplifiée)
  const {
    messages,
    isLoadingMessages,
    loadMessages,
    addMessage,
    clearMessages
  } = useMessageLoaderSimple({
    currentUser: user!,
    conversationId: selectedConversation?.id
  });

  // Hook de messagerie
  const { sendMessage: sendMessageToService } = useMessageSender({
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
          setShowSidebar(false); // Masquer la sidebar sur mobile quand une conversation est sélectionnée
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

  // Effet pour charger les messages quand une conversation est sélectionnée
  useEffect(() => {
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id, true);
    }
  }, [selectedConversation?.id, loadMessages]);

  // Sélectionner une conversation
  const handleSelectConversation = (conversation: Conversation) => {
    if (selectedConversation?.id === conversation.id) {
      return;
    }

    setSelectedConversation(conversation);
    setShowSidebar(false); // Masquer la sidebar sur mobile
    router.push(`/conversations/${conversation.id}`, { scroll: false });
  };

  // Retour à la liste
  const handleBackToList = () => {
    setShowSidebar(true);
    setSelectedConversation(null);
    router.push('/conversations', { scroll: false });
  };

  // Envoyer un message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedConversation || !user) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');

    await sendMessageToService(messageContent, user.systemLanguage || 'fr');
  };

  // Auto-resize du textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Scroll vers le bas
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Scroll automatique lors de nouveaux messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Gestion de l'état de chargement d'authentification
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout title={t('conversations.title')}>
      {isLoading ? (
        <div className="empty-state">
          <div className="loading-spinner"></div>
          <p className="empty-state-description">{t('loadingConversations')}</p>
        </div>
      ) : (
        <div className={cn(
          "conversations-container",
          selectedConversation && "conversation-open"
        )}>
          {/* Sidebar des conversations */}
          <div className={cn(
            "conversations-sidebar",
            showSidebar && "show"
          )}>
            {/* Header */}
            <div className="conversation-header">
              <h2 className="conversation-header-title">{t('conversations.title')}</h2>
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="empty-state">
                  <MessageSquare className="empty-state-icon" />
                  <h3 className="empty-state-title">{t('noConversations')}</h3>
                  <p className="empty-state-description">{t('noConversationsDescription')}</p>
                </div>
              ) : (
                <div className="p-2">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={cn(
                        "conversation-item",
                        selectedConversation?.id === conversation.id && "active"
                      )}
                    >
                      <Avatar className="conversation-avatar">
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {getConversationAvatar(conversation)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="conversation-content">
                        <h3 className="conversation-title">
                          {getConversationDisplayName(conversation)}
                        </h3>
                        {conversation.lastMessage && (
                          <p className="conversation-last-message">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                      
                      {conversation.lastMessage && (
                        <div className="conversation-time">
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

          {/* Zone de messages */}
          <div className="messages-area">
            {selectedConversation ? (
              <>
                {/* Header de la conversation */}
                <div className="conversation-header">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToList}
                    className="md:hidden p-2"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  
                  <Avatar className="conversation-header-avatar">
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {getConversationAvatar(selectedConversation)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="conversation-header-info">
                    <h2 className="conversation-header-title">
                      {getConversationDisplayName(selectedConversation)}
                    </h2>
                  </div>
                  
                  <div className="conversation-header-actions">
                    <Button variant="ghost" size="sm" className="p-2">
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div 
                  ref={messagesContainerRef}
                  className="messages-container"
                >
                  {isLoadingMessages ? (
                    <div className="empty-state">
                      <div className="loading-spinner"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="empty-state">
                      <MessageSquare className="empty-state-icon" />
                      <p className="empty-state-description">{t('noMessages')}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {messages.map((message: Message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "message-bubble",
                            message.senderId === user?.id ? "own" : "other"
                          )}
                        >
                          <div className={cn(
                            "bubble-content",
                            message.senderId === user?.id ? "own" : "other"
                          )}>
                            {message.senderId !== user?.id && (
                              <span className="bubble-sender">
                                {message.sender?.username || 'Utilisateur'}
                              </span>
                            )}
                            
                            <p className="bubble-text">{message.content}</p>
                            
                            <span className="bubble-time">
                              {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Zone de saisie */}
                <div className="message-input-container">
                  <form onSubmit={handleSendMessage} className="message-input-form">
                    <textarea
                      ref={messageInputRef}
                      value={newMessage}
                      onChange={handleInputChange}
                      placeholder={t('typeMessage')}
                      className="message-input"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim()}
                      className="message-send-button"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <MessageSquare className="empty-state-icon" />
                <h3 className="empty-state-title">{t('selectConversation')}</h3>
                <p className="empty-state-description">{t('selectConversationDescription')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}