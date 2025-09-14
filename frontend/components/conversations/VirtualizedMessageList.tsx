'use client';

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { cn } from '@/lib/utils';
import type { UnifiedMessage, User } from '@shared/types';
import { BubbleMessage } from '@/components/common/bubble-message';

// ===== TYPES =====

interface VirtualizedMessageListProps {
  messages: UnifiedMessage[];
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
  isLoadingMessages: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  emptyStateMessage: string;
  emptyStateDescription: string;
  className?: string;
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onLoadMore: () => void;
  onAddTranslatingState: (messageId: string, targetLanguage: string) => void;
  onIsTranslating: (messageId: string, targetLanguage: string) => boolean;
  conversationType: string;
  userRole: string;
  conversationId?: string;
  reverseOrder?: boolean;
}

interface MessageItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: UnifiedMessage[];
    currentUser: User;
    userLanguage: string;
    usedLanguages: string[];
    onEditMessage: (messageId: string, newContent: string) => Promise<void>;
    onDeleteMessage: (messageId: string) => Promise<void>;
    onAddTranslatingState: (messageId: string, targetLanguage: string) => void;
    onIsTranslating: (messageId: string, targetLanguage: string) => boolean;
    conversationType: string;
    userRole: string;
    conversationId?: string;
  };
}

// ===== MESSAGE ITEM COMPONENT =====

