'use client';

import { useCallback } from 'react';
import { ArrowLeft, UserPlus, Info, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type {
  Conversation,
  SocketIOUser as User,
  ThreadMember
} from '@shared/types';
import { ConversationParticipants } from './conversation-participants';
import { ConversationParticipantsPopover } from './conversation-participants-popover';
import { UserRoleEnum } from '@shared/types';

interface ConversationHeaderProps {
  conversation: Conversation;
  currentUser: User;
  conversationParticipants: ThreadMember[];
  typingUsers: Array<{ userId: string; username: string; conversationId: string; timestamp: number }>;
  isMobile: boolean;
  onBackToList: () => void;
  onOpenDetails: () => void;
  onParticipantRemoved: (userId: string) => void;
  onParticipantAdded: (userId: string) => void;
  onLinkCreated: (link: any) => void;
  t: (key: string) => string;
}

export function ConversationHeader({
  conversation,
  currentUser,
  conversationParticipants,
  typingUsers,
  isMobile,
  onBackToList,
  onOpenDetails,
  onParticipantRemoved,
  onParticipantAdded,
  onLinkCreated,
  t
}: ConversationHeaderProps) {
  // Helper pour obtenir le rôle de l'utilisateur
  const getCurrentUserRole = useCallback((): UserRoleEnum => {
    if (!conversation || !currentUser?.id || !conversationParticipants.length) {
      return currentUser?.role as UserRoleEnum || UserRoleEnum.USER;
    }

    const currentUserParticipant = conversationParticipants.find(p => p.userId === currentUser.id);
    return currentUserParticipant?.conversationRole as UserRoleEnum || currentUser?.role as UserRoleEnum || UserRoleEnum.USER;
  }, [conversation, currentUser?.id, currentUser?.role, conversationParticipants]);

  // Obtenir le nom de la conversation
  const getConversationName = useCallback(() => {
    if (conversation.type !== 'direct') {
      return conversation.title || 'Groupe sans nom';
    }
    
    // Pour les conversations directes, utiliser les participants chargés
    const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
    if (otherParticipant?.user) {
      return otherParticipant.user.displayName ||
             `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
             otherParticipant.user.username;
    }
    
    // Fallback
    return conversation.title || 'Conversation privée';
  }, [conversation, currentUser, conversationParticipants]);

  // Obtenir l'avatar
  const getConversationAvatar = useCallback(() => {
    const name = getConversationName();
    return name.slice(0, 2).toUpperCase();
  }, [getConversationName]);

  const getConversationAvatarUrl = useCallback(() => {
    if (conversation.type === 'direct') {
      const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
      return otherParticipant?.user?.avatar;
    }
    return undefined;
  }, [conversation, currentUser, conversationParticipants]);

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-card">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Bouton retour (mobile) */}
        {isMobile && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onBackToList}
            className="flex-shrink-0 h-9 w-9"
            aria-label={t('conversationHeader.backToList')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getConversationAvatarUrl()} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getConversationAvatar()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
        </div>

        {/* Infos de la conversation */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base truncate">
            {getConversationName()}
          </h2>
          
          <div className="text-sm text-muted-foreground">
            <ConversationParticipants
              conversationId={conversation.id}
              participants={conversationParticipants}
              currentUser={currentUser}
              isGroup={conversation.type !== 'direct'}
              conversationType={conversation.type}
              typingUsers={typingUsers.map(u => ({ userId: u.userId, conversationId: u.conversationId }))}
              className="truncate"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Participants popover - Toujours visible (Desktop & Mobile) */}
        <ConversationParticipantsPopover
          conversationId={conversation.id}
          participants={conversationParticipants}
          currentUser={currentUser}
          isGroup={conversation.type !== 'direct'}
          conversationType={conversation.type}
          userConversationRole={getCurrentUserRole()}
          onParticipantRemoved={onParticipantRemoved}
          onParticipantAdded={onParticipantAdded}
          onLinkCreated={onLinkCreated}
        />

        {/* Menu dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onOpenDetails}>
              <Info className="h-4 w-4 mr-2" />
              {t('conversationDetails.title')}
            </DropdownMenuItem>
            
            {conversation.type !== 'direct' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('addParticipant')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
