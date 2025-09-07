'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Check, Loader2 } from 'lucide-react';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';
import { PermissionsService } from '@/services/permissions.service';
import { UserRoleEnum } from '@shared/types';
import { useTranslations } from '@/hooks/useTranslations';

interface CreateLinkButtonProps {
  conversationId: string;
  conversationType?: string;
  userRole?: UserRoleEnum;
  onLinkCreated?: (link: string) => void;
}

export function CreateLinkButton({
  conversationId,
  conversationType,
  userRole,
  onLinkCreated
}: CreateLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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

    // Pour les autres conversations, BIGBOSS, CREATOR ou ADMIN peuvent créer des liens
    return userRole === UserRoleEnum.BIGBOSS || 
           userRole === UserRoleEnum.CREATOR || 
           userRole === UserRoleEnum.ADMIN || 
           userRole === UserRoleEnum.MODERATOR;
  };

  const handleCreateLink = async () => {
    if (!canCreateLink()) {
      if (conversationType === 'global') {
        toast.error(t('needBigbossRights'));
      } else {
        toast.error(t('noRightsToCreate'));
      }
      return;
    }

    try {
      setIsLoading(true);
      const link = await conversationsService.createInviteLink(conversationId);
      
      // Essayer de copier dans le presse-papiers avec gestion d'erreur
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success(t('linkCreatedAndCopied'));
        setTimeout(() => setCopied(false), 2000);
      } catch (clipboardError: any) {
        console.warn('Clipboard access denied or not available:', clipboardError);
        // Fallback: afficher le lien dans un toast ou modal
        toast.success(t('linkCreated'), {
          description: link,
          duration: 10000,
          action: {
            label: t('copyManually'),
            onClick: () => {
              // Essayer une méthode alternative de copie
              const textArea = document.createElement('textarea');
              textArea.value = link;
              document.body.appendChild(textArea);
              textArea.select();
              try {
                document.execCommand('copy');
                toast.success(t('copiedToClipboard'));
              } catch (fallbackError) {
                console.error('Fallback copy failed:', fallbackError);
                toast.error(t('copyFailed'));
              }
              document.body.removeChild(textArea);
            }
          }
        });
      }
      
      onLinkCreated?.(link);
    } catch (error: any) {
      console.error('Error creating link:', error);
      toast.error(error?.message || t('errorCreatingLink'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!canCreateLink()) {
    return null;
  }

  return (
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
  );
}
