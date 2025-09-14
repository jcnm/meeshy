'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type {
  Message,
  MessageWithTranslations,
  SocketIOUser as User,
  ThreadMember
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
  t: (key: string) => string;
}

export function ConversationMessages({
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
  t
}: ConversationMessagesProps) {
  // Ref pour le scroll automatique vers le dernier message
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Ref pour tracker le nombre de messages précédent
  const previousMessageCountRef = useRef(0);

  // Fonction pour scroller vers le bas
  const scrollToBottom = useCallback((force = false) => {
    // Détection Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    setTimeout(() => {
      if (isSafari || force) {
        // Pour Safari, utilisation directe de scrollTop qui est plus fiable
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      } else {
        // Pour les autres navigateurs, essai de scrollIntoView avec fallback
        if (messagesEndRef.current) {
          try {
            messagesEndRef.current.scrollIntoView({ 
              behavior: force ? 'auto' : 'smooth', 
              block: 'end' 
            });
          } catch (e) {
            // Fallback en cas d'erreur
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }
        } else if (messagesContainerRef.current) {
          // Fallback: scroller le conteneur directement
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }
    }, isSafari ? 150 : (force ? 50 : 100)); // Délai plus long pour Safari
  }, []);

  // Scroll automatique SEULEMENT pour les nouveaux messages (pas le chargement infini)
  useEffect(() => {
    if (messages.length > 0) {
      const currentCount = messages.length;
      const previousCount = previousMessageCountRef.current;
      
      // Ne déclencher le scroll que si le nombre de messages a augmenté (nouveaux messages)
      // et non diminué (chargement infini qui ajoute des messages au début)
      if (currentCount > previousCount) {
        const lastMessage = messages[messages.length - 1];
        
        // Si c'est notre propre message, forcer le scroll immédiatement
        if (lastMessage && lastMessage.senderId === currentUser?.id) {
          // Scroll automatique vers le bas
          scrollToBottom(true);
        } else {
          // Scroll normal pour les autres messages
          scrollToBottom();
        }
      }
      
      // Mettre à jour le compteur
      previousMessageCountRef.current = currentCount;
    }
  }, [messages, currentUser?.id, scrollToBottom]);

  return (
    <div ref={messagesContainerRef} className={cn(
      "flex-1 overflow-y-auto relative",
      // Zone de messages mobile : utiliser toute la hauteur disponible
      isMobile 
        ? "px-2 py-2 pb-20 bg-white h-full" 
        : "p-4 pb-4 bg-white/50 backdrop-blur-sm"
    )}>
      {/* Indicateur de chargement pour la pagination (messages plus anciens) - en haut */}
      {isLoadingMore && hasMore && messages.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Chargement des messages plus anciens...</span>
          </div>
        </div>
      )}

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
          // Tailwind responsive - espacement réduit sur mobile
          isMobile ? "space-y-1" : "space-y-4"
        )}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        conversationType={conversationType || 'direct'}
        userRole={userRole}
        conversationId={conversationId}
        addTranslatingState={addTranslatingState}
        isTranslating={isTranslating}
      />

      {/* Élément invisible pour le scroll automatique */}
      <div ref={messagesEndRef} />
    </div>
  );
}