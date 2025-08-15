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
import { SocketIOUser as User, ThreadMember } from '@/shared/types';
// import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';

interface ConversationParticipantsProps {
  conversationId: string;
  participants: ThreadMember[];
  currentUser: User;
  isGroup: boolean;
  className?: string;
  typingUsers?: Array<{ userId: string; conversationId: string }>;
}

export function ConversationParticipants({
  conversationId,
  participants,
  currentUser,
  isGroup,
  className = "",
  typingUsers = []
}: ConversationParticipantsProps) {


  // Les typing users sont désormais passés par props pour éviter des abonnements socket multiples

  // Filtrer les utilisateurs qui tapent dans cette conversation (exclure l'utilisateur actuel)
  const usersTypingInChat = (typingUsers || []).filter((typingUser: { userId: string; conversationId: string }) => 
    typingUser.conversationId === conversationId && 
    typingUser.userId !== currentUser.id
  );



  // Listes en ligne / hors-ligne
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

  // Pour toutes les conversations, afficher la liste des participants
  // (même les conversations privées peuvent avoir des participants)

  return (
    <>
      {/* Affichage compact dans l'en-tête */}
      <div className={`flex items-center gap-2 ${className}`}>


        {/* Quand personne n'écrit, afficher la liste horizontale des en ligne */}
        {usersTypingInChat.length === 0 ? (
          <div className="flex items-center gap-2">
            {onlineAll.length === 0 ? (
              <span className="text-xs text-muted-foreground">Aucun participant en ligne</span>
            ) : (
              <>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {onlineAll.slice(0, 4).map((participant, index) => (
                    <span key={participant.id}>
                      {getDisplayName(participant.user)}
                      {index < Math.min(onlineAll.length, 4) - 1 && ', '}
                    </span>
                  ))}
                  {onlineAll.length > 4 && (
                    <>
                      <span>, </span>
                      <Users className="h-3 w-3 inline" />
                      <span>{onlineAll.length} en ligne</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          // Sinon, afficher l'indicateur de frappe
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{renderTypingMessage()}</span>
          </div>
        )}

        {/* Compteur de personnes en ligne */}
        <span className="text-xs text-muted-foreground">
          {onlineAll.length} en ligne
        </span>
      </div>


    </>
  );
}
