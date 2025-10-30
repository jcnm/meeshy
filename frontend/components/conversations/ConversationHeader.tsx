'use client';

import { useCallback } from 'react';
import { ArrowLeft, UserPlus, Info, MoreVertical, Link2, Video, Ghost, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import type { AnonymousParticipant } from '@shared/types/anonymous';
import { ConversationParticipants } from './conversation-participants';
import { ConversationParticipantsDrawer } from './conversation-participants-drawer';
import { CreateLinkButton } from './create-link-button';
import { UserRoleEnum } from '@shared/types';
import { toast } from 'sonner';

// Helper pour détecter si un utilisateur est anonyme
function isAnonymousUser(user: any): user is AnonymousParticipant {
  return user && ('sessionToken' in user || 'shareLinkId' in user);
}

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
  onStartCall?: () => void;
  t: (key: string) => string;
  showBackButton?: boolean;
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
  onStartCall,
  t,
  showBackButton = false
}: ConversationHeaderProps) {
  // Helper pour obtenir le rôle de l'utilisateur
  const getCurrentUserRole = useCallback((): UserRoleEnum => {
    if (!conversation || !currentUser?.id || !conversationParticipants.length) {
      return currentUser?.role as UserRoleEnum || UserRoleEnum.USER;
    }

    const currentUserParticipant = conversationParticipants.find(p => p.userId === currentUser.id);
    return currentUserParticipant?.role as UserRoleEnum || currentUser?.role as UserRoleEnum || UserRoleEnum.USER;
  }, [conversation, currentUser?.id, currentUser?.role, conversationParticipants]);

  // Obtenir le nom de la conversation
  const getConversationName = useCallback(() => {
    if (conversation.type !== 'direct') {
      return conversation.title || 'Groupe sans nom';
    }

    // Pour les conversations directes, utiliser les participants chargés
    const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
    if (otherParticipant?.user) {
      const name = otherParticipant.user.displayName ||
             `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
             otherParticipant.user.username;

      // Ne pas ajouter d'émoji, l'icône Ghost est affichée séparément
      return name;
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

  // Helper pour vérifier si l'utilisateur peut utiliser les appels vidéo
  const canUseVideoCalls = useCallback((): boolean => {
    const role = currentUser?.role as UserRoleEnum;
    // Seuls les utilisateurs de niveau modérateur et plus peuvent utiliser les appels vidéo
    return [
      UserRoleEnum.BIGBOSS,
      UserRoleEnum.ADMIN,
      UserRoleEnum.MODO,
      UserRoleEnum.MODERATOR, // Alias
      UserRoleEnum.AUDIT,
      UserRoleEnum.ANALYST
    ].includes(role);
  }, [currentUser?.role]);

  // Vérifier si l'autre participant est anonyme
  const isOtherParticipantAnonymous = useCallback(() => {
    if (conversation.type === 'direct') {
      const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
      return otherParticipant?.user ? isAnonymousUser(otherParticipant.user) : false;
    }
    return false;
  }, [conversation, currentUser, conversationParticipants]);

  // Fonction pour copier le lien de la conversation
  const handleShareConversation = useCallback(async () => {
    const url = `${window.location.origin}/conversations/${conversation.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('conversationHeader.linkCopied') || 'Lien copié !');
    } catch (error) {
      console.error('Erreur lors de la copie du lien:', error);
      toast.error(t('conversationHeader.linkCopyError') || 'Erreur lors de la copie du lien');
    }
  }, [conversation.id, t]);

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-card">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Bouton retour (mobile ou desktop avec showBackButton) */}
        {(isMobile || showBackButton) && (
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
          {isOtherParticipantAnonymous() ? (
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Ghost className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarImage src={getConversationAvatarUrl()} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getConversationAvatar()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
        </div>

        {/* Infos de la conversation */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base truncate flex items-center gap-1.5">
            {isOtherParticipantAnonymous() && (
              <Ghost className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            )}
            <span className="truncate">{getConversationName()}</span>
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
        {/* Video Call Button - Only for direct conversations and moderator+ users */}
        {conversation.type === 'direct' && onStartCall && canUseVideoCalls() && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onStartCall}
                  className="h-9 w-9 hover:bg-blue-500 hover:text-white transition-colors"
                  aria-label="Start video call"
                >
                  <Video className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start Video Call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Participants drawer - S'ouvre depuis la gauche */}
        <ConversationParticipantsDrawer
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

        {/* Bouton de création de lien rapide - seulement pour les conversations de groupe et avec les bons rôles */}
        {conversation.type !== 'direct' && 
         !(conversation.type === 'global' && currentUser.role !== 'BIGBOSS' && currentUser.role !== 'ADMIN') && (
          <CreateLinkButton
            conversationId={conversation.id}
            currentUser={currentUser}
            disableSummaryModal={false}
            onLinkCreated={() => {
              onLinkCreated?.('');
            }}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-full hover:bg-accent/50"
          >
            <Link2 className="h-5 w-5" />
          </CreateLinkButton>
        )}

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

            <DropdownMenuItem onClick={handleShareConversation}>
              <Share2 className="h-4 w-4 mr-2" />
              {t('conversationHeader.share') || 'Partager'}
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
