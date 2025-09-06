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
import { useTranslations } from '@/hooks/useTranslations';

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
  const { t } = useTranslations('anonymousChat');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
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

  // Obtenir les initiales pour l'avatar
  const getMessageInitials = (message: AnonymousMessage) => {
    if (message.sender) {
      const firstName = message.sender.firstName || '';
      const lastName = message.sender.lastName || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    return t('unknownUser');
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
    <div className="flex flex-col h-full">
      {/* Header de la conversation */}
      <div className="border-b border-gray-200 p-4 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">
          {conversation.title || t('title')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('connectedAs', { 
            firstName: participant.firstName, 
            lastName: participant.lastName, 
            username: participant.username 
          })}
        </p>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">{t('loadingMessages')}</span>
          </div>
        ) : (
          <>
            {/* Bouton pour charger plus de messages */}
            {hasMore && (
              <div className="text-center">
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

            {/* Messages */}
            {messages.map((message) => (
              <div key={message.id} className="flex space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getMessageAvatar(message)} />
                  <AvatarFallback className="text-xs">
                    {getMessageInitials(message)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {getMessageDisplayName(message)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                  
                  <div className="bg-gray-100 rounded-lg p-3">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Référence pour l'auto-scroll */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Zone de saisie */}
      {participant.canSendMessages && (
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex space-x-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('messagePlaceholder')}
              className="flex-1 resize-none"
              rows={1}
              disabled={isSending}
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
