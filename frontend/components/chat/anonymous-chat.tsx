/**
 * Composant de chat pour les participants anonymes
 * Utilise le service AnonymousChatService et le hook useAnonymousMessages
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAnonymousMessages, type AnonymousMessage } from '@/hooks/use-anonymous-messages';
import { useI18n } from '@/hooks/useI18n';
import { getMessageInitials } from '@/lib/avatar-utils';

interface AnonymousChatProps {
  linkId: string;
  participant: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    language: string;
    canSendMessages: boolean;
  };
  conversation: {
    id: string;
    title: string;
    type: string;
    allowViewHistory: boolean;
  };
}

export function AnonymousChat({ linkId, participant, conversation }: AnonymousChatProps) {
  const { t } = useI18n('anonymousChat');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    hasMore,
    error,
    sendMessage,
    loadMessages,
    hasActiveSession
  } = useAnonymousMessages(linkId);

  // Détection mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Gérer l'envoi de message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const success = await sendMessage(newMessage.trim(), participant.language);
      if (success) {
        setNewMessage('');
        // Focus sur le textarea après envoi
        textareaRef.current?.focus();
      }
    } finally {
      setIsSending(false);
    }
  };

  // Gérer la touche Entrée
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle blur for mobile to ensure zoom out
  const handleBlur = () => {
    if (isMobile && textareaRef.current) {
      // Force blur and zoom out on mobile devices
      textareaRef.current.blur();
      // Slight delay to ensure keyboard is fully dismissed before zoom reset
      setTimeout(() => {
        window.scrollTo(0, window.scrollY);
      }, 100);
    }
  };

  // Charger plus de messages (pagination)
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadMessages(20, messages.length);
    }
  };

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtenir le nom d'affichage d'un message
  const getMessageDisplayName = (message: AnonymousMessage) => {
    if (message.sender) {
      return message.sender.displayName || 
             `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() ||
             message.sender.username ||
             (message.sender.isMeeshyer ? t('user') : t('anonymous'));
    }
    return t('anonymous');
  };

  // Obtenir l'avatar d'un message
  const getMessageAvatar = (message: AnonymousMessage) => {
    if (message.sender?.avatar) {
      return message.sender.avatar;
    }
    return undefined;
  };

  // Utiliser la fonction utilitaire pour obtenir les initiales
  const getMessageInitialsLocal = (message: AnonymousMessage) => {
    const initials = getMessageInitials(message);
    return initials === '??' ? t('unknownUser') : initials;
  };

  if (!hasActiveSession) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{t('sessionNotActive')}</p>
          <Button onClick={() => window.location.reload()}>
            {t('reloadPage')}
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            {t('reloadPage')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Header de la conversation */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {conversation.title || t('title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('connectedAs', { 
            firstName: participant.firstName, 
            lastName: participant.lastName, 
            username: participant.username 
          })}
        </p>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50 dark:bg-gray-950">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
            <span className="ml-2 text-gray-500 dark:text-gray-400">{t('loadingMessages')}</span>
          </div>
        ) : (
          <>
            {/* Bouton pour charger plus de messages */}
            {hasMore && (
              <div className="text-center mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('loading')}
                    </>
                  ) : (
                    t('loadMore')
                  )}
                </Button>
              </div>
            )}

            {/* Messages - Modern chat style */}
            {messages.map((message) => {
              const isOwnMessage = message.sender?.id === participant.id;
              
              return (
                <div 
                  key={message.id} 
                  className={`flex gap-2 sm:gap-3 mb-3 sm:mb-4 px-2 ${
                    isOwnMessage ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar - Hidden on mobile for own messages */}
                  <Avatar className={`h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 mt-1 ${
                    isOwnMessage ? 'hidden sm:flex' : ''
                  }`}>
                    <AvatarImage src={getMessageAvatar(message)} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                      {getMessageInitialsLocal(message)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Message Content */}
                  <div className={`flex-1 min-w-0 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] ${
                    isOwnMessage ? 'flex flex-col items-end' : ''
                  }`}>
                    {/* Header */}
                    <div className={`flex items-center gap-2 mb-1 px-1 ${
                      isOwnMessage ? 'flex-row-reverse' : ''
                    }`}>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
                        {getMessageDisplayName(message)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                    
                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-3 py-2 ${
                      isOwnMessage 
                        ? 'bg-gradient-to-br from-blue-400 to-blue-500 text-white' 
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}>
                      <p className={`text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed ${
                        isOwnMessage ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                      }`}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Référence pour l'auto-scroll */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Zone de saisie */}
      {participant.canSendMessages && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
          <div className="flex space-x-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onBlur={handleBlur}
              placeholder={t('messagePlaceholder')}
              className="flex-1 resize-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              rows={1}
              disabled={isSending}
              style={{
                fontSize: isMobile ? '16px' : undefined
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              size="sm"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
