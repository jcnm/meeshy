'use client';

import { useCallback, useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Info, MoreVertical, Link2, Video, Ghost, Share2, Image, Pin, Bell, BellOff, Archive, ArchiveRestore } from 'lucide-react';
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
import { ConversationImageUploadDialog } from './conversation-image-upload-dialog';
import { AttachmentService } from '@/services/attachmentService';
import { conversationsService } from '@/services/conversations.service';
import { userPreferencesService } from '@/services/user-preferences.service';

// Helper pour détecter si un utilisateur est anonyme
function isAnonymousUser(user: any): user is AnonymousParticipant {
  return user && ('sessionToken' in user || 'shareLinkId' in user);
}

// Helper pour calculer le statut de l'utilisateur basé sur la dernière activité
type UserStatus = 'online' | 'away' | 'offline';
function getUserStatus(user: User | null | undefined): UserStatus {
  if (!user) return 'offline';

  // Si l'utilisateur a une propriété isOnline explicite et elle est false, retourner offline
  if (user.isOnline === false) return 'offline';

  // Sinon, calculer basé sur lastActiveAt
  const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
  if (!lastActiveAt) {
    // Si pas de lastActiveAt mais isOnline est true, considérer comme online
    return user.isOnline ? 'online' : 'offline';
  }

  const now = Date.now();
  const lastActive = lastActiveAt.getTime();
  const minutesAgo = (now - lastActive) / (1000 * 60);

  // Vert : actif dans les dernières 5 minutes
  if (minutesAgo < 5) return 'online';

  // Orange : absent depuis 5-30 minutes
  if (minutesAgo < 30) return 'away';

  // Gris : hors ligne depuis plus de 30 minutes
  return 'offline';
}

