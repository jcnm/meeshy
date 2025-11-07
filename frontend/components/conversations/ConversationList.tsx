'use client';

import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { MessageSquare, Link2, Users, Globe, Search, Loader2, Pin, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Conversation, SocketIOUser as User } from '@shared/types';
import type { UserConversationPreferences, UserConversationCategory } from '@/types/user-preferences';
import { CreateLinkButton } from './create-link-button';
import { userPreferencesService } from '@/services/user-preferences.service';
import { CommunityCarousel, type CommunityFilter } from './CommunityCarousel';
import { getTagColor } from '@/utils/tag-colors';
import { Folder } from 'lucide-react';

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
  isPinned?: boolean;
  tags?: string[];
}

// Composant pour un élément de conversation
const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  currentUser,
  onClick,
  t,
  isPinned = false,
  tags = []
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
      const avatarUrl = participantUser?.avatar;
      // console.log('[ConversationItem] Direct avatar:', {
      //   id: conversation.id,
      //   type: conversation.type,
      //   hasParticipants: !!conversation.participants,
      //   participantsCount: conversation.participants?.length,
      //   otherParticipant: otherParticipant ? 'Found' : 'Not found',
      //   hasUser: !!participantUser,
      //   avatarUrl
      // });
      return avatarUrl;
    }
    // Pour les conversations de groupe/public/global, retourner l'image de la conversation
    const avatarUrl = conversation.image || conversation.avatar;
    // console.log('[ConversationItem] Group avatar:', {
    //   id: conversation.id,
    //   type: conversation.type,
    //   image: conversation.image,
    //   avatar: conversation.avatar,
    //   avatarUrl
    // });
    return avatarUrl;
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
        {/* Tags colorés au-dessus du titre */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.slice(0, 3).map((tag) => {
              const colors = getTagColor(tag);
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "px-1.5 py-0 h-4 text-[10px] font-medium border",
                    colors.bg,
                    colors.text,
                    colors.border
                  )}
                >
                  {tag}
                </Badge>
              );
            })}
            {tags.length > 3 && (
              <Badge
                variant="outline"
                className="px-1.5 py-0 h-4 text-[10px] font-medium border border-muted-foreground/20 bg-muted/50 text-muted-foreground"
              >
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isPinned && (
              <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0 fill-current" />
            )}
            <h3 className="font-semibold text-sm truncate">
              {getConversationName()}
            </h3>
          </div>
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
  const [preferencesMap, setPreferencesMap] = useState<Map<string, UserConversationPreferences>>(new Map());
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<CommunityFilter>({ type: 'all' });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [categories, setCategories] = useState<UserConversationCategory[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    // Charger l'état collapsed depuis localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('collapsedConversationSections');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          return new Set();
        }
      }
    }
    return new Set();
  });

  // Référence pour le scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Charger les préférences utilisateur pour toutes les conversations
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoadingPreferences(true);
        const allPrefs = await userPreferencesService.getAllPreferences();
        const map = new Map<string, UserConversationPreferences>();
        allPrefs.forEach(pref => {
          map.set(pref.conversationId, pref);
        });
        setPreferencesMap(map);
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoadingPreferences(false);
      }
    };
    loadPreferences();

    // Recharger les préférences toutes les 2 secondes pour détecter les changements
    const intervalId = setInterval(loadPreferences, 2000);

    return () => clearInterval(intervalId);
  }, [conversations.length]); // Recharger quand la liste change

  // Charger les catégories
  useEffect(() => {
    console.log('[ConversationList] useEffect for categories is running');
    const loadCategories = async () => {
      try {
        console.log('[ConversationList] Starting to load categories...');
        const cats = await userPreferencesService.getCategories();
        console.log('[ConversationList] Categories loaded:', cats);
        // Trier par order, puis alphabétiquement
        const sorted = cats.sort((a, b) => {
          if (a.order !== b.order) {
            return a.order - b.order;
          }
          return a.name.localeCompare(b.name);
        });
        console.log('[ConversationList] Categories sorted:', sorted);
        setCategories(sorted);
      } catch (error) {
        console.error('[ConversationList] Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Sauvegarder l'état collapsed dans localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('collapsedConversationSections', JSON.stringify([...collapsedSections]));
    }
  }, [collapsedSections]);

  // Fonction pour toggle une section
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Filtrage et tri des conversations - épinglées en haut
  const filteredConversations = useMemo(() => {
    // Filtrer selon le filtre sélectionné (all/community/reacted/archived/category)
    let filtered = conversations.filter(conv => {
      const prefs = preferencesMap.get(conv.id);
      const isArchived = prefs?.isArchived || false;

      // Filtrer selon le type de filtre
      if (selectedFilter.type === 'all') {
        // "All" affiche toutes les conversations sauf archivées
        return !isArchived;
      } else if (selectedFilter.type === 'archived') {
        // "Archived" affiche uniquement les archivées
        return isArchived;
      } else if (selectedFilter.type === 'reacted') {
        // "Reacted" affiche uniquement les conversations avec réaction (non archivées)
        return !isArchived && !!prefs?.reaction;
      } else if (selectedFilter.type === 'community') {
        // Filtrer par communauté, exclure les archivées
        return !isArchived && conv.communityId === selectedFilter.communityId;
      } else if (selectedFilter.type === 'category') {
        // Filtrer par catégorie, exclure les archivées
        return !isArchived && prefs?.categoryId === selectedFilter.categoryId;
      }
      return true;
    });

    // Filtrer par recherche
    if (searchQuery) {
      filtered = filtered.filter(conv => {
        const title = conv.title || '';
        const lastMessage = conv.lastMessage?.content || '';
        const query = searchQuery.toLowerCase();

        // Search in title and last message
        // TODO: Add search by user-specific tags from preferences
        return title.toLowerCase().includes(query) ||
               lastMessage.toLowerCase().includes(query);
      });
    }

    // Trier les conversations : épinglées en haut, puis par ordre de dernier message
    const sorted = filtered.sort((a, b) => {
      const aPrefs = preferencesMap.get(a.id);
      const bPrefs = preferencesMap.get(b.id);
      const aPinned = aPrefs?.isPinned || false;
      const bPinned = bPrefs?.isPinned || false;

      // Les conversations épinglées viennent en premier
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Pour les conversations du même statut d'épinglage, trier par date de dernier message
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // console.log('[ConversationList] Filtrage et tri des conversations:', {
    //   total: conversations.length,
    //   filtered: sorted.length,
    //   searchQuery,
    //   selectedFilter,
    //   pinnedCount: sorted.filter(c => preferencesMap.get(c.id)?.isPinned).length,
    //   archivedCount: conversations.filter(c => preferencesMap.get(c.id)?.isArchived).length
    // });

    return sorted;
  }, [conversations, searchQuery, preferencesMap, selectedFilter]);

  // Grouper les conversations par catégorie
  const groupedConversations = useMemo(() => {
    const groups: Array<{
      type: 'pinned' | 'category' | 'uncategorized';
      categoryId?: string;
      categoryName?: string;
      conversations: Conversation[];
    }> = [];

    // Séparer les conversations
    const pinnedWithoutCategory: Conversation[] = [];
    const conversationsByCategory = new Map<string, Conversation[]>();
    const uncategorized: Conversation[] = [];

    filteredConversations.forEach(conv => {
      const prefs = preferencesMap.get(conv.id);
      const isPinned = prefs?.isPinned || false;
      const categoryId = prefs?.categoryId;

      console.log('[ConversationList] Processing conversation:', {
        id: conv.id,
        title: conv.title,
        isPinned,
        categoryId,
        hasPrefs: !!prefs
      });

      if (isPinned && !categoryId) {
        // Épinglées sans catégorie
        pinnedWithoutCategory.push(conv);
      } else if (categoryId) {
        // Avec catégorie (épinglée ou non)
        if (!conversationsByCategory.has(categoryId)) {
          conversationsByCategory.set(categoryId, []);
        }
        conversationsByCategory.get(categoryId)!.push(conv);
      } else {
        // Sans catégorie et non épinglée
        uncategorized.push(conv);
      }
    });

    // Ajouter le groupe "Pinned" si nécessaire
    if (pinnedWithoutCategory.length > 0) {
      groups.push({
        type: 'pinned',
        conversations: pinnedWithoutCategory
      });
    }

    // Ajouter les groupes de catégories (dans l'ordre des catégories)
    const displayedCategoryIds = new Set<string>();
    categories.forEach(category => {
      const categoryConvs = conversationsByCategory.get(category.id);
      if (categoryConvs && categoryConvs.length > 0) {
        groups.push({
          type: 'category',
          categoryId: category.id,
          categoryName: category.name,
          conversations: categoryConvs
        });
        displayedCategoryIds.add(category.id);
      }
    });

    // Ajouter les conversations avec categoryId orphelin (catégorie n'existe plus) dans uncategorized
    conversationsByCategory.forEach((convs, categoryId) => {
      if (!displayedCategoryIds.has(categoryId)) {
        console.warn('[ConversationList] Found orphaned conversations with missing category:', categoryId);
        uncategorized.push(...convs);
      }
    });

    // Ajouter le groupe "Uncategorized" si nécessaire
    if (uncategorized.length > 0) {
      groups.push({
        type: 'uncategorized',
        conversations: uncategorized
      });
    }

    console.log('[ConversationList] Grouped conversations:', {
      totalCategories: categories.length,
      groups: groups.map(g => ({
        type: g.type,
        categoryName: g.categoryName,
        count: g.conversations.length
      })),
      conversationsByCategory: Array.from(conversationsByCategory.entries()).map(([id, convs]) => ({
        categoryId: id,
        count: convs.length
      }))
    });

    return groups;
  }, [filteredConversations, preferencesMap, categories]);

  // Gérer le focus de la recherche
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback((e: React.FocusEvent) => {
    // Vérifier si le focus va vers un élément du carousel
    const relatedTarget = e.relatedTarget as HTMLElement;
    const searchContainer = searchContainerRef.current;

    if (searchContainer && relatedTarget && searchContainer.contains(relatedTarget)) {
      // Le focus reste dans le container (carousel), ne pas fermer
      return;
    }

    // Petit délai pour permettre les clics sur le carousel
    setTimeout(() => {
      setIsSearchFocused(false);
    }, 150);
  }, []);

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

        {/* Barre de recherche et carousel */}
        <div ref={searchContainerRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              placeholder={tSearch('placeholder')}
              className="pl-9 h-9"
            />
          </div>

          {/* Community Carousel - affiché uniquement quand la recherche est focalisée */}
          {isSearchFocused && (
            <div onMouseDown={(e) => e.preventDefault()}>
              <CommunityCarousel
                conversations={conversations}
                selectedFilter={selectedFilter}
                onFilterChange={setSelectedFilter}
                t={(key: string) => t(key)}
                preferencesMap={preferencesMap}
              />
            </div>
          )}
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
          <div className="px-4 py-2">
            {groupedConversations.map((group, groupIndex) => {
              const sectionId = group.type === 'category' && group.categoryId
                ? `category-${group.categoryId}`
                : group.type;
              const isCollapsed = collapsedSections.has(sectionId);

              return (
                <div key={`group-${group.type}-${group.categoryId || groupIndex}`} className="mb-4">
                  {/* Header de section */}
                  {(group.type === 'pinned' || group.type === 'category') && (
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 mb-1 cursor-pointer hover:bg-accent/50 rounded-md transition-colors"
                      onClick={() => toggleSection(sectionId)}
                    >
                      {/* Chevron pour indiquer si la section est ouverte ou fermée */}
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}

                      {group.type === 'pinned' ? (
                        <>
                          <Pin className="h-4 w-4 text-primary fill-current flex-shrink-0" />
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t('conversationsList.pinned') || 'Épinglées'}
                          </h4>
                        </>
                      ) : (
                        <>
                          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {group.categoryName}
                          </h4>
                        </>
                      )}
                      <Badge variant="secondary" className="ml-auto h-5 px-2 text-[10px]">
                        {group.conversations.length}
                      </Badge>
                    </div>
                  )}

                  {/* Conversations du groupe - masquées si collapsed */}
                  {!isCollapsed && (
                    <div className="space-y-1">
                      {group.conversations.map((conversation) => (
                        <ConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          isSelected={selectedConversation?.id === conversation.id}
                          currentUser={currentUser}
                          onClick={() => onSelectConversation(conversation)}
                          t={t}
                          isPinned={preferencesMap.get(conversation.id)?.isPinned || false}
                          tags={preferencesMap.get(conversation.id)?.tags || []}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

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
