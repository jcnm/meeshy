'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Check, Loader2 } from 'lucide-react';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';
import { PermissionsService } from '@/services/permissions.service';
import { UserRoleEnum } from '@shared/types';

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
        toast.error('Need BIGBOSS rights to create share links for global conversations');
      } else {
        toast.error("You don't have rights to create share links for this conversation");
      }
      return;
    }

    try {
      setIsLoading(true);
      const link = await conversationsService.createInviteLink(conversationId);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      onLinkCreated?.(link);
      toast.success("Conversation link created and copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      console.error('Error creating link:', error);
      toast.error(error?.message || 'Error creating link');
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
      title="Create conversation link"
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