// Helper pour obtenir la couleur de l'indicateur de statut
function getStatusColor(status: UserStatus): string {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'away':
      return 'bg-orange-500';
    case 'offline':
      return 'bg-gray-400';
  }
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
  onOpenGallery?: () => void;
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
  onOpenGallery,
  t,
  showBackButton = false
}: ConversationHeaderProps) {
  // État pour la gestion de l'upload d'image
  const [isImageUploadDialogOpen, setIsImageUploadDialogOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // État pour les préférences utilisateur
  const [isPinned, setIsPinned] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  // Charger les préférences utilisateur
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoadingPreferences(true);
        const prefs = await userPreferencesService.getPreferences(conversation.id);
        console.log('[ConversationHeader] Loaded preferences:', { conversationId: conversation.id, prefs });
        if (prefs) {
          setIsPinned(prefs.isPinned);
          setIsMuted(prefs.isMuted);
          setIsArchived(prefs.isArchived);
        } else {
          // Réinitialiser à false si pas de préférences
          setIsPinned(false);
          setIsMuted(false);
          setIsArchived(false);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        // En cas d'erreur, réinitialiser
        setIsPinned(false);
        setIsMuted(false);
        setIsArchived(false);
      } finally {
        setIsLoadingPreferences(false);
      }
    };
    loadPreferences();

    // Recharger les préférences toutes les 2 secondes pour refléter les changements
    const intervalId = setInterval(loadPreferences, 2000);

    return () => clearInterval(intervalId);
  }, [conversation.id]);

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
    // Pour les conversations de groupe/public/global, retourner l'image de la conversation
    return conversation.image || conversation.avatar;
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

  // Helper pour vérifier si l'utilisateur peut modifier l'image de la conversation
  const canModifyConversationImage = useCallback((): boolean => {
    // Seulement pour les conversations group, public et global (pas direct)
    if (conversation.type === 'direct') return false;

    const role = getCurrentUserRole();
    // Modérateurs et au-dessus peuvent modifier l'image
    return [
      UserRoleEnum.BIGBOSS,
      UserRoleEnum.ADMIN,
      UserRoleEnum.MODO,
      UserRoleEnum.MODERATOR,
      UserRoleEnum.AUDIT,
      UserRoleEnum.ANALYST,
      UserRoleEnum.CREATOR
    ].includes(role);
  }, [conversation.type, getCurrentUserRole]);

  // Fonction pour gérer l'upload de l'image de conversation
  const handleImageUpload = useCallback(async (file: File) => {
    setIsUploadingImage(true);
    try {
      // Upload du fichier via le service d'attachments
      const uploadResult = await AttachmentService.uploadFiles([file]);

      if (uploadResult.success && uploadResult.attachments.length > 0) {
        const imageUrl = uploadResult.attachments[0].url;

        // Mettre à jour la conversation avec la nouvelle image
        await conversationsService.updateConversation(conversation.id, {
          image: imageUrl,
          avatar: imageUrl
        });

        toast.success(t('conversationHeader.imageUpdated') || 'Image de la conversation mise à jour');
        setIsImageUploadDialogOpen(false);

        // Recharger la page pour afficher la nouvelle image
        window.location.reload();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload de l\'image:', error);
      toast.error(t('conversationHeader.imageUploadError') || 'Erreur lors de l\'upload de l\'image');
    } finally {
      setIsUploadingImage(false);
    }
  }, [conversation.id, t]);

  // Vérifier si l'autre participant est anonyme
  const isOtherParticipantAnonymous = useCallback(() => {
    if (conversation.type === 'direct') {
      const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
      return otherParticipant?.user ? isAnonymousUser(otherParticipant.user) : false;
    }
    return false;
  }, [conversation, currentUser, conversationParticipants]);

  // Obtenir le statut de l'autre participant pour les conversations directes
  const getOtherParticipantStatus = useCallback((): UserStatus => {
    if (conversation.type === 'direct') {
      const otherParticipant = conversationParticipants.find(p => p.userId !== currentUser?.id);
      return getUserStatus(otherParticipant?.user);
    }
    return 'online'; // Pour les conversations de groupe, toujours afficher comme online
  }, [conversation.type, conversationParticipants, currentUser?.id]);

  // Handlers pour les préférences utilisateur
  const handleTogglePin = useCallback(async () => {
    try {
      const newPinnedState = !isPinned;
      setIsPinned(newPinnedState);
      await userPreferencesService.togglePin(conversation.id, newPinnedState);
      toast.success(t(newPinnedState ? 'conversationHeader.pinned' : 'conversationHeader.unpinned'));
    } catch (error) {
      console.error('Error toggling pin:', error);
      setIsPinned(!isPinned); // Revert on error
      toast.error(t('conversationHeader.pinError'));
    }
  }, [conversation.id, isPinned, t]);

  const handleToggleMute = useCallback(async () => {
    try {
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      await userPreferencesService.toggleMute(conversation.id, newMutedState);
      toast.success(t(newMutedState ? 'conversationHeader.muted' : 'conversationHeader.unmuted'));
    } catch (error) {
      console.error('Error toggling mute:', error);
      setIsMuted(!isMuted); // Revert on error
      toast.error(t('conversationHeader.muteError'));
    }
  }, [conversation.id, isMuted, t]);

  const handleToggleArchive = useCallback(async () => {
    try {
      const newArchivedState = !isArchived;
      setIsArchived(newArchivedState);
      await userPreferencesService.toggleArchive(conversation.id, newArchivedState);
      toast.success(t(newArchivedState ? 'conversationHeader.archived' : 'conversationHeader.unarchived'));
    } catch (error) {
      console.error('Error toggling archive:', error);
      setIsArchived(!isArchived); // Revert on error
      toast.error(t('conversationHeader.archiveError'));
    }
  }, [conversation.id, isArchived, t]);

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

        {/* Avatar - Only show for non-direct conversations, clickable for moderators+ */}
        {conversation.type !== 'direct' && (
          <div className="relative flex-shrink-0">
            {canModifyConversationImage() ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="cursor-pointer group relative"
                      onClick={() => setIsImageUploadDialogOpen(true)}
                    >
                      <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
                        <AvatarImage src={getConversationAvatarUrl()} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {getConversationAvatar()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Overlay avec icône camera au survol */}
                      <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Image className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('conversationHeader.changeImage') || 'Changer l\'image'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarImage src={getConversationAvatarUrl()} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getConversationAvatar()}
                </AvatarFallback>
              </Avatar>
            )}
            {/* Status indicator - Only show for direct conversations */}
            {conversation.type !== 'direct' && (
              <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${getStatusColor('online')} rounded-full border-2 border-background`} />
            )}
          </div>
        )}

        {/* Infos de la conversation */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base truncate flex items-center gap-1.5">
            {/* For direct conversations, show interlocutor avatar before name */}
            {conversation.type === 'direct' && (
              <div className="relative flex-shrink-0">
                {isOtherParticipantAnonymous() ? (
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Ghost className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                ) : (
                  <>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getConversationAvatarUrl()} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getConversationAvatar()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Accurate status indicator for direct conversations */}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${getStatusColor(getOtherParticipantStatus())} rounded-full border-2 border-background`} />
                  </>
                )}
              </div>
            )}
            <span className="truncate">{getConversationName()}</span>
          </h2>

          {/* Show participant info and typing only for non-direct conversations */}
          {conversation.type !== 'direct' ? (
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
          ) : (
            /* For direct conversations, show typing indicator with username */
            <div className="text-sm text-muted-foreground">
              {(() => {
                const otherTypingUsers = typingUsers.filter(u => u.userId !== currentUser.id);
                if (otherTypingUsers.length > 0) {
                  const typingUser = otherTypingUsers[0];
                  const typingUserName = typingUser.username || getConversationName();
                  return (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">
                        {typingUserName} {t('conversationParticipants.typing') || 'est en train d\'écrire...'}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
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

        {/* Participants drawer - Only for group conversations */}
        {conversation.type !== 'direct' && (
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
        )}

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

            {onOpenGallery && (
              <DropdownMenuItem onClick={onOpenGallery}>
                <Image className="h-4 w-4 mr-2" />
                {t('conversationHeader.viewImages') || 'Voir les images'}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* User Preferences */}
            <DropdownMenuItem onClick={handleTogglePin} disabled={isLoadingPreferences}>
              <Pin className={cn("h-4 w-4 mr-2", isPinned && "fill-current")} />
              {t(isPinned ? 'conversationHeader.unpin' : 'conversationHeader.pin')}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleToggleMute} disabled={isLoadingPreferences}>
              {isMuted ? (
                <Bell className="h-4 w-4 mr-2" />
              ) : (
                <BellOff className="h-4 w-4 mr-2" />
              )}
              {t(isMuted ? 'conversationHeader.unmute' : 'conversationHeader.mute')}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleToggleArchive} disabled={isLoadingPreferences}>
              {isArchived ? (
                <ArchiveRestore className="h-4 w-4 mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              {t(isArchived ? 'conversationHeader.unarchive' : 'conversationHeader.archive')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

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

      {/* Dialog pour l'upload d'image de conversation */}
      <ConversationImageUploadDialog
        open={isImageUploadDialogOpen}
        onClose={() => setIsImageUploadDialogOpen(false)}
        onImageUploaded={handleImageUpload}
        isUploading={isUploadingImage}
        conversationTitle={conversation.title || conversation.id}
      />
    </div>
  );
}
