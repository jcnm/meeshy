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
import { useFixRadixZIndex } from '@/hooks/use-fix-z-index';

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
  onReplyMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
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
  onReplyMessage,
  onNavigateToMessage,
  onLoadMore,
  t
}: ConversationMessagesProps) {
  // Hook pour fixer les z-index des popovers Radix UI
  useFixRadixZIndex();

  // Définir le callback pour récupérer un message par ID (utilise la liste translatedMessages existante)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const meeshySocketIOService = require('@/services/meeshy-socketio.service').meeshySocketIOService;
      const getMessageById = (messageId: string) => {
        return (translatedMessages as Message[]).find(msg => msg.id === messageId);
      };
      meeshySocketIOService.setGetMessageByIdCallback(getMessageById);
      console.log(`🔗 [CALLBACK ConversationMessages] Callback getMessageById défini (${translatedMessages.length} messages disponibles)`);
    }
  }, [translatedMessages]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const isAutoScrollingRef = useRef(true);
  
  // Ref pour tracker si c'est le premier chargement
  const isFirstLoadRef = useRef(true);
  
  // Ref pour tracker si l'utilisateur est en train de consulter l'historique
  const isUserScrollingHistoryRef = useRef(false);

  // Fonction pour vérifier si l'utilisateur est en bas de la conversation
  const isUserAtBottom = useCallback(() => {
    if (!scrollAreaRef.current) return true;
    
    const container = scrollAreaRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // Considérer l'utilisateur "en bas" s'il est à moins de 150px du bas
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < 150;
    
    console.log('[ConversationMessagesV2] 📍 Position utilisateur:', {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromBottom,
      isAtBottom
    });
    
    return isAtBottom;
  }, []);

  // Fonction pour scroller vers le bas
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }
  }, []);

  // Fonction pour scroller vers un message spécifique
  const scrollToMessage = useCallback((messageId: string, smooth = true) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'center'
      });
      console.log('[ConversationMessages] 📍 Scroll vers message:', messageId);
    }
  }, []);

  // Fonction pour trouver le premier message non lu
  const findFirstUnreadMessage = useCallback(() => {
    if (!currentUser) return null;
    
    // Trouver le premier message qui n'a pas été lu par l'utilisateur courant
    const firstUnread = messages.find(msg => {
      // Un message est considéré non lu si :
      // 1. Ce n'est pas un message de l'utilisateur courant
      // 2. Il n'a pas de readStatus ou l'utilisateur n'est pas dans readStatus
      if (msg.senderId === currentUser.id) return false;
      
      if (!msg.readStatus || msg.readStatus.length === 0) return true;
      
      const userReadStatus = msg.readStatus.find(rs => rs.userId === currentUser.id);
      return !userReadStatus || !userReadStatus.readAt;
    });
    
    return firstUnread || null;
  }, [messages, currentUser]);

  // Gestionnaire de scroll pour le chargement infini
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // Mettre à jour le flag de consultation de l'historique
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isUserScrollingHistoryRef.current = distanceFromBottom > 150;
    
    // Vérifier si l'utilisateur est proche du bas (auto-scroll)
    const isNearBottom = distanceFromBottom < 100;
    isAutoScrollingRef.current = isNearBottom;
    
    // Charger plus de messages quand on est proche du haut
    if (scrollTop < 100 && onLoadMore && hasMore && !isLoadingMore) {
      console.log('[ConversationMessagesV2] 🔄 Déclenchement chargement anciens messages - scrollTop:', scrollTop);
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoadingMore]);

  // Réinitialiser le flag de premier chargement quand la conversation change
  useEffect(() => {
    console.log('[ConversationMessagesV2] 🔄 Changement de conversation - réinitialisation du flag premier chargement');
    isFirstLoadRef.current = true;
    previousMessageCountRef.current = 0;
  }, [conversationId]);

  // Scénario 1 : Premier chargement - scroller vers le dernier message lu ou non lu
  useEffect(() => {
    if (isFirstLoadRef.current && messages.length > 0 && !isLoadingMessages) {
      // Petit délai pour s'assurer que les éléments DOM sont rendus
      setTimeout(() => {
        const firstUnreadMessage = findFirstUnreadMessage();
        
        if (firstUnreadMessage) {
          console.log('[ConversationMessages] 🎯 Premier chargement - scroll vers premier message non lu:', firstUnreadMessage.id);
          scrollToMessage(firstUnreadMessage.id, false);
        } else {
          console.log('[ConversationMessages] 🚀 Premier chargement - pas de messages non lus - scroll vers le bas');
          scrollToBottom(false);
        }
        
        isFirstLoadRef.current = false;
      }, 100);
    }
  }, [messages.length, isLoadingMessages, scrollToBottom, scrollToMessage, findFirstUnreadMessage]);

  // Scénario 2 & 3 : Nouveaux messages en temps réel
  useEffect(() => {
    if (messages.length > 0 && !isFirstLoadRef.current) {
      const currentCount = messages.length;
      const previousCount = previousMessageCountRef.current;
      
      // Scénario 2 : NE PAS scroller si on est en train de charger des messages anciens
      if (isLoadingMore) {
        console.log('[ConversationMessagesV2] ⏸️ Chargement infini - pas de scroll automatique');
        previousMessageCountRef.current = currentCount;
        return;
      }
      
      // Détecter si c'est un nouveau message (ajouté à la fin)
      if (currentCount > previousCount) {
        const lastMessage = messages[messages.length - 1];
        
        // Si c'est notre propre message, TOUJOURS scroller
        if (lastMessage && lastMessage.senderId === currentUser?.id) {
          console.log('[ConversationMessagesV2] 📩 Notre message envoyé - scroll vers le bas');
          scrollToBottom(false);
        } else {
          // Scénario 3 : Pour les messages d'autres utilisateurs, scroller SEULEMENT si l'utilisateur est en bas
          const userIsAtBottom = isUserAtBottom();
          
          if (userIsAtBottom) {
            console.log('[ConversationMessagesV2] 📨 Nouveau message reçu - utilisateur en bas - scroll');
            scrollToBottom();
          } else {
            console.log('[ConversationMessagesV2] 📚 Nouveau message reçu - utilisateur consulte historique - PAS de scroll');
            // Ne pas déranger l'utilisateur qui consulte l'historique
          }
        }
      }
      
      // Mettre à jour le compteur
      previousMessageCountRef.current = currentCount;
    }
  }, [messages, currentUser?.id, scrollToBottom, isLoadingMore, isUserAtBottom]);


  return (
    <div className="flex-1 flex flex-col h-full relative">
      <div
        ref={scrollAreaRef}
        className="flex-1 messages-scroll conversation-scroll h-full overflow-y-auto overflow-x-visible"
        onScroll={handleScroll}
        style={{ position: 'relative' }}
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
            {/* 
              MODE CONVERSATION: Messages récents EN BAS (proche zone de saisie)
              - Backend retourne: orderBy createdAt DESC = [récent...ancien]
              - reverseOrder=true inverse pour afficher: [ancien...récent]
              - scrollDirection='up' (défaut dans useConversationMessages)
              - Scroll vers le haut charge les plus anciens (ajoutés au DÉBUT)
              - Résultat: Ancien EN HAUT, Récent EN BAS ✅
            */}
            <MessagesDisplay
              messages={messages}
              translatedMessages={translatedMessages}
              isLoadingMessages={isLoadingMessages}
              currentUser={currentUser}
              userLanguage={userLanguage}
              usedLanguages={usedLanguages}
              emptyStateMessage={t('noMessages')}
              emptyStateDescription={t('noMessagesDescription')}
              reverseOrder={true}
              className={cn(
                "space-y-3",
                isMobile && "space-y-2"
              )}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onReplyMessage={onReplyMessage}
              onNavigateToMessage={onNavigateToMessage}
              conversationType={conversationType || 'direct'}
              userRole={userRole}
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
