/**
 * Composant de liste des conversations avec optimisations responsive
 * Affiche la liste des conversations avec pagination et recherche
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, MoreHorizontal, MessageSquare, Users, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Conversation {
  id: string;
  title: string;
  description?: string;
  type: 'public' | 'private' | 'group';
  memberCount: number;
  lastMessage?: {
    content: string;
    sender: string;
    timestamp: string;
  };
  unreadCount?: number;
  avatar?: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function ConversationList({
  conversations,
  onSelectConversation,
  onCreateConversation,
  isLoading = false,
  className = ''
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'public' | 'private' | 'group'>('all');

  // Filtrer les conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(conversation => {
      const matchesSearch = conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           conversation.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === 'all' || conversation.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [conversations, searchQuery, filterType]);

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'group':
        return <Users className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getConversationTypeColor = (type: string) => {
    switch (type) {
      case 'group':
        return 'bg-blue-100 text-blue-800';
      case 'private':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Barre de recherche et filtres */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            Toutes
          </Button>
          <Button
            variant={filterType === 'public' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('public')}
          >
            Publiques
          </Button>
          <Button
            variant={filterType === 'private' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('private')}
          >
            Privées
          </Button>
          <Button
            variant={filterType === 'group' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('group')}
          >
            Groupes
          </Button>
        </div>
      </div>

      {/* Liste des conversations */}
      <div className="space-y-2">
        {filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune conversation trouvée</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Aucune conversation ne correspond à votre recherche.' : 'Commencez par créer une nouvelle conversation.'}
              </p>
              {onCreateConversation && (
                <Button onClick={onCreateConversation}>
                  Créer une conversation
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredConversations.map((conversation) => (
            <Card 
              key={conversation.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onSelectConversation(conversation.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={conversation.avatar} />
                    <AvatarFallback>
                      {getConversationIcon(conversation.type)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold truncate">{conversation.title}</h3>
                      <div className="flex items-center space-x-2">
                        {conversation.unreadCount && conversation.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getConversationTypeColor(conversation.type)}`}
                        >
                          {conversation.type}
                        </Badge>
                      </div>
                    </div>
                    
                    {conversation.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{conversation.memberCount} membres</span>
                      </div>
                      
                      {conversation.lastMessage && (
                        <div className="text-xs text-muted-foreground">
                          {conversation.lastMessage.timestamp}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Voir les détails</DropdownMenuItem>
                      <DropdownMenuItem>Partager</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Quitter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
