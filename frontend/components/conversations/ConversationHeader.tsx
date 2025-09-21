'use client';

import { useCallback } from 'react';
import { ArrowLeft, UserPlus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  // Helper pour obtenir le rôle de l'utilisateur dans la conversation actuelle
  const getCurrentUserRole = useCallback((): UserRoleEnum => {
    if (!conversation || !currentUser?.id || !conversationParticipants.length) {
      return currentUser?.role as UserRoleEnum || UserRoleEnum.USER;
    }

    const currentUserParticipant = conversationParticipants.find(p => p.userId === currentUser.id);
    return currentUserParticipant?.conversationRole as UserRoleEnum || currentUser?.role as UserRoleEnum || UserRoleEnum.USER;
  }, [conversation, currentUser?.id, currentUser?.role, conversationParticipants]);

  // Fonction spécifique pour obtenir le nom d'affichage dans l'en-tête (utilise les participants chargés)
  const getConversationHeaderName = useCallback((conversation: Conversation): string => {
    if (conversation.type !== 'direct') {
      return conversation.title || 'Groupe sans nom';
    } else {
      // Pour les conversations directes, utiliser les participants chargés en priorité
      const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
      if (otherParticipant?.user) {
        // Prioriser le displayName, sinon prénom/nom, sinon username
        return otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
      }
      
      return conversation.title || 'Conversation privée';
    }
  }, [currentUser, conversationParticipants]);

  // Fonction pour obtenir l'URL de l'avatar d'une conversation
  const getConversationAvatarUrl = useCallback((conversation: Conversation): string | undefined => {
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct';

    if (isDirectConversation) {
      // Pour les conversations privées, utiliser l'avatar de l'autre participant depuis conversationParticipants
      const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
      if (otherParticipant?.user?.avatar) {
        return otherParticipant.user.avatar;
      }
    }
    // Pour les groupes, on pourrait avoir un avatar de groupe dans le futur
    return undefined;
  }, [currentUser, conversationParticipants]);

  // Fonction utilitaire pour obtenir l'avatar d'une conversation
  const getConversationAvatar = useCallback((conversation: Conversation): string => {
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct';

    if (!isDirectConversation) {
      // Pour les groupes, utiliser le nom ou titre
      const groupName = conversation.title || 'Groupe';
      return groupName.slice(0, 2).toUpperCase();
    } else {
      // Pour les conversations directes, utiliser les participants chargés
      const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
      if (otherParticipant?.user) {
        const displayName = otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
        
        if (displayName) {
          return displayName.slice(0, 2).toUpperCase();
        }
      }
      
      // Fallback : utiliser le titre de la conversation
      const conversationName = conversation.title;
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
          cleanName = parts.find((part: string) => part.trim() !== currentUserName) || parts[0];
        }
        
        // Pour les noms séparés par des virgules, filtrer l'utilisateur actuel
        if (cleanName.includes(', ')) {
          const names = cleanName.split(', ');
          const currentUserName = currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
          
          // Filtrer les noms pour exclure l'utilisateur actuel
          const otherNames = names.filter((name: string) => name.trim() !== currentUserName);
          
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
  }, [currentUser, conversationParticipants]);

  // Fonction utilitaire pour obtenir l'icône d'une conversation par type
  const getConversationIcon = useCallback((conversation: Conversation): React.ReactNode | null => {
    // Pour les conversations de groupe, utiliser des icônes spécifiques
    if (conversation.type === 'group') {
      return <UserPlus className="h-6 w-6" />;
    }
    if (conversation.type === 'broadcast') {
      return <Info className="h-6 w-6" />;
    }
    if (conversation.type !== 'direct') {
      return <UserPlus className="h-6 w-6" />;
    }
    return null; // Pour les conversations privées, on utilisera l'avatar
  }, []);

  return (
    <div className={cn(
      "flex-shrink-0 border-b border-gray-200",
      // En-tête mobile : fixe en haut, pleine largeur, sans marges
      isMobile 
        ? "fixed top-0 left-0 right-0 z-50 p-3 bg-white w-full m-0 px-4 shadow-sm" 
        : "p-4 bg-white/90 backdrop-blur-sm rounded-tr-2xl"
    )}>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={onBackToList}
          className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
          title={t('back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative">
          <Avatar className={cn(
            "ring-2 ring-primary/20",
            // Tailwind responsive uniquement
            isMobile ? "h-10 w-10" : "h-10 w-10"
          )}>
            <AvatarImage src={getConversationAvatarUrl(conversation)} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold flex items-center justify-center">
              {getConversationIcon(conversation) || getConversationAvatar(conversation)}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
        </div>
        
        <div className="flex-1">
          <h2 className={cn(
            "font-bold text-foreground truncate",
            // Tailwind responsive uniquement
            isMobile ? "text-sm max-w-[14ch]" : "text-lg"
          )}>
            {getConversationHeaderName(conversation)}
          </h2>
          <div className={cn(
            "text-muted-foreground",
            // Tailwind responsive uniquement
            isMobile ? "text-xs" : "text-sm"
          )}>
            <ConversationParticipants
              conversationId={conversation.id}
              participants={conversationParticipants}
              currentUser={currentUser}
              isGroup={conversation.type !== 'direct'}
              conversationType={conversation.type}
              typingUsers={typingUsers.map(u => ({ userId: u.userId, conversationId: u.conversationId }))}
              className="mt-1"
            />
          </div>
        </div>
        
        {/* Actions dans la barre de titre */}
        <div className="flex items-center gap-1">
          {/* Bouton pour afficher les participants - maintenant dans la barre de titre */}
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

          {/* Bouton pour ouvrir les détails */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenDetails}
            className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
            title={t('conversationDetails')}
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
