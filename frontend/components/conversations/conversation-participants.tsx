'use client';

import { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { SocketIOUser as User, ThreadMember, UserRoleEnum } from '@shared/types';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { getUserInitials } from '@/lib/avatar-utils';

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

  // Pour toutes les conversations, afficher la liste des participants
  // (même les conversations privées peuvent avoir des participants)

  return (
    <>
      {/* Affichage compact dans l'en-tête */}
      <div className={`flex items-center gap-2 ${className}`}>


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