const MessageItem = React.memo(({ index, style, data }: MessageItemProps) => {
  const {
    messages,
    currentUser,
    userLanguage,
    usedLanguages,
    onEditMessage,
    onDeleteMessage,
    onAddTranslatingState,
    onIsTranslating,
    conversationType,
    userRole,
    conversationId
  } = data;

  const message = messages[index];
  if (!message) return null;

  return (
    <div style={style} className="px-2">
      <BubbleMessage
        message={message}
        currentUser={currentUser}
        userLanguage={userLanguage}
        usedLanguages={usedLanguages}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onTranslate={(messageId: string, targetLanguage: string, forceRetranslate?: boolean, forcedSourceLanguage?: string) => {
          // Handle translation logic here
          console.log('Translation requested:', { messageId, targetLanguage, forceRetranslate, forcedSourceLanguage });
        }}
        onAddTranslatingState={onAddTranslatingState}
        isTranslating={onIsTranslating}
        conversationType={conversationType}
        userRole={userRole}
        conversationId={conversationId}
        className="mb-2"
      />
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// ===== LOADING INDICATOR =====

const LoadingIndicator = ({ isLoadingMore, hasMore }: { isLoadingMore: boolean; hasMore: boolean }) => {
  if (!isLoadingMore || !hasMore) return null;

  return (
    <div className="flex justify-center py-4">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span>Chargement des messages plus anciens...</span>
      </div>
    </div>
  );
};

// ===== EMPTY STATE =====

const EmptyState = ({ message, description }: { message: string; description: string }) => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
    <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
      <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{message}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

// ===== MAIN COMPONENT =====

export function VirtualizedMessageList({
  messages,
  currentUser,
  userLanguage,
  usedLanguages,
  isLoadingMessages,
  isLoadingMore,
  hasMore,
  emptyStateMessage,
  emptyStateDescription,
  className,
  onEditMessage,
  onDeleteMessage,
  onLoadMore,
  onAddTranslatingState,
  onIsTranslating,
  conversationType,
  userRole,
  conversationId,
  reverseOrder = false
}: VirtualizedMessageListProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(600);
  const [itemHeight, setItemHeight] = React.useState(80);

  // Calculer la hauteur du conteneur
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setContainerHeight(height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Calculer la hauteur des éléments basée sur le contenu
  const calculateItemHeight = useCallback((message: UnifiedMessage) => {
    // Estimation basée sur la longueur du contenu
    const contentLength = message.content.length;
    const baseHeight = 60; // Hauteur de base
    const lineHeight = 20; // Hauteur par ligne
    const maxLines = 10; // Nombre maximum de lignes visibles
    
    // Calculer le nombre de lignes estimé
    const estimatedLines = Math.min(
      Math.ceil(contentLength / 50), // ~50 caractères par ligne
      maxLines
    );
    
    // Ajouter de l'espace pour les métadonnées (nom, heure, etc.)
    const metadataHeight = 40;
    
    return baseHeight + (estimatedLines * lineHeight) + metadataHeight;
  }, []);

  // Mettre à jour la hauteur des éléments quand les messages changent
  useEffect(() => {
    if (messages.length > 0) {
      const avgHeight = messages.reduce((sum, msg) => sum + calculateItemHeight(msg), 0) / messages.length;
      setItemHeight(Math.max(60, Math.min(200, avgHeight))); // Entre 60px et 200px
    }
  }, [messages, calculateItemHeight]);

  // Données pour la liste virtualisée
  const itemData = useMemo(() => ({
    messages: reverseOrder ? [...messages].reverse() : messages,
    currentUser,
    userLanguage,
    usedLanguages,
    onEditMessage,
    onDeleteMessage,
    onAddTranslatingState,
    onIsTranslating,
    conversationType,
    userRole,
    conversationId
  }), [
    messages,
    reverseOrder,
    currentUser,
    userLanguage,
    usedLanguages,
    onEditMessage,
    onDeleteMessage,
    onAddTranslatingState,
    onIsTranslating,
    conversationType,
    userRole,
    conversationId
  ]);

  // Gestion du scroll pour charger plus de messages
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => {
    // Si on scroll vers le haut (messages plus anciens) et qu'on est proche du début
    if (scrollDirection === 'backward' && scrollOffset < 100 && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Scroll vers le bas pour les nouveaux messages
  const scrollToBottom = useCallback(() => {
    if (listRef.current && messages.length > 0) {
      const itemCount = messages.length;
      listRef.current.scrollToItem(itemCount - 1, 'end');
    }
  }, [messages.length]);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (messages.length > 0 && !reverseOrder) {
      // Délai pour permettre au DOM de se mettre à jour
      setTimeout(scrollToBottom, 100);
    }
  }, [messages.length, scrollToBottom, reverseOrder]);

  // État de chargement initial
  if (isLoadingMessages && messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des messages...</p>
        </div>
      </div>
    );
  }

  // État vide
  if (messages.length === 0) {
    return (
      <div className={cn("h-full", className)}>
        <EmptyState message={emptyStateMessage} description={emptyStateDescription} />
      </div>
    );
  }

  // Pour de petites listes, utiliser le rendu normal
  if (messages.length < 50) {
    return (
      <div className={cn("h-full overflow-y-auto", className)} ref={containerRef}>
        <LoadingIndicator isLoadingMore={isLoadingMore} hasMore={hasMore} />
        <div className="space-y-2 p-2">
          {(reverseOrder ? [...messages].reverse() : messages).map((message, index) => (
            <BubbleMessage
              key={message.id}
              message={message}
              currentUser={currentUser}
              userLanguage={userLanguage}
              usedLanguages={usedLanguages}
              onEdit={onEditMessage}
              onDelete={onDeleteMessage}
              onTranslate={(messageId: string, targetLanguage: string, forceRetranslate?: boolean, forcedSourceLanguage?: string) => {
                console.log('Translation requested:', { messageId, targetLanguage, forceRetranslate, forcedSourceLanguage });
              }}
              onAddTranslatingState={onAddTranslatingState}
              isTranslating={onIsTranslating}
              conversationType={conversationType}
              userRole={userRole}
              conversationId={conversationId}
            />
          ))}
        </div>
      </div>
    );
  }

  // Liste virtualisée pour de grandes listes
  return (
    <div className={cn("h-full", className)} ref={containerRef}>
      <LoadingIndicator isLoadingMore={isLoadingMore} hasMore={hasMore} />
      <List
        ref={listRef}
        height={containerHeight}
        itemCount={messages.length}
        itemSize={itemHeight}
        itemData={itemData}
        onScroll={handleScroll}
        overscanCount={5} // Rendre 5 éléments supplémentaires pour le scroll fluide
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {MessageItem}
      </List>
    </div>
  );
}

// ===== HOOK POUR LA GESTION DU SCROLL =====

export function useMessageScroll() {
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);
  const [isNearBottom, setIsNearBottom] = React.useState(true);

  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => {
    // Détecter si l'utilisateur est proche du bas
    const threshold = 100;
    const nearBottom = scrollOffset < threshold;
    setIsNearBottom(nearBottom);
    
    // Auto-scroll seulement si l'utilisateur est proche du bas
    setShouldAutoScroll(nearBottom);
  }, []);

  const scrollToBottom = useCallback((listRef: React.RefObject<List>) => {
    if (listRef.current && shouldAutoScroll) {
      // Scroll vers le dernier élément
      const itemCount = listRef.current.props.itemCount;
      listRef.current.scrollToItem(itemCount - 1, 'end');
    }
  }, [shouldAutoScroll]);

  return {
    shouldAutoScroll,
    isNearBottom,
    handleScroll,
    scrollToBottom
  };
}
