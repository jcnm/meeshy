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
    // Interdire la création de liens pour les conversations directes
    if (conversationType === 'direct') {
      return false;
    }

    // Pour les conversations globales (type "global"), seuls les BIGBOSS peuvent créer des liens
    if (conversationType === 'global') {
      return userRole === UserRoleEnum.BIGBOSS;
    }

    // Pour tous les autres types de conversations (group, public, etc.),
    // n'importe qui ayant accès à la conversation peut créer des liens
    // L'utilisateur doit juste être membre de la conversation
    return true;
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
      toast.error(getPermissionMessage());
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

  // Ne pas masquer le bouton, mais le désactiver si pas de permissions
  const hasPermission = canCreateLink();

  // Fonction pour obtenir le message d'explication des permissions
  const getPermissionMessage = () => {
    if (conversationType === 'direct') {
      return 'Cannot create links for direct conversations';
    }
    if (conversationType === 'global') {
      return 'Only BIGBOSS users can create links for global conversations';
    }
    return 'You need to be a member of this conversation to create links';
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCreateLink}
        disabled={isLoading || !hasPermission}
        className="rounded-full h-10 w-10 p-0 hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
        title={hasPermission ? t('createConversationLink') : getPermissionMessage()}
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
