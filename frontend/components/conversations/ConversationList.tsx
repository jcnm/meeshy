'use client';

import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { MessageSquare, Link2, Users, Globe, Search, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
}

// Composant pour un élément de conversation
const ConversationItem = memo(function ConversationItem({ 
  conversation, 
  isSelected, 
  currentUser,
  onClick 
}: ConversationItemProps) {
  const getConversationName = useCallback(() => {
    if (conversation.type !== 'direct') {
      return conversation.title || 'Groupe sans nom';
    }
    
    // Pour l'instant, utiliser le titre car participants n'a pas de propriété user dans ce contexte
    // TODO: Charger les détails des participants séparément
    const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.id);
    if (otherParticipant) {
      // Utiliser le titre de la conversation pour l'instant
      return conversation.title || 'Conversation privée';
    }
    
    return conversation.title || 'Conversation privée';
  }, [conversation, currentUser]);

  const getConversationAvatar = useCallback(() => {
    const name = getConversationName();
    return name.slice(0, 2).toUpperCase();
  }, [getConversationName]);

  const getConversationAvatarUrl = useCallback(() => {
    if (conversation.type === 'direct') {
      // Pour l'instant, pas d'avatar car participants n'a pas de propriété user
      // TODO: Charger les avatars des participants séparément
      return undefined;
    }
    return undefined;
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
            {conversation.lastMessage.content}
          </p>
        )}
      </div>

      {/* Badge de messages non lus */}
      {conversation.unreadCount && conversation.unreadCount > 0 && (
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
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Référence pour le scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Filtrage des conversations
  const { publicConversations, privateConversations } = useMemo(() => {
    const filtered = conversations.filter(conv => {
      if (!searchQuery) return true;
      const title = conv.title || '';
      const lastMessage = conv.lastMessage?.content || '';
      const query = searchQuery.toLowerCase();
      return title.toLowerCase().includes(query) || 
             lastMessage.toLowerCase().includes(query);
    });

    const publicConvs = filtered.filter(conv => 
      conv.visibility === 'public' || conv.type === 'broadcast'
    );
    const privateConvs = filtered.filter(conv => 
      conv.visibility === 'private' || conv.type === 'direct' || conv.type === 'group' || conv.type === 'anonymous'
    );

    console.log('[ConversationList] Classification des conversations:', {
      total: filtered.length,
      public: publicConvs.length,
      private: privateConvs.length,
      publicDetails: publicConvs.map(c => ({ id: c.id, type: c.type, visibility: c.visibility, title: c.title })),
      privateDetails: privateConvs.map(c => ({ id: c.id, type: c.type, visibility: c.visibility, title: c.title }))
    });

    return {
      publicConversations: publicConvs,
      privateConversations: privateConvs
    };
  }, [conversations, searchQuery]);

  const currentConversations = activeTab === 'public' ? publicConversations : privateConversations;
  
  // Synchroniser l'onglet avec la conversation sélectionnée AU CHARGEMENT INITIAL seulement
  useEffect(() => {
    if (selectedConversation) {
      const isPublicConversation = selectedConversation.visibility === 'public' || selectedConversation.type === 'broadcast';
      const requiredTab = isPublicConversation ? 'public' : 'private';
      
      // Vérifier si la conversation est dans l'onglet actuel
      const currentTabConversations = activeTab === 'public' ? publicConversations : privateConversations;
      const isInCurrentTab = currentTabConversations.some(c => c.id === selectedConversation.id);
      
      // Changer d'onglet SEULEMENT si la conversation n'est pas visible dans l'onglet actuel
      if (!isInCurrentTab) {
        console.log('[ConversationList] Conversation pas visible dans onglet actuel, switch vers:', {
          conversationId: selectedConversation.id,
          conversationType: selectedConversation.type,
          visibility: selectedConversation.visibility,
          currentTab: activeTab,
          requiredTab,
          isInCurrentTab
        });
        setActiveTab(requiredTab);
      }
    }
  }, [selectedConversation?.id, publicConversations, privateConversations]); // Inclure les listes pour la vérification
  
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
  const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

  return (
    <div className="flex flex-col h-full max-h-full bg-card conversation-list-container overflow-hidden">
      {/* Header fixe */}
      <div className="flex-shrink-0 p-4 border-b conversation-list-header">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          
          <div className="flex items-center gap-2">
            {/* Indicateur de messages non lus */}
            {totalUnread > 0 && (
              <Badge variant="destructive">
                {totalUnread}
              </Badge>
            )}
            
            {/* Bouton créer lien */}
            <CreateLinkButton
              onLinkCreated={onLinkCreated}
              forceModal={true}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Link2 className="h-4 w-4" />
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

      {/* Onglets fixes */}
      <div className="flex-shrink-0">
        <Tabs value={activeTab} onValueChange={(v) => {
          console.log('[ConversationList] Changement onglet:', { from: activeTab, to: v });
          setActiveTab(v as 'public' | 'private');
        }}>
          <TabsList className="mx-4 mt-2 grid w-[calc(100%-2rem)] grid-cols-2">
            <TabsTrigger value="public" className="text-xs">
              {t('public')} ({publicConversations.length})
            </TabsTrigger>
            <TabsTrigger value="private" className="text-xs">
              {t('private')} ({privateConversations.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Contenu scrollable - en dehors des Tabs pour éviter les conflits */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('loadingConversations')}</p>
            </div>
          </div>
        ) : currentConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery 
                ? t(`no${activeTab === 'public' ? 'Public' : 'Private'}ConversationsFound`)
                : t(`no${activeTab === 'public' ? 'Public' : 'Private'}Conversations`)
              }
            </p>
          </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            className="h-full overflow-y-auto conversation-list-scroll conversation-scroll"
          >
            <div className="px-4 py-2 space-y-1">
              {currentConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedConversation?.id === conversation.id}
                  currentUser={currentUser}
                  onClick={() => onSelectConversation(conversation)}
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
          </div>
        )}
      </div>

      {/* Bouton de création toujours visible en bas */}
      <div className="flex-shrink-0 p-4 border-t bg-card/95 backdrop-blur-sm">
        <Button
          onClick={onCreateConversation}
          className="w-full flex items-center justify-center gap-2 h-12"
          size="default"
        >
          <Plus className="h-5 w-5" />
          {t('createNewConversation')}
        </Button>
      </div>
    </div>
  );
}
