'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Check, Loader2 } from 'lucide-react';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';
import { PermissionsService } from '@/services/permissions.service';
import { UserRoleEnum } from '@shared/types';
import { useTranslations } from '@/hooks/useTranslations';
import { LinkCopyModal } from './link-copy-modal';

interface CreateLinkButtonProps {
  conversationId: string;
  conversationType?: string;
  userRole?: UserRoleEnum;
  userConversationRole?: UserRoleEnum; // Rôle de l'utilisateur dans cette conversation spécifique
  onLinkCreated?: (link: string) => void;
}

export function CreateLinkButton({
  conversationId,
  conversationType,
  userRole,
  userConversationRole,
  onLinkCreated
}: CreateLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [linkDetails, setLinkDetails] = useState<any>(null);
  const { t } = useTranslations('createLinkButton');

  // Vérifier les permissions pour créer un lien
  const canCreateLink = () => {
    if (conversationType === 'direct') {
      return false;
    }

    // Pour les conversations globales (type "global"), seuls les BIGBOSS peuvent créer des liens
    if (conversationType === 'global') {
      return userRole === UserRoleEnum.BIGBOSS;
    }

    // Vérifier d'abord le rôle global de l'utilisateur
    const hasGlobalPermission = userRole === UserRoleEnum.BIGBOSS || 
                               userRole === UserRoleEnum.CREATOR || 
                               userRole === UserRoleEnum.ADMIN || 
                               userRole === UserRoleEnum.MODERATOR;

    // Vérifier ensuite le rôle de l'utilisateur dans cette conversation spécifique
    const hasConversationPermission = userConversationRole === UserRoleEnum.CREATOR || 
                                     userConversationRole === UserRoleEnum.ADMIN || 
                                     userConversationRole === UserRoleEnum.MODERATOR;

    // L'utilisateur peut créer un lien s'il a soit les permissions globales, soit les permissions dans la conversation
    return hasGlobalPermission || hasConversationPermission;
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Méthode moderne avec navigator.clipboard
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('Modern clipboard API failed:', error);
      }
    }

    // Fallback avec document.execCommand
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        return true;
      } else {
        throw new Error('execCommand copy failed');
      }
    } catch (error) {
      console.error('Fallback copy method failed:', error);
      return false;
    }
  };

  const handleCreateLink = async () => {
    if (!canCreateLink()) {
      if (conversationType === 'global') {
        console.error(t('needBigbossRights'));
      } else {
        console.error(t('noRightsToCreate'));
      }
      return;
    }

    try {
      setIsLoading(true);
      const link = await conversationsService.createInviteLink(conversationId);
      
      // Essayer de copier dans le presse-papiers
      const copySuccess = await copyToClipboard(link);
      
      if (copySuccess) {
        setCopied(true);
        console.log(t('linkCreatedAndCopied'));
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Si la copie échoue, afficher la modale avec le lien
        setGeneratedLink(link);
        setLinkDetails({
          name: t('defaultLinkName'),
          description: t('defaultLinkDescription'),
          allowAnonymousMessages: true,
          allowAnonymousFiles: true,
          allowAnonymousImages: true,
          allowViewHistory: true,
          requireNickname: false,
          requireEmail: false,
          participantCount: 0,
          maxParticipants: 50,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: 'Utilisateur actuel',
          maxUses: undefined, // Illimité par défaut
          permissions: {
            canSendMessages: true,
            canSendFiles: true,
            canSendImages: true,
            canViewHistory: true,
            canInviteOthers: false
          }
        });
        setShowCopyModal(true);
        console.log(t('linkCreated'));
      }
      
      onLinkCreated?.(link);
    } catch (error: any) {
      console.error('Error creating link:', error);
      console.error(error?.message || t('errorCreatingLink'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!canCreateLink()) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCreateLink}
        disabled={isLoading}
        className="rounded-full h-10 w-10 p-0 hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
        title={t('createConversationLink')}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : copied ? (
          <Check className="h-5 w-5 text-green-600" />
        ) : (
          <Link2 className="h-5 w-5" />
        )}
      </Button>

      <LinkCopyModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        linkUrl={generatedLink}
        linkDetails={linkDetails}
      />
    </>
  );
}
