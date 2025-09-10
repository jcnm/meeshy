'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Users,
  Search,
  Crown,
  Loader2,
  UserX,
  UserPlus,
  Link2
} from 'lucide-react';
import { ThreadMember } from '@shared/types';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';
import { useTranslations } from '@/hooks/useTranslations';
import { UserRoleEnum } from '@shared/types';
import { CreateLinkButton } from './create-link-button';
import { InviteUserModal } from './invite-user-modal';
import { getUserInitials } from '@/lib/avatar-utils';

interface ConversationParticipantsPopoverProps {
  conversationId: string;
  participants: ThreadMember[];
  currentUser: any;
  isGroup: boolean;
  conversationType?: string;
  userConversationRole?: UserRoleEnum; // Rôle de l'utilisateur dans cette conversation spécifique
  onParticipantRemoved?: (userId: string) => void;
  onParticipantAdded?: (userId: string) => void;
  onLinkCreated?: (link: string) => void;
}

export function ConversationParticipantsPopover({
  conversationId,
  participants,
  currentUser,
  isGroup,
  conversationType,
  userConversationRole,
  onParticipantRemoved,
  onParticipantAdded,
  onLinkCreated
}: ConversationParticipantsPopoverProps) {
  const { t } = useTranslations('conversationSearch');
  const { t: tUI } = useTranslations('conversationUI');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Vérifier si l'utilisateur actuel est admin
  const currentUserParticipant = participants.find(p => p.userId === currentUser.id);
  const isAdmin = currentUserParticipant?.conversationRole === UserRoleEnum.ADMIN || currentUserParticipant?.conversationRole === UserRoleEnum.CREATOR;

  // Filtrer les participants selon la recherche
  const filteredParticipants = participants.filter(participant => {
    if (!searchQuery.trim()) return true;
    const user = participant.user;
    const searchTerm = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchTerm) ||
      user.displayName?.toLowerCase().includes(searchTerm) ||
      user.firstName?.toLowerCase().includes(searchTerm) ||
      user.lastName?.toLowerCase().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm)
    );
  });

  // Séparer en ligne / hors ligne
  const onlineParticipants = filteredParticipants.filter(p => p.user.isOnline);
  const offlineParticipants = filteredParticipants.filter(p => !p.user.isOnline);

  const getDisplayName = (user: any): string => {
    return user.displayName ||
           `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
           user.username;
  };

  const getAvatarFallback = (user: any): string => {
    return getUserInitials(user);
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!isAdmin) return;

    try {
      setIsLoading(true);
      await conversationsService.removeParticipant(conversationId, userId);
      onParticipantRemoved?.(userId);
      toast.success(tUI('participantRemoved'));
    } catch (error) {
      console.error('Erreur lors de la suppression du participant:', error);
      toast.error(tUI('removeParticipantError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserInvited = (user: any) => {
    onParticipantAdded?.(user);
    toast.success(`${user.displayName || user.username} a été invité à la conversation`);
  };


  return (
    <>
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-10 w-10 p-0 hover:bg-accent/50 relative"
          title={tUI('participants')}
        >
          <Users className="h-5 w-5" />
          {participants.length > 0 && (
            <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
              {participants.length > 99 ? '99+' : participants.length}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 shadow-2xl border border-gray-200 bg-white/95 backdrop-blur-sm"
        side="bottom"
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3">
          {/* Header avec actions */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">{tUI('participants')} ({participants.length})</h4>
            <div className="flex items-center gap-1">
              {/* Bouton de création de lien - seulement pour les conversations de groupe et avec les bons rôles */}
              {conversationType !== 'direct' && 
               !(conversationType === 'global' && currentUser.role !== 'BIGBOSS' && currentUser.role !== 'ADMIN') && (
                <CreateLinkButton
                  forceModal={true}
                  onLinkCreated={(link) => {
                    onLinkCreated?.(link);
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-full hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
                >
                  <Link2 className="h-4 w-4 text-primary" />
                </CreateLinkButton>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={tUI('addParticipant')}
                onClick={() => setShowInviteModal(true)}
                disabled={!isAdmin}
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder={tUI('searchParticipants')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-8 text-xs bg-gray-50/80 border-gray-200/60 focus:bg-white focus:border-blue-300"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-3">
            {/* Section En ligne */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">{tUI('online')}</span>
                <Badge variant="secondary" className="text-[10px]">{onlineParticipants.length}</Badge>
              </div>
              {onlineParticipants.length === 0 ? (
                <div className="text-xs text-gray-400">{tUI('noOneOnline')}</div>
              ) : (
                <div className="space-y-1">
                  {onlineParticipants.map((participant) => {
                    const user = participant.user;
                    const isCurrentUser = user.id === currentUser.id;
                    return (
                      <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-xs bg-primary/20 text-primary">
                              {getAvatarFallback(user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {getDisplayName(user)}{isCurrentUser && ` (${tUI('you')})`}
                            </span>
                            {(participant.role === UserRoleEnum.ADMIN || 
                              (conversationType !== 'direct' && participant.role === UserRoleEnum.CREATOR)) && 
                              <Crown className="h-3 w-3 text-yellow-500" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>@{user.username}</span>
                            <span>•</span>
                            <span className="text-green-600">{tUI('online')}</span>
                          </div>
                        </div>
                        {isAdmin && !isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveParticipant(user.id)}
                            disabled={isLoading}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title={tUI('removeFromGroup')}
                          >
                            <UserX className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section Hors ligne */}
            <div>
              <div className="flex items-center justify-between mt-2 mb-1">
                <span className="text-xs font-semibold text-gray-600">{tUI('offline')}</span>
                <Badge variant="outline" className="text-[10px]">{offlineParticipants.length}</Badge>
              </div>
              {offlineParticipants.length === 0 ? (
                <div className="text-xs text-gray-400">{tUI('noOfflineParticipants')}</div>
              ) : (
                <div className="space-y-1">
                  {offlineParticipants.map((participant) => {
                    const user = participant.user;
                    const isCurrentUser = user.id === currentUser.id;
                    return (
                      <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                              {getAvatarFallback(user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-gray-400 rounded-full border-2 border-background" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {getDisplayName(user)}{isCurrentUser && ` (${tUI('you')})`}
                            </span>
                            {(participant.role === UserRoleEnum.ADMIN || 
                              (conversationType !== 'direct' && participant.role === UserRoleEnum.CREATOR)) && 
                              <Crown className="h-3 w-3 text-yellow-500" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>@{user.username}</span>
                            <span>•</span>
                            <span className="text-muted-foreground">{tUI('offline')}</span>
                          </div>
                        </div>
                        {isAdmin && !isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveParticipant(user.id)}
                            disabled={isLoading}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title={tUI('removeFromGroup')}
                          >
                            <UserX className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>

    {/* Modale d'invitation d'utilisateurs */}
    <InviteUserModal
      isOpen={showInviteModal}
      onClose={() => setShowInviteModal(false)}
      conversationId={conversationId}
      currentParticipants={participants.map(p => p.user)}
      onUserInvited={handleUserInvited}
    />
    </>
  );
}
