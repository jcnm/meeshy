'use client';

import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { MessageSquare, Link2, Users, Globe, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Conversation, SocketIOUser as User } from '@shared/types';
import { CreateLinkButton } from './create-link-button';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  currentUser: User;
  isLoading: boolean;
  isMobile: boolean;
  showConversationList: boolean;
  onSelectConversation: (conversation: Conversation) => void;
  onCreateConversation: () => void;
  onLinkCreated: () => void;
  t: (key: string) => string;
  tSearch: (key: string) => string;
  // Props pour la pagination
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  currentUser: User;
  onClick: () => void;
  t: (key: string) => string;
}

// Composant pour un élément de conversation
const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  currentUser,
  onClick,
  t
}: ConversationItemProps) {
  const getConversationName = useCallback(() => {
    if (conversation.type !== 'direct') {
      return conversation.title || 'Groupe sans nom';
    }

    // Pour les conversations directes, extraire le nom de l'autre utilisateur
    const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.id);

    if (otherParticipant) {
      // Les participants ont un objet 'user' au runtime même si le type ne le reflète pas
      const participantUser = (otherParticipant as any).user;

      if (participantUser) {
        // Utiliser displayName, puis username, puis firstName/lastName
        const userName = participantUser.displayName ||
                        participantUser.username ||
                        (participantUser.firstName && participantUser.lastName
                          ? `${participantUser.firstName} ${participantUser.lastName}`.trim()
                          : participantUser.firstName || participantUser.lastName) ||
                        'Utilisateur';

        return `${userName} ${t('andMe')}`;
      }
    }

    // Fallback sur le titre de la conversation
    const conversationTitle = conversation.title || 'Conversation privée';
    return `${conversationTitle} ${t('andMe')}`;
  }, [conversation, currentUser, t]);

  const getConversationAvatar = useCallback(() => {
    const name = getConversationName();
    return name.slice(0, 2).toUpperCase();
  }, [getConversationName]);

  const getConversationAvatarUrl = useCallback(() => {
    if (conversation.type === 'direct') {
      // Pour les conversations directes, retourner l'avatar de l'autre participant
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.id);
      const participantUser = (otherParticipant as any)?.user;
      return participantUser?.avatar;
    }
    // Pour les conversations de groupe/public/global, retourner l'image de la conversation
    return conversation.image || conversation.avatar;
  }, [conversation, currentUser]);

  const getConversationIcon = useCallback(() => {
    if (conversation.visibility === 'public') return <Globe className="h-4 w-4" />;
    if (conversation.type === 'broadcast') return <Users className="h-4 w-4" />;
    if (conversation.type === 'group') return <Users className="h-4 w-4" />;
    if (conversation.type !== 'direct') return <Users className="h-4 w-4" />;
    return null;
  }, [conversation.type, conversation.visibility]);

  const formatTime = useCallback((date: Date | string) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getSenderName = useCallback((message: any) => {
    // Gérer les utilisateurs anonymes ET membres
    const sender = message?.anonymousSender || message?.sender;
    const isAnonymous = !!message?.anonymousSender;

    if (!sender) return null;

    // Construire le nom
    let senderName = sender.displayName ||
                     sender.username ||
                     (sender.firstName || sender.lastName
                       ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim()
                       : null);

    if (!senderName) {
      senderName = isAnonymous ? 'Anonyme' : 'Utilisateur';
    }

    // Ajouter le suffixe (anonyme) si c'est un utilisateur anonyme
    return isAnonymous ? `${senderName} (anonyme)` : senderName;
  }, []);

  return (
    <div
      onClick={() => {
        console.log('[ConversationItem] Clic sur conversation:', {
          id: conversation.id,
          title: conversation.title,
          type: conversation.type,
          visibility: conversation.visibility,
          isSelected
        });
        onClick();
      }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "hover:bg-accent/50",
        isSelected && "bg-primary/10 hover:bg-primary/20"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={getConversationAvatarUrl()} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getConversationIcon() || getConversationAvatar()}
          </AvatarFallback>
        </Avatar>
        {/* Indicateur en ligne */}
        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-background" />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        {/* TODO: Display user-specific tags from preferences */}

        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm truncate">
            {getConversationName()}
          </h3>
          {conversation.lastMessage && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatTime(conversation.lastMessage.createdAt)}
            </span>
          )}
        </div>
        
        {conversation.lastMessage && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {getSenderName(conversation.lastMessage) && (
              <span className="font-medium">{getSenderName(conversation.lastMessage)}: </span>
            )}
            {conversation.lastMessage.content}
          </p>
        )}
      </div>

      {/* Badge de messages non lus */}
      {conversation.unreadCount !== undefined && conversation.unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5"
        >
          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
        </Badge>
      )}
    </div>
  );
});

