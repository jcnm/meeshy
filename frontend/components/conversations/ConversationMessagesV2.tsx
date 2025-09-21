'use client';

import { useRef, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import type {
  Message,
  MessageWithTranslations,
  SocketIOUser as User
} from '@shared/types';
import { MessagesDisplay } from '@/components/common/messages-display';
import { UserRoleEnum } from '@shared/types';

interface ConversationMessagesProps {
  messages: Message[];
  translatedMessages: MessageWithTranslations[];
  isLoadingMessages: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
  isMobile: boolean;
  conversationType?: 'direct' | 'group' | 'public' | 'global';
  userRole: UserRoleEnum;
  conversationId?: string;
  addTranslatingState: (messageId: string, targetLanguage: string) => void;
  isTranslating: (messageId: string, targetLanguage: string) => boolean;
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onLoadMore?: () => void;
  t: (key: string) => string;
}

const ConversationMessagesComponent = memo(function ConversationMessages({
  messages,
  translatedMessages,
  isLoadingMessages,
  isLoadingMore,
  hasMore,
  currentUser,
  userLanguage,
  usedLanguages,
  isMobile,
  conversationType,
  userRole,
  conversationId,
  addTranslatingState,
  isTranslating,
  onEditMessage,
  onDeleteMessage,
  onLoadMore,
  t
}: ConversationMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const isAutoScrollingRef = useRef(true);

  // Fonction pour scroller vers le bas
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }
  }, []);

  // Gestionnaire de scroll pour le chargement infini
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    
    // Vérifier si l'utilisateur est proche du bas (auto-scroll)
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAutoScrollingRef.current = isNearBottom;
    
    // Charger plus de messages quand on est proche du haut
    if (scrollTop < 100 && onLoadMore && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoadingMore]);

  // Scroll automatique pour les nouveaux messages
  useEffect(() => {
    if (messages.length > 0) {
      const currentCount = messages.length;
      const previousCount = previousMessageCountRef.current;
      
      // Si c'est un nouveau message (pas le chargement initial ou infini)
      if (currentCount > previousCount && previousCount > 0) {
        const lastMessage = messages[messages.length - 1];
        
        // Scroll automatique si c'est notre message ou si on est déjà en bas
        if (lastMessage?.senderId === currentUser?.id || isAutoScrollingRef.current) {
          scrollToBottom();
        }
      }
      
      previousMessageCountRef.current = currentCount;
    }
  }, [messages, currentUser?.id, scrollToBottom]);

  // Scroll initial
  useEffect(() => {
    if (messages.length > 0 && previousMessageCountRef.current === 0) {
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom]);


  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div
        ref={scrollAreaRef}
        className="flex-1 messages-scroll conversation-scroll h-full"
        onScroll={handleScroll}
      >
        <div className={cn(
          "flex flex-col",
          isMobile ? "px-3 py-4" : "px-6 py-4"
        )}>
          {/* Indicateur de chargement (messages anciens) */}
          {isLoadingMore && hasMore && messages.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                <span>{t('loadingOlderMessages')}</span>
              </div>
            </div>
          )}

          {/* Messages */}
          <div>
            <MessagesDisplay
              messages={messages}
              translatedMessages={translatedMessages}
              isLoadingMessages={isLoadingMessages}
              currentUser={currentUser}
              userLanguage={userLanguage}
              usedLanguages={usedLanguages}
              emptyStateMessage={t('noMessages')}
              emptyStateDescription={t('noMessagesDescription')}
              reverseOrder={false}
              className={cn(
                "space-y-3",
                isMobile && "space-y-2"
              )}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              conversationType={conversationType || 'direct'}
              userRole={userRole}
              conversationId={conversationId}
              addTranslatingState={addTranslatingState}
              isTranslating={isTranslating}
            />
          </div>

          {/* Élément pour le scroll automatique */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>
    </div>
  );
});

export { ConversationMessagesComponent as ConversationMessages };
