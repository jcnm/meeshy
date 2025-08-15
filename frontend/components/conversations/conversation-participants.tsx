'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Users, 
  Search, 
  Crown, 
  Shield,
  Loader2,
  MoreHorizontal
} from 'lucide-react';
import { SocketIOUser as User, ThreadMember } from '@/types';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';

interface ConversationParticipantsProps {
  conversationId: string;
  participants: ThreadMember[];
  currentUser: User;
  isGroup: boolean;
  className?: string;
}

export function ConversationParticipants({
  conversationId,
  participants,
  currentUser,
  isGroup,
  className = ""
}: ConversationParticipantsProps) {
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineParticipants, setOnlineParticipants] = useState<User[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Hook pour l'indicateur de frappe
  const { typingUsers } = useTypingIndicator(conversationId, currentUser.id);

  // Filtrer les utilisateurs qui tapent dans cette conversation (exclure l'utilisateur actuel)
  const usersTypingInChat = typingUsers.filter(typingUser => 
    typingUser.conversationId === conversationId && 
    typingUser.userId !== currentUser.id
  );

  // Charger les participants en ligne
  useEffect(() => {
    if (isGroup && isParticipantsDialogOpen) {
      loadOnlineParticipants();
    }
  }, [isGroup, isParticipantsDialogOpen, conversationId]);

  const loadOnlineParticipants = async () => {
    setIsLoadingParticipants(true);
    try {
      const participantsData = await conversationsService.getParticipants(conversationId);
      setOnlineParticipants(participantsData);
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      toast.error('Erreur lors du chargement des participants');
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  // Filtrer les participants selon la recherche
  const filteredParticipants = participants.filter(participant => {
    const user = participant.user;
    const searchLower = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchLower) ||
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  });

  // Obtenir les 3 participants les plus récents qui sont en ligne
  const recentActiveParticipants = participants
    .filter(p => p.user.isOnline && p.userId !== currentUser.id)
    .slice(0, 3);

  // Obtenir les noms des utilisateurs qui tapent
  const typingUserNames = usersTypingInChat.map(typingUser => {
    const participant = participants.find(p => p.userId === typingUser.userId);
    return participant?.user.displayName || participant?.user.username || typingUser.userId;
  });

  const renderTypingMessage = () => {
    if (typingUserNames.length === 1) {
      return `${typingUserNames[0]} écrit...`;
    } else if (typingUserNames.length === 2) {
      return `${typingUserNames[0]} et ${typingUserNames[1]} écrivent...`;
    } else {
      return `${typingUserNames.length} personnes écrivent...`;
    }
  };

  const getDisplayName = (user: User): string => {
    return user.displayName || 
           `${user.firstName} ${user.lastName}`.trim() || 
           user.username;
  };

  const getAvatarFallback = (user: User): string => {
    const displayName = getDisplayName(user);
    return displayName.slice(0, 2).toUpperCase();
  };

  if (!isGroup) {
    // Pour les conversations privées, afficher juste l'indicateur de frappe
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        {usersTypingInChat.length > 0 && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{renderTypingMessage()}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Affichage compact dans l'en-tête */}
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Nombre de participants */}
        <span className="text-sm text-muted-foreground">
          {participants.length} personne{participants.length !== 1 ? 's' : ''}
        </span>

        {/* Participants récents en ligne */}
        {recentActiveParticipants.length > 0 && (
          <div className="flex -space-x-2">
            {recentActiveParticipants.map((participant, index) => (
              <Avatar key={participant.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={participant.user.avatar} />
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {getAvatarFallback(participant.user)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}

        {/* Indicateur de frappe */}
        {usersTypingInChat.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{renderTypingMessage()}</span>
          </div>
        )}

        {/* Bouton pour ouvrir la liste complète */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-accent/50"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm mb-2">Participants</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un participant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-8 text-sm"
                />
              </div>
            </div>
            
            <ScrollArea className="max-h-64">
              <div className="p-2 space-y-2">
                {filteredParticipants.map((participant) => {
                  const user = participant.user;
                  const isTyping = usersTypingInChat.some(t => t.userId === user.id);
                  const isCurrentUser = user.id === currentUser.id;
                  
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">
                            {getAvatarFallback(user)}
                          </AvatarFallback>
                        </Avatar>
                        {user.isOnline && (
                          <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {getDisplayName(user)}
                            {isCurrentUser && ' (Vous)'}
                          </span>
                          {participant.role === 'ADMIN' && (
                            <Crown className="h-3 w-3 text-yellow-500" />
                          )}
                          {isTyping && (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>@{user.username}</span>
                          <span>•</span>
                          <span className={user.isOnline ? 'text-green-600' : 'text-muted-foreground'}>
                            {user.isOnline ? 'En ligne' : 'Hors ligne'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Dialog complet pour la liste des participants */}
      <Dialog open={isParticipantsDialogOpen} onOpenChange={setIsParticipantsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Participants ({participants.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Barre de recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un participant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Liste des participants */}
            <ScrollArea className="max-h-96">
              {isLoadingParticipants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredParticipants.map((participant) => {
                    const user = participant.user;
                    const isTyping = usersTypingInChat.some(t => t.userId === user.id);
                    const isCurrentUser = user.id === currentUser.id;
                    
                    return (
                      <div
                        key={participant.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50"
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {getAvatarFallback(user)}
                            </AvatarFallback>
                          </Avatar>
                          {user.isOnline && (
                            <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {getDisplayName(user)}
                              {isCurrentUser && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Vous
                                </Badge>
                              )}
                            </span>
                            {participant.role === 'ADMIN' && (
                              <Crown className="h-4 w-4 text-yellow-500" />
                            )}
                            {isTyping && (
                              <Badge variant="outline" className="text-xs">
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Écrit
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>@{user.username}</span>
                            <span>•</span>
                            <span className={user.isOnline ? 'text-green-600' : 'text-muted-foreground'}>
                              {user.isOnline ? 'En ligne' : 'Hors ligne'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
