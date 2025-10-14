'use client';

import React, { useMemo, useCallback } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseMessageLinks,
  recordTrackingLinkClick,
  generateDeviceFingerprint,
  type ParsedLink,
} from '@/lib/utils/link-parser';

export interface MessageWithLinksProps {
  content: string;
  className?: string;
  linkClassName?: string;
  textClassName?: string;
  onLinkClick?: (url: string, isTracking: boolean) => void;
  enableTracking?: boolean; // Si true, enregistre les clics sur les liens de tracking
}

/**
 * Composant pour afficher un message avec des liens cliquables et trackables
 */
export function MessageWithLinks({
  content,
  className,
  linkClassName,
  textClassName,
  onLinkClick,
  enableTracking = true,
}: MessageWithLinksProps) {
  // Parser le message pour extraire les liens
  const parsedParts = useMemo(() => {
    return parseMessageLinks(content);
  }, [content]);

  // Gérer le clic sur un lien
  const handleLinkClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>, part: ParsedLink) => {
      const isTracking = part.type === 'tracking-link' || part.type === 'mshy-link';

      // Si c'est un lien de tracking (mshy:// ou meeshy.me/l/<token>) et que le tracking est activé
      if (isTracking && enableTracking && part.token) {
        e.preventDefault();

        try {
          // Enregistrer le clic
          const deviceFingerprint = generateDeviceFingerprint();
          const result = await recordTrackingLinkClick(part.token, {
            referrer: document.referrer,
            deviceFingerprint,
          });

          if (result.success && result.originalUrl) {
            // Ouvrir l'URL originale dans un nouvel onglet
            window.open(result.originalUrl, '_blank', 'noopener,noreferrer');
          } else {
            console.error('Failed to record tracking link click:', result.error);
            // Fallback: ouvrir le lien de tracking directement
            const fallbackUrl = part.type === 'mshy-link' ? part.trackingUrl! : part.content;
            window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
          }
        } catch (error) {
          console.error('Error handling tracking link click:', error);
          // Fallback: ouvrir le lien de tracking directement
          const fallbackUrl = part.type === 'mshy-link' ? part.trackingUrl! : part.content;
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        }
      }

      // Appeler le callback si fourni
      if (onLinkClick) {
        const url =
          part.type === 'tracking-link' || part.type === 'mshy-link' ? part.trackingUrl! : part.originalUrl!;
        onLinkClick(url, isTracking);
      }
    },
    [enableTracking, onLinkClick]
  );

  // Render un part du message
  const renderPart = useCallback(
    (part: ParsedLink, index: number) => {
      if (part.type === 'text') {
        return (
          <span key={index} className={cn('whitespace-pre-wrap', textClassName)}>
            {part.content}
          </span>
        );
      }

      // Gérer les liens mshy:// (créés par le backend)
      if (part.type === 'mshy-link') {
        return (
          <a
            key={index}
            href={part.trackingUrl!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => handleLinkClick(e, part)}
            className={cn(
              'inline-flex items-center gap-1 font-medium underline decoration-2 transition-colors',
              'break-all',
              linkClassName
            )}
            title={`Meeshy tracking link: ${part.trackingUrl}`}
          >
            <span className="inline-flex items-center gap-1">
              <Link2 className="h-3 w-3 flex-shrink-0 inline" />
              <span className="break-all">{part.content}</span>
            </span>
          </a>
        );
      }

      const isTracking = part.type === 'tracking-link';
      const url = isTracking ? part.trackingUrl! : part.originalUrl!;
      const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleLinkClick(e, part)}
          className={cn(
            'inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-500/60 transition-colors',
            'break-all',
            linkClassName
          )}
          title={url}
        >
          <span className="inline-flex items-center gap-1">
            {isTracking ? (
              <Link2 className="h-3 w-3 flex-shrink-0 inline" />
            ) : (
              <ExternalLink className="h-3 w-3 flex-shrink-0 inline" />
            )}
            <span className="break-all">{displayUrl}</span>
          </span>
        </a>
      );
    },
    [handleLinkClick, linkClassName, textClassName]
  );

  return (
    <div className={cn('text-sm', className)}>
      {parsedParts.map((part, index) => renderPart(part, index))}
    </div>
  );
}

/**
 * Hook pour créer automatiquement des liens de tracking lors de l'envoi de messages
 */
export function useAutoTrackingLinks(options: {
  conversationId?: string;
  enabled?: boolean;
}) {
  const { conversationId, enabled = true } = options;

  const processMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!enabled) {
        return message;
      }

      // Parser le message
      const parts = parseMessageLinks(message);
      
      // Pour l'instant, on ne remplace pas automatiquement les liens
      // car cela nécessite une requête API pour chaque lien
      // On peut activer cette fonctionnalité plus tard si nécessaire
      
      return message;
    },
    [enabled, conversationId]
  );

  return { processMessage };
}

/**
 * Composant simple pour afficher un lien de tracking
 */
export function TrackingLink({
  token,
  children,
  className,
  onClickTracked,
}: {
  token: string;
  children?: React.ReactNode;
  className?: string;
  onClickTracked?: () => void;
}) {
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();

      try {
        const deviceFingerprint = generateDeviceFingerprint();
        const result = await recordTrackingLinkClick(token, {
          referrer: document.referrer,
          deviceFingerprint,
        });

        if (result.success && result.originalUrl) {
          window.open(result.originalUrl, '_blank', 'noopener,noreferrer');
          onClickTracked?.();
        } else {
          console.error('Failed to record tracking link click:', result.error);
          window.open(
            `https://meeshy.me/l/${token}`,
            '_blank',
            'noopener,noreferrer'
          );
        }
      } catch (error) {
        console.error('Error handling tracking link click:', error);
        window.open(
          `https://meeshy.me/l/${token}`,
          '_blank',
          'noopener,noreferrer'
        );
      }
    },
    [token, onClickTracked]
  );

  return (
    <a
      href={`https://meeshy.me/l/${token}`}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-500/60 transition-colors',
        className
      )}
    >
      <Link2 className="h-3 w-3 flex-shrink-0" />
      {children || `meeshy.me/l/${token}`}
    </a>
  );
}

