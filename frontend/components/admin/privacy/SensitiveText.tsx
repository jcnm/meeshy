'use client';

import React from 'react';
import { usePrivacyMode } from '@/hooks/use-privacy-mode';
import { cn } from '@/lib/utils';

interface SensitiveTextProps {
  children: React.ReactNode;
  className?: string;
  blurAmount?: 'sm' | 'md' | 'lg';
  fallback?: string;
}

/**
 * Composant pour masquer automatiquement les données sensibles
 * Affiche un blur ou un texte de remplacement selon le mode privacy
 */
export const SensitiveText: React.FC<SensitiveTextProps> = ({
  children,
  className,
  blurAmount = 'md',
  fallback = '••••••••',
}) => {
  const { isPrivacyMode } = usePrivacyMode();

  const blurClasses = {
    sm: 'blur-[3px]',
    md: 'blur-[5px]',
    lg: 'blur-[8px]',
  };

  if (isPrivacyMode) {
    return (
      <span className={cn('select-none', className)}>
        <span className={blurClasses[blurAmount]}>{children}</span>
      </span>
    );
  }

  return <span className={className}>{children}</span>;
};

/**
 * Variante qui remplace complètement le texte au lieu de le flouter
 */
export const SensitiveTextReplace: React.FC<SensitiveTextProps> = ({
  children,
  className,
  fallback = '••••••••',
}) => {
  const { isPrivacyMode } = usePrivacyMode();

  if (isPrivacyMode) {
    return <span className={cn('select-none', className)}>{fallback}</span>;
  }

  return <span className={className}>{children}</span>;
};
