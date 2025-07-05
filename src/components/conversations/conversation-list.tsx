'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageSquare,
  Users,
  UserPlus,
  Settings,
  X,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User, Conversation } from '@/types';
import { CreateConversationModal } from '@/components/create-conversation-modal';
import { CreateGroupModal } from '@/components/create-group-modal';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  expandedGroupId: string | null;
  groupConversations: Record<string, Conversation[]>;
  unreadCounts: Record<string, number>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onConversationClick: (conversation: Conversation) => void;
  onOpenConversation: (conversationId: string) => void;
  currentUser: User;
}

export function ConversationList({
  conversations,
  selectedConversation,
  expandedGroupId,
  groupConversations,
  unreadCounts,
  searchQuery,
  onSearchChange,
  onConversationClick,
  onOpenConversation,
  currentUser
}: ConversationListProps) {
  const [isCreateConversationOpen, setIsCreateConversationOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Filtrer les conversations selon la recherche
  const filteredConversations = conversations.filter(conversation =>
    conversation.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.participants?.some(p => 
      p.user?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="h-full flex flex-col">
      {/* Barre de recherche */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Rechercher une conversation..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Actions rapides */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex space-x-2">
          <Button 
            onClick={() => setIsCreateConversationOpen(true)}
            size="sm"
            className="flex-1"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Nouvelle conversation
          </Button>
          <Button 
            onClick={() => setIsCreateGroupOpen(true)}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-2" />
            Nouveau groupe
          </Button>
        </div>
      </div>

      {/* Liste des conversations */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucune conversation</p>
              <p className="text-sm">Créez votre première conversation !</p>
            </div>
          ) : (
            filteredConversations.map(conversation => (
              <Card
                key={conversation.id}
                className={cn(
                  "mb-2 cursor-pointer transition-colors hover:bg-gray-50 w-full",
                  selectedConversation?.id === conversation.id && "bg-blue-50 border-blue-200",
                  expandedGroupId === conversation.groupId && conversation.type === 'group' && "ring-2 ring-blue-300"
                )}
                onClick={() => onConversationClick(conversation)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={conversation.participants?.[0]?.user?.avatar} />
                          <AvatarFallback>
                            {conversation.title?.[0] || conversation.participants?.[0]?.user?.username[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Indicateur de groupe */}
                        {conversation.type === 'group' && (
                          <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                            <Users className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Info conversation */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {conversation.title || 
                           conversation.participants?.map(p => p.user?.displayName || p.user?.username).join(', ')}
                        </p>
                        {conversation.lastMessage && (
                          <p className="text-xs text-gray-500 truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Badges */}
                    <div className="flex flex-col items-end space-y-1">
                      {unreadCounts[conversation.id] > 0 && (
                        <Badge variant="destructive" className="h-5 w-5 p-0 text-xs flex items-center justify-center">
                          {unreadCounts[conversation.id]}
                        </Badge>
                      )}
                      {conversation.lastMessage && (
                        <span className="text-xs text-gray-400">
                          {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
                
                {/* Contenu étendu pour les groupes */}
                {conversation.type === 'group' && expandedGroupId === conversation.groupId && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    {/* Boutons de gestion du groupe */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button size="sm" variant="outline" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Nouvelle conversation
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        <UserPlus className="h-3 w-3 mr-1" />
                        Ajouter membre
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        <Settings className="h-3 w-3 mr-1" />
                        Gérer groupe
                      </Button>
                      <Button size="sm" variant="destructive" className="text-xs">
                        <X className="h-3 w-3 mr-1" />
                        Quitter
                      </Button>
                    </div>
                    
                    {/* Liste des conversations du groupe */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">
                        Conversations du groupe
                      </div>
                      {conversation.groupId && groupConversations[conversation.groupId] ? (
                        <div className="space-y-1">
                          {groupConversations[conversation.groupId].map((groupConv) => (
                            <div
                              key={groupConv.id}
                              className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 cursor-pointer text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenConversation(groupConv.id);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 text-gray-400" />
                              <span className="flex-1 truncate">
                                {groupConv.title || 'Conversation sans titre'}
                              </span>
                              {unreadCounts[groupConv.id] > 0 && (
                                <Badge variant="destructive" className="h-4 w-4 p-0 text-xs">
                                  {unreadCounts[groupConv.id]}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : conversation.groupId ? (
                        <div className="text-sm text-gray-500 italic">
                          Chargement des conversations...
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {conversation.participants?.length || 0} membres
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateConversationModal
        isOpen={isCreateConversationOpen}
        onClose={() => setIsCreateConversationOpen(false)}
        onConversationCreated={(conversationId) => {
          setIsCreateConversationOpen(false);
          onOpenConversation(conversationId);
        }}
        currentUser={currentUser}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={() => {
          setIsCreateGroupOpen(false);
        }}
        currentUser={currentUser}
      />
    </div>
  );
}
