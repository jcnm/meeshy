'use client';

import { useRef, useEffect, useCallback, memo, useState } from 'react';
import { cn } from '@/lib/utils';
import type {
  Message,
  MessageWithTranslations,
  SocketIOUser as User
} from '@shared/types';
import { MessagesDisplay } from '@/components/common/messages-display';
import { UserRoleEnum } from '@shared/types';
import { useFixRadixZIndex } from '@/hooks/use-fix-z-index';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp } from 'lucide-react';

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
  isAnonymous?: boolean; // Add isAnonymous for anonymous reactions
  currentAnonymousUserId?: string; // Add anonymous user ID for reactions
  addTranslatingState: (messageId: string, targetLanguage: string) => void;
  isTranslating: (messageId: string, targetLanguage: string) => boolean;
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onReplyMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
  onImageClick?: (attachmentId: string) => void;
  onLoadMore?: () => void;
  t: (key: string) => string;
  reverseOrder?: boolean; // true = récent en haut (BubbleStream), false = ancien en haut (Conversations)
  scrollDirection?: 'up' | 'down'; // Direction du scroll pour charger plus: 'up' = haut (défaut), 'down' = bas
  scrollButtonDirection?: 'up' | 'down'; // Direction du bouton scroll: 'up' = ArrowUp (BubbleStream), 'down' = ArrowDown (Conversations)
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>; // Ref externe du conteneur de scroll (pour BubbleStream)
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
  isAnonymous = false,
  currentAnonymousUserId,
  addTranslatingState,
  isTranslating,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onNavigateToMessage,
  onImageClick,
  onLoadMore,
  t,
  reverseOrder = false,
  scrollDirection = 'up', // Par défaut: scroll vers le haut (comportement classique messagerie)
  scrollButtonDirection = 'down', // Par défaut: ArrowDown pour Conversations (descendre vers récent)
  scrollContainerRef // Ref externe du conteneur de scroll (optionnelle)
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

  // Utiliser le ref externe SI fourni, sinon créer un ref local
  const internalScrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = scrollContainerRef || internalScrollAreaRef;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const isAutoScrollingRef = useRef(true);
  
  // Ref pour tracker si c'est le premier chargement
  const isFirstLoadRef = useRef(true);
  
  // Ref pour tracker si l'utilisateur est en train de consulter l'historique
  const isUserScrollingHistoryRef = useRef(false);
  
  // État pour afficher/masquer le bouton "Scroll to bottom"
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  // Fonction pour scroller vers le haut (pour BubbleStream avec scrollDirection='down')
  const scrollToTop = useCallback((smooth = true) => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: 0,
        behavior: smooth ? 'smooth' : 'auto'
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

  // Gestionnaire de scroll pour le chargement infini ET le bouton flottant
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;

    // Mettre à jour le flag de consultation de l'historique
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isUserScrollingHistoryRef.current = distanceFromBottom > 150;

    // AMÉLIORATION 2: Afficher/masquer le bouton selon la position et le mode
    let shouldShowButton = false;
    if (scrollDirection === 'down') {
      // Mode BubbleStream: messages récents EN HAUT, afficher le bouton si l'utilisateur scrolle vers le bas
      shouldShowButton = scrollTop > 200; // Afficher si scrollé de plus de 200px vers le bas
      console.log('[ConversationMessages] 🔼 BubbleStream scroll check:', { scrollTop, shouldShowButton, scrollDirection });
    } else {
      // Mode classique: messages récents EN BAS, afficher le bouton si l'utilisateur scrolle vers le haut
      shouldShowButton = distanceFromBottom > 200; // Afficher si plus de 200px du bas
      console.log('[ConversationMessages] 🔽 Classic scroll check:', { distanceFromBottom, shouldShowButton, scrollDirection });
    }
    setShowScrollButton(shouldShowButton);
    
    // Vérifier si l'utilisateur est proche du bas (auto-scroll)
    const isNearBottom = distanceFromBottom < 100;
    isAutoScrollingRef.current = isNearBottom;
    
    // Charger plus de messages selon la direction configurée
    if (onLoadMore && hasMore && !isLoadingMore) {
      const threshold = 100;
      let shouldLoadMore = false;
      
      if (scrollDirection === 'up') {
        // Mode classique : charger quand on scrolle vers le haut
        shouldLoadMore = scrollTop < threshold;
        if (shouldLoadMore) {
          console.log('[ConversationMessages] 🔄 Chargement anciens messages (scroll UP) - scrollTop:', scrollTop);
        }
      } else {
        // Mode BubbleStream : charger quand on scrolle vers le bas
        shouldLoadMore = distanceFromBottom < threshold;
        if (shouldLoadMore) {
          console.log('[ConversationMessages] 🔄 Chargement anciens messages (scroll DOWN) - distanceFromBottom:', distanceFromBottom);
        }
      }
      
      if (shouldLoadMore) {
        onLoadMore();
      }
    }
  }, [onLoadMore, hasMore, isLoadingMore, scrollDirection]);

  // Attacher handleScroll au conteneur externe si fourni
  useEffect(() => {
    if (scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      console.log('[ConversationMessages] 📦 Conteneur de scroll détecté:', {
        hasContainer: !!container,
        scrollDirection,
        className: container.className,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight
      });

      // Wrapper pour convertir Event natif en React UIEvent avec currentTarget correct
      const handleNativeScroll = () => {
        // Créer un objet UIEvent avec le currentTarget correct
        const syntheticEvent = {
          currentTarget: container
        } as React.UIEvent<HTMLDivElement>;
        handleScroll(syntheticEvent);
      };
      container.addEventListener('scroll', handleNativeScroll);
      console.log('[ConversationMessages] 📌 handleScroll attaché au conteneur externe');

      // Test initial pour vérifier l'état
      setTimeout(() => {
        console.log('[ConversationMessages] 🔍 État initial du scroll:', {
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight
        });
      }, 1000);

      return () => {
        container.removeEventListener('scroll', handleNativeScroll);
        console.log('[ConversationMessages] 🔓 handleScroll détaché du conteneur externe');
      };
    } else {
      console.log('[ConversationMessages] ⚠️ Aucun conteneur de scroll externe fourni');
    }
  }, [scrollContainerRef, handleScroll, scrollDirection]);

  // Réinitialiser le flag de premier chargement quand la conversation change
  useEffect(() => {
    console.log('[ConversationMessagesV2] 🔄 Changement de conversation - réinitialisation du flag premier chargement');
    isFirstLoadRef.current = true;
    previousMessageCountRef.current = 0;
  }, [conversationId]);

  // AMÉLIORATION 1: Premier chargement - afficher DIRECTEMENT le dernier message lu SANS animation
  useEffect(() => {
    if (isFirstLoadRef.current && messages.length > 0 && !isLoadingMessages) {
      // CORRECTION: Pas de délai, affichage IMMÉDIAT pour éviter l'effet de scroll visible
      // En mode scrollDirection='down' (BubbleStream), les messages récents sont EN HAUT
      // Donc on scroll toujours vers le haut (top: 0)
      if (scrollDirection === 'down') {
        console.log('[ConversationMessages] 🚀 Premier chargement (BubbleStream) - position instantanée en haut');
        scrollToTop(false); // false = pas d'animation
      } else {
        // Mode classique ConversationLayout : chercher les messages non lus ou aller en bas
        const firstUnreadMessage = findFirstUnreadMessage();
        
        if (firstUnreadMessage) {
          console.log('[ConversationMessages] 🎯 Premier chargement - position instantanée sur premier message non lu:', firstUnreadMessage.id);
          scrollToMessage(firstUnreadMessage.id, false); // false = pas d'animation
        } else {
          console.log('[ConversationMessages] 🚀 Premier chargement - position instantanée en bas (tous les messages lus)');
          scrollToBottom(false); // false = pas d'animation
        }
      }
      
      isFirstLoadRef.current = false;
    }
  }, [messages.length, isLoadingMessages, scrollDirection, scrollToBottom, scrollToTop, scrollToMessage, findFirstUnreadMessage]);

  // AMÉLIORATION 3: Nouveaux messages - Auto-scroll sur envoi/réception
  useEffect(() => {
    if (messages.length > 0 && !isFirstLoadRef.current) {
      const currentCount = messages.length;
      const previousCount = previousMessageCountRef.current;

      // Scénario 2 : NE PAS scroller si on est en train de charger des messages anciens
      if (isLoadingMore) {
        console.log('[ConversationMessages] ⏸️ Chargement infini - pas de scroll automatique');
        previousMessageCountRef.current = currentCount;
        return;
      }

      // Détecter si c'est un nouveau message (ajouté à la fin)
      if (currentCount > previousCount) {
        const lastMessage = messages[messages.length - 1];

        // AMÉLIORATION: Toujours scroller sur NOTRE propre message (envoi)
        if (lastMessage && lastMessage.senderId === currentUser?.id) {
          console.log('[ConversationMessages] 📤 Message envoyé - scroll automatique vers le bas');
          // En mode scrollDirection='down' (BubbleStream), scroller vers le haut
          if (scrollDirection === 'down') {
            scrollToTop(true); // true = avec animation fluide
          } else {
            scrollToBottom(true); // true = avec animation fluide
          }
        } else {
          // AMÉLIORATION: Pour les messages reçus, scroller si l'utilisateur est proche du bas
          console.log('[ConversationMessages] 📥 Message reçu - vérification position utilisateur');
          if (scrollDirection === 'down') {
            // En BubbleStream, vérifier si l'utilisateur est proche du haut
            const container = scrollAreaRef.current;
            if (container && container.scrollTop < 300) {
              console.log('[ConversationMessages] ✅ Utilisateur proche du haut - scroll automatique');
              scrollToTop(true); // Animation fluide pour les messages reçus
            } else {
              console.log('[ConversationMessages] ⏸️ Utilisateur dans l\'historique - pas de scroll');
            }
          } else {
            // Mode classique : vérifier si l'utilisateur est en bas
            // CORRECTION: Vérifier directement le container au lieu d'utiliser la fonction callback
            const container = scrollAreaRef.current;
            if (container) {
              const { scrollTop, scrollHeight, clientHeight } = container;
              const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
              const userIsAtBottom = distanceFromBottom < 150;

              console.log('[ConversationMessages] 📊 Position utilisateur:', {
                scrollTop,
                scrollHeight,
                clientHeight,
                distanceFromBottom,
                userIsAtBottom
              });

              if (userIsAtBottom) {
                console.log('[ConversationMessages] ✅ Utilisateur en bas - scroll automatique');
                scrollToBottom(true); // Animation fluide pour les messages reçus
              } else {
                console.log('[ConversationMessages] ⏸️ Utilisateur dans l\'historique - pas de scroll (afficher bouton)');
              }
            }
          }
        }
      }

      // Mettre à jour le compteur
      previousMessageCountRef.current = currentCount;
    }
  }, [messages, currentUser?.id, scrollDirection, scrollToBottom, scrollToTop, isLoadingMore, scrollAreaRef]);


  // Choisir l'action du bouton selon la direction
  const handleScrollButtonClick = useCallback(() => {
    if (scrollButtonDirection === 'up') {
      // BubbleStream: messages récents EN HAUT → remonter vers le haut
      scrollToTop(true);
    } else {
      // Conversations: messages anciens EN HAUT → descendre vers le bas (récent)
      scrollToBottom(true);
    }
  }, [scrollButtonDirection, scrollToTop, scrollToBottom]);

  // Si un ref externe est fourni, ne pas créer de conteneur de scroll
  const content = (
    <div className={cn(
      "flex flex-col",
      isMobile ? "px-3 py-4" : "px-6 py-4"
    )}>
      {/* Indicateur de chargement EN HAUT - Mode classique (scroll up = charger anciens) */}
      {scrollDirection === 'up' && isLoadingMore && hasMore && messages.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            <span>{t('common:messages.loadingOlderMessages')}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div>
        {/* 
          Logique d'affichage selon reverseOrder:
          - reverseOrder=false (BubbleStream): garde [récent...ancien] = Récent EN HAUT
          - reverseOrder=true (Conversations): inverse vers [ancien...récent] = Ancien EN HAUT
          - Backend retourne toujours: orderBy createdAt DESC = [récent...ancien]
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
          reverseOrder={reverseOrder}
          className="space-y-1"
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          conversationId={conversationId}
          isAnonymous={isAnonymous}
          currentAnonymousUserId={currentAnonymousUserId}
          onReplyMessage={onReplyMessage}
          onNavigateToMessage={onNavigateToMessage}
          onImageClick={onImageClick}
          conversationType={conversationType || 'direct'}
          userRole={userRole}
          addTranslatingState={addTranslatingState}
          isTranslating={isTranslating}
        />
      </div>

      {/* Indicateur de chargement EN BAS - Mode BubbleStream (scroll down = charger anciens) */}
      {scrollDirection === 'down' && isLoadingMore && hasMore && messages.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            <span>{t('common:messages.loadingOlderMessages')}</span>
          </div>
        </div>
      )}

      {/* Élément pour le scroll automatique */}
      <div ref={messagesEndRef} className="h-1" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Si ref externe fourni, pas de conteneur scroll. Sinon, créer un conteneur scroll local */}
      {scrollContainerRef ? (
        // Pas de conteneur scroll - le parent gère le scroll
        content
      ) : (
        // Conteneur scroll local
        <div
          ref={internalScrollAreaRef}
          className="flex-1 messages-scroll conversation-scroll h-full overflow-y-auto overflow-x-visible"
          onScroll={handleScroll}
          style={{ position: 'relative' }}
        >
          {content}
        </div>
      )}
      
      {/* Bouton flottant pour scroller - Direction adaptée au contexte */}
      {(() => {
        const shouldRender = showScrollButton && !isLoadingMessages && messages.length > 0;
        return shouldRender ? (
          <Button
            onClick={handleScrollButtonClick}
            className={cn(
              "fixed bottom-32 z-50",
              // Positionnement adapté: pour BubbleStream avec sidebar, ajuster la position
              scrollDirection === 'down' ? "right-6 xl:right-[360px]" : "right-6",
              "rounded-full w-12 h-12 p-0",
              "shadow-2xl hover:shadow-3xl",
              "bg-primary hover:bg-primary/90",
              "transition-all duration-300 ease-in-out",
              "animate-in slide-in-from-bottom-5"
            )}
            aria-label={scrollButtonDirection === 'up' ? 'Scroll to top' : 'Scroll to bottom'}
            title={scrollButtonDirection === 'up' ? 'Remonter vers les messages récents' : 'Aller au bas de la conversation'}
          >
            {scrollButtonDirection === 'up' ? (
              <ArrowUp className="h-5 w-5 text-primary-foreground" />
            ) : (
              <ArrowDown className="h-5 w-5 text-primary-foreground" />
            )}
          </Button>
        ) : null;
      })()}
    </div>
  );
});

export { ConversationMessagesComponent as ConversationMessages };