export function ConversationList({
  conversations,
  selectedConversation,
  currentUser,
  isLoading,
  isMobile,
  showConversationList,
  onSelectConversation,
  onCreateConversation,
  onLinkCreated,
  t,
  tSearch,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Référence pour le scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Filtrage des conversations - toutes les conversations dans une seule liste
  const filteredConversations = useMemo(() => {
    const filtered = conversations.filter(conv => {
      if (!searchQuery) return true;
      const title = conv.title || '';
      const lastMessage = conv.lastMessage?.content || '';
      const query = searchQuery.toLowerCase();

      // Search in title and last message
      // TODO: Add search by user-specific tags from preferences
      return title.toLowerCase().includes(query) ||
             lastMessage.toLowerCase().includes(query);
    });

    console.log('[ConversationList] Filtrage des conversations:', {
      total: conversations.length,
      filtered: filtered.length,
      searchQuery
    });

    return filtered;
  }, [conversations, searchQuery]);
  
  // Détection du scroll infini avec Intersection Observer
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          console.log('📜 [Pagination] Trigger détecté - chargement de plus de conversations');
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    
    const trigger = loadMoreTriggerRef.current;
    if (trigger) {
      observer.observe(trigger);
    }
    
    return () => {
      if (trigger) {
        observer.unobserve(trigger);
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore]);
  
  // Test de défilement - ajouter des éléments de test si nécessaire
  // Logs désactivés pour éviter la répétition excessive

  return (
    <div className="flex flex-col h-full max-h-full bg-card conversation-list-container">
      {/* Header de la liste des conversations */}
      <div className="flex-shrink-0 p-4 border-b bg-card z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          
          <div className="flex items-center gap-2">
            {/* Bouton créer nouvelle conversation */}
            <Button
              onClick={onCreateConversation}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('createNewConversation')}
            >
              <MessageSquare className="h-4 w-4 text-primary" />
            </Button>

            {/* Bouton créer lien */}
            <CreateLinkButton
              onLinkCreated={onLinkCreated}
              forceModal={true}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Link2 className="h-4 w-4 text-primary" />
            </CreateLinkButton>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tSearch('placeholder')}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('loadingConversations')}</p>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? t('noConversationsFound')
                : t('noConversations')
              }
            </p>
          </div>
        ) : (
          <div className="px-4 py-2 space-y-1">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                currentUser={currentUser}
                onClick={() => onSelectConversation(conversation)}
                t={t}
              />
            ))}
            
            {/* Indicateur de chargement de plus de conversations */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {t('loadingMore') || 'Chargement...'}
                </span>
              </div>
            )}
            
            {/* Trigger pour le chargement infini - invisible mais détecté */}
            {hasMore && !isLoadingMore && (
              <div 
                ref={loadMoreTriggerRef}
                className="h-4 w-full"
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>

      {/* Bouton de création en bas */}
      <div className="flex-shrink-0 p-4 border-t bg-card">
        <Button
          onClick={onCreateConversation}
          className="w-full flex items-center justify-center gap-2 h-11 text-sm font-medium"
        >
          <MessageSquare className="h-5 w-5" />
          {t('createNewConversation')}
        </Button>
      </div>
    </div>
  );
}
