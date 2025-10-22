'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Users,
  Search,
  Crown,
  UserX,
  UserPlus,
  X
} from 'lucide-react';
import { ThreadMember } from '@shared/types';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { UserRoleEnum } from '@shared/types';
import { InviteUserModal } from './invite-user-modal';
import { getUserInitials } from '@/lib/avatar-utils';

interface ConversationParticipantsDrawerProps {
  conversationId: string;
  participants: ThreadMember[];
  currentUser: any;
  isGroup: boolean;
  conversationType?: string;
  userConversationRole?: UserRoleEnum;
  onParticipantRemoved?: (userId: string) => void;
  onParticipantAdded?: (userId: string) => void;
  onLinkCreated?: (link: string) => void;
}

export function ConversationParticipantsDrawer({
  conversationId,
  participants,
  currentUser,
  isGroup,
  conversationType,
  userConversationRole,
  onParticipantRemoved,
  onParticipantAdded,
  onLinkCreated
}: ConversationParticipantsDrawerProps) {
  const { t } = useI18n('conversations');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Vérifier si l'utilisateur actuel est admin
  const currentUserParticipant = participants.find(p => p.userId === currentUser.id);
  const isAdmin = currentUserParticipant?.role === UserRoleEnum.ADMIN || currentUserParticipant?.role === UserRoleEnum.CREATOR;

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
      toast.success(t('conversationDetails.participantRemovedSuccess'));
    } catch (error) {
      console.error('Erreur lors de la suppression du participant:', error);
      toast.error(t('conversationDetails.removeParticipantError'));
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
      {/* Bouton trigger */}
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full h-10 w-10 p-0 hover:bg-accent/50 relative"
        title={t('conversationUI.participants')}
        onClick={() => setIsOpen(true)}
      >
        <Users className="h-5 w-5" />
        {participants.length > 0 && (
          <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
            {participants.length > 99 ? '99+' : participants.length}
          </div>
        )}
      </Button>

      {/* Drawer (Sheet) qui s'ouvre depuis la GAUCHE */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="left" 
          className="w-[400px] sm:w-[500px] p-0 bg-card"
        >
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {t('conversationUI.participants')} ({participants.length})
              </SheetTitle>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title={t('conversationUI.addParticipant')}
                  onClick={() => {
                    setIsOpen(false);
                    setShowInviteModal(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="px-6 py-4">
            {/* Barre de recherche */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('conversationDetails.searchParticipants')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-accent/50"
                />
              </div>
            </div>

            {/* Liste scrollable */}
            <ScrollArea className="h-[calc(100vh-240px)]">
              <div className="space-y-6">
                {/* Section En ligne */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {t('conversationUI.online')}
                    </span>
                    <Badge variant="secondary">{onlineParticipants.length}</Badge>
                  </div>
                  
                  {onlineParticipants.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">
                      {t('conversationDetails.noOneOnline')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {onlineParticipants.map((participant) => {
                        const user = participant.user;
                        const isCurrentUser = user.id === currentUser.id;
                        return (
                          <div 
                            key={participant.id} 
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getAvatarFallback(user)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-card" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {getDisplayName(user)}
                                  {isCurrentUser && ` (${t('conversationDetails.you')})`}
                                </span>
                                {(['ADMIN', 'CREATOR'].includes(participant.role)) &&
                                  <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>@{user.username}</span>
                                <span>•</span>
                                <span className="text-green-600">{t('conversationUI.online')}</span>
                              </div>
                            </div>
                            {isAdmin && !isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveParticipant(user.id)}
                                disabled={isLoading}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title={t('conversationDetails.removeFromGroup')}
                              >
                                <UserX className="h-4 w-4" />
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
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {t('conversationDetails.offline')}
                    </span>
                    <Badge variant="outline">{offlineParticipants.length}</Badge>
                  </div>
                  
                  {offlineParticipants.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">
                      {t('conversationDetails.noOfflineParticipants')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {offlineParticipants.map((participant) => {
                        const user = participant.user;
                        const isCurrentUser = user.id === currentUser.id;
                        return (
                          <div 
                            key={participant.id} 
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="bg-muted text-muted-foreground">
                                  {getAvatarFallback(user)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-muted-foreground/50 rounded-full border-2 border-card" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {getDisplayName(user)}
                                  {isCurrentUser && ` (${t('conversationDetails.you')})`}
                                </span>
                                {(['ADMIN', 'CREATOR'].includes(participant.role)) &&
                                  <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>@{user.username}</span>
                                <span>•</span>
                                <span>{t('conversationDetails.offline')}</span>
                              </div>
                            </div>
                            {isAdmin && !isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveParticipant(user.id)}
                                disabled={isLoading}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title={t('conversationDetails.removeFromGroup')}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

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

