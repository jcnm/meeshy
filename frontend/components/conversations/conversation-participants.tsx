'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Users,
  Crown,
  Loader2,
  Ghost
} from 'lucide-react';
import { SocketIOUser as User, ThreadMember, UserRoleEnum } from '@shared/types';
import type { AnonymousParticipant } from '@shared/types/anonymous';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { getUserInitials } from '@/lib/avatar-utils';
import { cn } from '@/lib/utils';

// Helper pour détecter si un utilisateur est anonyme
function isAnonymousUser(user: any): user is AnonymousParticipant {
  return user && ('sessionToken' in user || 'shareLinkId' in user);
}

interface ConversationParticipantsProps {
  conversationId: string;
  participants: ThreadMember[];
  currentUser: User;
  isGroup: boolean;
  conversationType?: string; // Ajouter le type de conversation
  className?: string;
  typingUsers?: Array<{ userId: string; conversationId: string }>;
}

export function ConversationParticipants({
  conversationId,
  participants,
  currentUser,
  isGroup,
  conversationType = 'group', // Valeur par défaut
  className = "",
  typingUsers = []
}: ConversationParticipantsProps) {
  const { t } = useI18n('conversations');


  // Les typing users sont désormais passés par props pour éviter des abonnements socket multiples

  // Filtrer les utilisateurs qui tapent dans cette conversation (exclure l'utilisateur actuel)
  // NOTE: Ne pas filtrer par conversationId car le backend normalise les IDs (ObjectId → identifier)
  // et le hook useMessaging ne remonte déjà que les événements de la conversation courante
  const usersTypingInChat = (typingUsers || []).filter((typingUser: { userId: string; conversationId: string }) => 
    typingUser.userId !== currentUser.id
  );



  // Listes en ligne / hors-ligne (inclure l'utilisateur actuel)
  const onlineAll = participants.filter(p => p.user.isOnline);
  const offlineAll = participants.filter(p => !p.user.isOnline);
  const recentActiveParticipants = onlineAll.slice(0, 3);



  // Obtenir les noms des utilisateurs qui tapent
  const typingUserNames = usersTypingInChat.map((typingUser: { userId: string; conversationId: string }) => {
    const participant = participants.find(p => p.userId === typingUser.userId);
    return participant?.user.displayName || participant?.user.username || typingUser.userId;
  });

  const renderTypingMessage = () => {
    if (typingUserNames.length === 1) {
      return `${typingUserNames[0]} ${t('conversationParticipants.typing')}`;
    } else if (typingUserNames.length === 2) {
      return `${typingUserNames[0]} et ${typingUserNames[1]} ${t('conversationParticipants.typing')}`;
    } else {
      return `${typingUserNames.length} ${t('conversationParticipants.typingMultiple')}`;
    }
  };

  const getDisplayName = (user: User): string => {
    return user.displayName || 
           `${user.firstName} ${user.lastName}`.trim() || 
           user.username;
  };

  const getAvatarFallback = (user: User): string => {
    return getUserInitials(user);
  };

  const isCreator = (participant: ThreadMember): boolean => {
    return participant.role === UserRoleEnum.CREATOR;
  };

  const shouldShowCrown = (participant: ThreadMember): boolean => {
    return conversationType !== 'direct' && isCreator(participant);
  };

  // Trouver l'utilisateur connecté dans les participants ou l'ajouter
  const currentUserParticipant = participants.find(p => p.userId === currentUser.id);
  const allParticipantsIncludingCurrent = currentUserParticipant
    ? participants
    : [...participants, { userId: currentUser.id, user: currentUser, role: UserRoleEnum.MEMBER } as ThreadMember];

  // Afficher les 3 premiers participants en ligne (incluant l'utilisateur connecté s'il est en ligne)
  // Afficher l'utilisateur courant + 2 autres participants (en ligne ou non)
  let displayParticipants: ThreadMember[] = [];
  if (currentUserParticipant) {
    displayParticipants = [currentUserParticipant];
    // Ajoute 2 autres participants (excluant l'utilisateur courant)
    displayParticipants = displayParticipants.concat(
      allParticipantsIncludingCurrent.filter(p => p.userId !== currentUser.id).slice(0, 2)
    );
  } else {
    // Si l'utilisateur courant n'est pas dans la liste, prendre les 3 premiers
    displayParticipants = allParticipantsIncludingCurrent.slice(0, 3);
  }

  return (
    <>
      {/* Affichage compact dans l'en-tête */}
      <div className={cn("flex items-center gap-2", className)}>
        {/* Avatars des participants en ligne */}
        <div className="flex -space-x-2">
          {displayParticipants.map((participant) => {
            const user = participant.user;
            const isAnonymous = isAnonymousUser(user);
            const isCurrentUser = user.id === currentUser.id;

            const avatarElement = (
              <div key={participant.userId} className="relative group">
                {isAnonymous ? (
                  <div className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border-2 border-background">
                    <Ghost className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                ) : (
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getAvatarFallback(user)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {/* Tooltip au survol */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  <div className="flex items-center gap-1">
                    {isAnonymous && <Ghost className="h-3 w-3" />}
                    {getDisplayName(user)}
                    {isCurrentUser && ` (${t('conversationDetails.you')})`}
                  </div>
                </div>
              </div>
            );

            // Si l'utilisateur n'est pas anonyme et a un username, le rendre cliquable
            if (!isAnonymous && user.username) {
              return (
                <Link key={participant.userId} href={`/u/${user.username}`} onClick={(e) => e.stopPropagation()}>
                  {avatarElement}
                </Link>
              );
            }

            return avatarElement;
          })}
        </div>

        {/* Nombre total de participants si plus de 3 */}
        {allParticipantsIncludingCurrent.length > 3 && (
          <span className="text-xs text-muted-foreground">
            +{allParticipantsIncludingCurrent.length - displayParticipants.length}
          </span>
        )}

        {/* Afficher seulement l'indicateur de frappe quand quelqu'un écrit */}
        {usersTypingInChat.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{renderTypingMessage()}</span>
          </div>
        )}
      </div>
    </>
  );
}
