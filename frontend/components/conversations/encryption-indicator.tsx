/**
 * Indicateur visuel du mode de chiffrement d'une conversation
 * Affiche une icône et un tooltip pour indiquer le niveau de sécurité
 */

'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EncryptionMode } from '@/hooks/use-encryption-preferences';

interface EncryptionIndicatorProps {
  mode: EncryptionMode;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const MODE_CONFIG = {
  none: {
    icon: '🔓',
    label: 'Non chiffré',
    description: 'Cette conversation n\'est pas chiffrée',
    color: 'text-gray-500',
  },
  hybrid: {
    icon: '🔐',
    label: 'Chiffrement hybride',
    description: 'Chiffrement E2E + traduction serveur sécurisée',
    color: 'text-blue-600 dark:text-blue-400',
  },
  e2e_only: {
    icon: '🔒',
    label: 'Chiffré E2E',
    description: 'Chiffrement de bout en bout, privacy maximale',
    color: 'text-green-600 dark:text-green-400',
  },
} as const;

const SIZE_CONFIG = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
} as const;

export function EncryptionIndicator({
  mode,
  size = 'md',
  showLabel = false,
  className = '',
}: EncryptionIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const sizeClass = SIZE_CONFIG[size];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-1.5 ${config.color} ${className}`}
            aria-label={config.label}
          >
            <span className={sizeClass} role="img" aria-label={config.label}>
              {config.icon}
            </span>
            {showLabel && (
              <span className="text-xs font-medium hidden sm:inline">{config.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-xs">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
