'use client';

import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MeeshyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
}

export function MeeshyLogo({ 
  size = 'md', 
  showText = true, 
  className,
  textClassName,
  iconClassName 
}: MeeshyLogoProps) {
  const sizeConfig = {
    sm: {
      container: 'w-6 h-6',
      icon: 'h-3 w-3',
      text: 'text-sm'
    },
    md: {
      container: 'w-8 h-8',
      icon: 'h-5 w-5',
      text: 'text-lg'
    },
    lg: {
      container: 'w-12 h-12',
      icon: 'h-8 w-8',
      text: 'text-2xl'
    }
  };

  const config = sizeConfig[size];

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <div className={cn(
        'bg-blue-600 rounded-lg flex items-center justify-center',
        config.container,
        iconClassName
      )}>
        <MessageSquare className={cn('text-white', config.icon)} />
      </div>
      {showText && (
        <span className={cn(
          'font-semibold text-blue-600',
          config.text,
          textClassName
        )}>
          Meeshy
        </span>
      )}
    </div>
  );
}
