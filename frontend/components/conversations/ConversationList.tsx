'use client';

import { useState, useCallback, useMemo } from 'react';
import { MessageSquare, Link2, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  Conversation,
  SocketIOUser as User,
  ThreadMember
} from '@shared/types';
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
}

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
  tSearch
}: ConversationListProps) {
  // États pour les onglets et filtres
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [publicSearchFilter, setPublicSearchFilter] = useState('');
  const [privateSearchFilter, setPrivateSearchFilter] = useState('');

  // Fonctions helper pour filtrer les conversations
  const getFilteredPublicConversations = useCallback(() => {
    const publicConversations = conversations.filter(conv => 
      conv.type === 'global' || conv.type === 'public'
    );
    
    if (!publicSearchFilter) return publicConversations;
    
    const searchLower = publicSearchFilter.toLowerCase();
    return publicConversations.filter(conv => {
      const name = getConversationDisplayName(conv).toLowerCase();
      const description = conv.description?.toLowerCase() || '';
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [conversations, publicSearchFilter]);

  const getFilteredPrivateConversations = useCallback(() => {
    const privateConversations = conversations.filter(conv => 
      conv.type !== 'global' && conv.type !== 'public'
    );
    
    if (!privateSearchFilter) return privateConversations;
    
    const searchLower = privateSearchFilter.toLowerCase();
    return privateConversations.filter(conv => {
      const name = getConversationDisplayName(conv).toLowerCase();
      const description = conv.description?.toLowerCase() || '';
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [conversations, privateSearchFilter]);

  // Fonction utilitaire pour obtenir le nom d'affichage d'une conversation
  const getConversationDisplayName = useCallback((conversation: Conversation): string => {
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct' || 
                                 (!conversation.isGroup && conversation.participants?.length === 2) ||
                                 (!conversation.isGroup && !conversation.name && !conversation.title);

    if (!isDirectConversation) {
      // Pour les groupes, utiliser le nom ou titre
      return conversation.name || conversation.title || 'Groupe sans nom';
    } else {
      // Pour les conversations directes, d'abord essayer les participants
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.id);
      if (otherParticipant?.user) {
        const displayName = otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
        
        if (displayName) {
          return displayName;
        }
      }
      
      // Fallback : nettoyer le nom de la conversation
      const conversationName = conversation.name || conversation.title;
      if (conversationName && conversationName !== 'Conversation privée') {
        // Nettoyer les noms formatés par l'API
        let cleanName = conversationName;
        
        // Supprimer "Conversation avec" au début
        if (cleanName.startsWith('Conversation avec ')) {
          cleanName = cleanName.replace('Conversation avec ', '');
        }
        
        // Pour les noms avec "&", prendre seulement la première partie (l'interlocuteur)
        if (cleanName.includes(' & ')) {
          const parts = cleanName.split(' & ');
          // Prendre la partie qui n'est pas l'utilisateur actuel
          const currentUserName = currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
          cleanName = parts.find(part => part.trim() !== currentUserName) || parts[0];
        }
        
        // Pour les noms séparés par des virgules, filtrer l'utilisateur actuel
        if (cleanName.includes(', ')) {
          const names = cleanName.split(', ');
          const currentUserName = currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
          
          // Filtrer les noms pour exclure l'utilisateur actuel
          const otherNames = names.filter(name => name.trim() !== currentUserName);
          
          // Prendre le premier nom qui n'est pas l'utilisateur actuel
          cleanName = otherNames.length > 0 ? otherNames[0] : names[0];
        }
        
        // Vérification finale : si le nom nettoyé correspond à l'utilisateur actuel, essayer de trouver un autre nom
        const currentUserName = currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
        if (cleanName.trim() === currentUserName) {
          // Si c'est l'utilisateur actuel, retourner "Conversation privée" 
          return 'Conversation privée';
        }
        
        return cleanName.trim();
      }
      
      return 'Conversation privée';
    }
  }, [currentUser]);

  // Fonction utilitaire pour obtenir l'avatar d'une conversation
  const getConversationAvatar = useCallback((conversation: Conversation): string => {
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct' || 
                                 (!conversation.isGroup && conversation.participants?.length === 2) ||
                                 (!conversation.isGroup && !conversation.name && !conversation.title);

    if (!isDirectConversation) {
      // Pour les groupes, utiliser le nom ou titre
      const groupName = conversation.name || conversation.title || 'Groupe';
      return groupName.slice(0, 2).toUpperCase();
    } else {
      // Pour les conversations directes, d'abord essayer les participants
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.id);
      if (otherParticipant?.user) {
        const displayName = otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
        
        if (displayName) {
          return displayName.slice(0, 2).toUpperCase();
        }
      }
      
      // Fallback : utiliser le nom nettoyé de la conversation (même logique que getConversationDisplayName)
      const conversationName = conversation.name || conversation.title;
      if (conversationName && conversationName !== 'Conversation privée') {
        let cleanName = conversationName;
        
        // Supprimer "Conversation avec" au début
        if (cleanName.startsWith('Conversation avec ')) {
          cleanName = cleanName.replace('Conversation avec ', '');
        }
        
        // Pour les noms avec "&", prendre seulement la première partie (l'interlocuteur)
        if (cleanName.includes(' & ')) {
          const parts = cleanName.split(' & ');
          // Prendre la partie qui n'est pas l'utilisateur actuel
          const currentUserName = currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
          cleanName = parts.find(part => part.trim() !== currentUserName) || parts[0];
        }
        
        // Pour les noms séparés par des virgules, filtrer l'utilisateur actuel
        if (cleanName.includes(', ')) {
          const names = cleanName.split(', ');
          const currentUserName = currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
          
          // Filtrer les noms pour exclure l'utilisateur actuel
          const otherNames = names.filter(name => name.trim() !== currentUserName);
          
          // Prendre le premier nom qui n'est pas l'utilisateur actuel
          cleanName = otherNames.length > 0 ? otherNames[0] : names[0];
        }
        
        // Vérification finale : si le nom nettoyé correspond à l'utilisateur actuel, utiliser initiales par défaut
        const currentUserName = currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
        if (cleanName.trim() === currentUserName) {
          return 'CP'; // Conversation Privée
        }
        
        return cleanName.trim().slice(0, 2).toUpperCase();
      }
      
      return 'CP'; // Conversation Privée
    }
  }, [currentUser]);

  // Fonction pour obtenir l'URL de l'avatar d'une conversation
  const getConversationAvatarUrl = useCallback((conversation: Conversation): string | undefined => {
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct' || 
                                 (!conversation.isGroup && conversation.participants?.length === 2) ||
                                 (!conversation.isGroup && !conversation.name && !conversation.title);

    if (isDirectConversation) {
      // Pour les conversations privées, utiliser l'avatar de l'autre participant
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser?.id);
      if (otherParticipant?.user?.avatar) {
        return otherParticipant.user.avatar;
      }
    }
    // Pour les groupes, on pourrait avoir un avatar de groupe dans le futur
    return undefined;
  }, [currentUser]);

  // Fonction utilitaire pour obtenir l'icône d'une conversation par type
  const getConversationIcon = useCallback((conversation: Conversation): React.ReactNode | null => {
    // Pour les conversations publiques et globales, utiliser des icônes spécifiques
    if (conversation.type === 'public') {
      return <Users className="h-6 w-6" />;
    }
    if (conversation.type === 'global') {
      return <Calendar className="h-6 w-6" />;
    }
    if (conversation.type !== 'direct') {
      return <Users className="h-6 w-6" />;
    }
    return null; // Pour les conversations privées, on utilisera l'avatar
  }, []);

  // Fonction de debug pour comprendre comment je récupère les destinataires
  const debugConversationData = useCallback((conversation: Conversation) => {
    console.log('=== DEBUG CONVERSATION ===');
    console.log('Conversation ID:', conversation.id);
    console.log('Conversation type:', conversation.type);
    console.log('Conversation isGroup:', conversation.isGroup);
    console.log('Conversation name:', conversation.name);
    console.log('Conversation title:', conversation.title);
    console.log('Participants:', conversation.participants);
    console.log('Current user:', currentUser);
    console.log('Other participant:', conversation.participants?.find(p => p.userId !== currentUser?.id));
    console.log('Display name from getConversationDisplayName:', getConversationDisplayName(conversation));
    console.log('Avatar initials from getConversationAvatar:', getConversationAvatar(conversation));
    console.log('=========================');
  }, [currentUser, getConversationDisplayName, getConversationAvatar]);

  return (
    <div className={cn(
      "flex flex-col bg-white/80 backdrop-blur-sm rounded-l-2xl border border-border/50 shadow-lg",
      isMobile ? (showConversationList ? "w-full conversation-list-mobile" : "hidden") : "w-96"
    )}>
      {/* Header fixe */}
      <div className="flex-shrink-0 p-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">{t('conversations.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Bouton pour créer une nouvelle conversation */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCreateConversation}
                className="h-8 w-8 p-0 rounded-full hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
                title={t('createNewConversation')}
              >
                <MessageSquare className="h-5 w-5 text-primary" />
              </Button>
              {/* Pastille pour les messages non lus */}
              {(() => {
                const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
                return totalUnread > 0 ? (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold shadow-lg"
                  >
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Badge>
                ) : null;
              })()}
            </div>
            
            {/* Bouton pour créer un nouveau lien - toujours disponible pour les administrateurs */}
            <CreateLinkButton
              onLinkCreated={onLinkCreated}
              forceModal={true}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
            >
              <Link2 className="h-5 w-5 text-primary" />
            </CreateLinkButton>
          </div>
        </div>
      </div>

      {/* Section fixe avec onglets et champs de recherche */}
      {conversations.length > 0 && (
        <div className="flex-shrink-0 mx-2">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'public' | 'private')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mt-2">
              <TabsTrigger value="public" className="flex items-center gap-1 text-xs px-2">
                <span>{t('public')}</span>
                <span className="text-xs">({getFilteredPublicConversations().length})</span>
              </TabsTrigger>
              <TabsTrigger value="private" className="flex items-center gap-1 text-xs px-2">
                <span>{t('private')}</span>
                <span className="text-xs">({getFilteredPrivateConversations().length})</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Champ de recherche fixe pour l'onglet actif */}
            <div className="mt-2">
              {activeTab === 'public' ? (
                <input
                  type="text"
                  value={publicSearchFilter}
                  onChange={(e) => setPublicSearchFilter(e.target.value)}
                  placeholder={tSearch('placeholder')}
                  className="w-full h-8 text-sm px-3 py-2 border border-border/30 rounded-lg bg-background/50 
                           placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 
                           transition-all outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={privateSearchFilter}
                  onChange={(e) => setPrivateSearchFilter(e.target.value)}
                  placeholder={tSearch('placeholder')}
                  className="w-full h-8 text-sm px-3 py-2 border border-border/30 rounded-lg bg-background/50 
                           placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 
                           transition-all outline-none"
                />
              )}
            </div>
          </Tabs>
        </div>
      )}

      {/* Liste scrollable */}
      <div className="flex-1 overflow-y-auto mx-2 pb-20">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {isLoading ? t('loadingConversations') : t('noConversations')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {isLoading 
                ? t('loadingConversationsDescription')
                : t('noConversationsDescription')
              }
            </p>
          </div>
        ) : (
          <div className="p-2">
            {/* Liste des conversations publiques */}
            {activeTab === 'public' && (
              <>
                {getFilteredPublicConversations().length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {publicSearchFilter ? t('noPublicConversationsFound') : t('noPublicConversations')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getFilteredPublicConversations()
                      .filter(conversation => conversation && conversation.id)
                      .map((conversation) => (
                      <div
                        key={`public-${conversation.id}`}
                        onClick={() => {
                          debugConversationData(conversation);
                          onSelectConversation(conversation);
                        }}
                        className={cn(
                          "flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2 conversation-list-item mobile-compact",
                          selectedConversation?.id === conversation.id
                            ? "bg-primary/20 border-primary/40 shadow-md"
                            : "hover:bg-accent/50 border-transparent hover:border-border/30"
                        )}
                      >
                        <div className="relative">
                          <Avatar className={cn("ring-2 ring-primary/20", isMobile ? "mobile-avatar conversation-list-avatar" : "h-12 w-12 conversation-list-avatar")}>
                            <AvatarImage src={getConversationAvatarUrl(conversation)} />
                            <AvatarFallback className="bg-primary/20 text-primary font-bold flex items-center justify-center text-center">
                              {getConversationIcon(conversation) || getConversationAvatar(conversation)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                        </div>

                        <div className={cn("ml-2 flex-1 relative", isMobile ? "conversation-content-mobile min-w-0" : "min-w-0")}>
                          {/* Date positionnée absolument en haut à droite */}
                          <div className="absolute top-0 right-0 flex flex-col items-end gap-1 z-10">
                            {conversation.lastMessage && (
                              <span className={cn("text-muted-foreground timestamp bg-background/80 px-1 rounded", isMobile ? "mobile-text-xs" : "text-xs")}>
                                {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                          
                          {/* Contenu principal prenant toute la largeur */}
                          <div className="w-full pr-16"> {/* pr-16 pour laisser de l'espace à la date */}
                            <h3 className={cn(
                              "font-bold text-foreground text-left leading-tight", 
                              isMobile 
                                ? "mobile-text-base conversation-title-mobile" 
                                : "conversation-title-desktop"
                            )}>
                              {getConversationDisplayName(conversation)}
                            </h3>
                            {conversation.lastMessage && (
                              <p className={cn("text-muted-foreground mt-1", isMobile ? "mobile-text-sm" : "text-sm")} 
                                 style={{
                                   display: '-webkit-box',
                                   WebkitLineClamp: 2,
                                   WebkitBoxOrient: 'vertical',
                                   overflow: 'hidden'
                                 }}>
                                {conversation.lastMessage.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Liste des conversations privées */}
            {activeTab === 'private' && (
              <>
                {getFilteredPrivateConversations().length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {privateSearchFilter ? t('noPrivateConversationsFound') : t('noPrivateConversations')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getFilteredPrivateConversations()
                      .filter(conversation => conversation && conversation.id)
                      .map((conversation) => (
                      <div
                        key={`private-${conversation.id}`}
                        onClick={() => {
                          debugConversationData(conversation);
                          onSelectConversation(conversation);
                        }}
                        className={cn(
                          "flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2 conversation-list-item mobile-compact",
                          selectedConversation?.id === conversation.id
                            ? "bg-primary/20 border-primary/40 shadow-md"
                            : "hover:bg-accent/50 border-transparent hover:border-border/30"
                        )}
                      >
                        <div className="relative">
                          <Avatar className={cn("ring-2 ring-primary/20", isMobile ? "mobile-avatar conversation-list-avatar" : "h-12 w-12 conversation-list-avatar")}>
                            <AvatarImage src={getConversationAvatarUrl(conversation)} />
                            <AvatarFallback className="bg-primary/20 text-primary font-bold flex items-center justify-center text-center">
                              {getConversationIcon(conversation) || getConversationAvatar(conversation)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                        </div>

                        <div className={cn("ml-2 flex-1 relative", isMobile ? "conversation-content-mobile min-w-0" : "min-w-0")}>
                          {/* Date positionnée absolument en haut à droite */}
                          <div className="absolute top-0 right-0 flex flex-col items-end gap-1 z-10">
                            {conversation.lastMessage && (
                              <span className={cn("text-muted-foreground timestamp bg-background/80 px-1 rounded", isMobile ? "mobile-text-xs" : "text-xs")}>
                                {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                          
                          {/* Contenu principal prenant toute la largeur */}
                          <div className="w-full pr-16"> {/* pr-16 pour laisser de l'espace à la date */}
                            <h3 className={cn(
                              "font-bold text-foreground text-left leading-tight", 
                              isMobile 
                                ? "mobile-text-base conversation-title-mobile" 
                                : "conversation-title-desktop"
                            )}>
                              {getConversationDisplayName(conversation)}
                            </h3>
                            {conversation.lastMessage && (
                              <p className={cn("text-muted-foreground mt-1", isMobile ? "mobile-text-sm" : "text-sm")} 
                                 style={{
                                   display: '-webkit-box',
                                   WebkitLineClamp: 2,
                                   WebkitBoxOrient: 'vertical',
                                   overflow: 'hidden'
                                 }}>
                                {conversation.lastMessage.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bouton pour créer une nouvelle conversation après le contenu */}
      {conversations.length > 0 && (
        <div className="flex-shrink-0 p-4">
          <Button
            onClick={onCreateConversation}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            <MessageSquare className="h-5 w-5" />
            {t('createNewConversation')}
          </Button>
        </div>
      )}
    </div>
  );
}