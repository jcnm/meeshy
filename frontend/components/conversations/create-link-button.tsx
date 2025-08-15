'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Check, Loader2 } from 'lucide-react';
import { conversationsService } from '@/services/conversations.service';
import { toast } from 'sonner';

interface CreateLinkButtonProps {
  conversationId: string;
  conversationType?: string;
  onLinkCreated?: (link: string) => void;
}

export function CreateLinkButton({
  conversationId,
  conversationType,
  onLinkCreated
}: CreateLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreateLink = async () => {
    try {
      setIsLoading(true);
      const link = await conversationsService.createInviteLink(conversationId);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      onLinkCreated?.(link);
      toast.success('Lien de conversation créé et copié');
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      console.error('Erreur lors de la création du lien:', error);
      toast.error(error?.message || 'Erreur lors de la création du lien');
    } finally {
      setIsLoading(false);
    }
  };

  if (conversationType === 'direct') {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCreateLink}
      disabled={isLoading}
      className="rounded-full h-10 w-10 p-0 hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
      title="Créer un lien de conversation"
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
