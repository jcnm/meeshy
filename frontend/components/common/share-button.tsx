'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Share2, 
  Copy, 
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { shareLink, generateShareLink, ShareLinkOptions } from '@/lib/share-utils';

interface ShareButtonProps {
  options: ShareLinkOptions;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showPreview?: boolean;
}

export function ShareButton({ 
  options, 
  className = "",
  variant = "outline",
  size = "sm",
  showPreview = false
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    try {
      setIsSharing(true);
      
      const url = generateShareLink(options);
      const title = options.customTitle || 'Meeshy - Messagerie Multilingue';
      const description = options.customDescription || 'Rejoignez Meeshy pour des conversations multilingues en temps réel !';
      
      const wasShared = await shareLink(url, title, description);
      
      if (wasShared) {
        toast.success('Lien partagé avec succès !');
      } else {
        setCopied(true);
        toast.success('Lien copié dans le presse-papiers !');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Erreur lors du partage:', error);
      toast.error('Erreur lors du partage du lien');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyOnly = async () => {
    try {
      const url = generateShareLink(options);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Lien copié dans le presse-papiers !');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erreur lors de la copie du lien');
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Button
        onClick={handleShare}
        variant={variant}
        size={size}
        disabled={isSharing}
        className="flex items-center space-x-2"
      >
        {isSharing ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        <span>
          {isSharing ? 'Partage...' : 'Partager'}
        </span>
      </Button>
      
      <Button
        onClick={handleCopyOnly}
        variant="ghost"
        size={size}
        className="flex items-center space-x-2"
      >
        {copied ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span>{copied ? 'Copié' : 'Copier'}</span>
      </Button>
      
      {showPreview && (
        <Button
          onClick={() => window.open(generateShareLink(options), '_blank')}
          variant="ghost"
          size={size}
          className="flex items-center space-x-2"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Voir</span>
        </Button>
      )}
    </div>
  );
}
