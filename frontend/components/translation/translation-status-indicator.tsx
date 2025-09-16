'use client';

import { useState, useEffect } from 'react';
import { Loader2, Languages, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TranslationStatus = 'idle' | 'pending' | 'translating' | 'completed' | 'error' | 'cached';

interface TranslationStatusIndicatorProps {
  status: TranslationStatus;
  sourceLanguage?: string;
  targetLanguage?: string;
  translationTime?: number;
  confidence?: number;
  error?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onRetry?: () => void;
}

export function TranslationStatusIndicator({
  status,
  sourceLanguage,
  targetLanguage,
  translationTime,
  confidence,
  error,
  className,
  size = 'md',
  showDetails = false,
  onRetry
}: TranslationStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          color: 'text-amber-500',
          bgColor: 'bg-amber-50',
          label: 'En attente de traduction',
          description: 'Traduction mise en file d\'attente'
        };
      case 'translating':
        return {
          icon: Loader2,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          label: 'Traduction en cours',
          description: 'Traduction par l\'IA en cours...',
          animate: true
        };
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          label: 'Traduction terminée',
          description: `Traduit ${sourceLanguage ? `de ${sourceLanguage.toUpperCase()}` : ''} ${targetLanguage ? `vers ${targetLanguage.toUpperCase()}` : ''}`
        };
      case 'cached':
        return {
          icon: Languages,
          color: 'text-purple-500',
          bgColor: 'bg-purple-50',
          label: 'Traduction en cache',
          description: 'Traduction récupérée depuis le cache'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          label: 'Erreur de traduction',
          description: error || 'Erreur lors de la traduction'
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();

  if (!config || status === 'idle') {
    return null;
  }

  const Icon = config.icon;

  return (
    <div 
      className={cn(
        'relative inline-flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-200',
        config.bgColor,
        className
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Icon 
        className={cn(
          sizeClasses[size],
          config.color,
          config.animate && 'animate-spin'
        )}
      />
      
      {showDetails && (
        <div className="flex flex-col text-xs">
          <span className={cn('font-medium', config.color)}>
            {config.label}
          </span>
          {(translationTime || confidence) && (
            <div className="flex gap-2 text-gray-500">
              {translationTime && (
                <span>{translationTime}ms</span>
              )}
              {confidence && (
                <span>{Math.round(confidence * 100)}%</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tooltip détaillé */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
            <div className="font-medium">{config.label}</div>
            <div className="text-gray-300">{config.description}</div>
            
            {status === 'completed' && (
              <div className="mt-1 space-y-1">
                {translationTime && (
                  <div className="flex justify-between">
                    <span>Temps:</span>
                    <span>{translationTime}ms</span>
                  </div>
                )}
                {confidence && (
                  <div className="flex justify-between">
                    <span>Confiance:</span>
                    <span>{Math.round(confidence * 100)}%</span>
                  </div>
                )}
              </div>
            )}
            
            {status === 'error' && onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 text-blue-300 hover:text-blue-200 underline text-xs"
              >
                Réessayer
              </button>
            )}
            
            {/* Triangle de tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Hook pour gérer l'état des traductions */
export function useTranslationStatus(messageId: string) {
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [translationTime, setTranslationTime] = useState<number>();
  const [confidence, setConfidence] = useState<number>();
  const [error, setError] = useState<string>();

  const startTranslation = () => {
    setStatus('pending');
    setError(undefined);
  };

  const setTranslating = () => {
    setStatus('translating');
  };

  const setCompleted = (time?: number, conf?: number, fromCache = false) => {
    setStatus(fromCache ? 'cached' : 'completed');
    setTranslationTime(time);
    setConfidence(conf);
    setError(undefined);
  };

  const setErrorStatus = (errorMessage: string) => {
    setStatus('error');
    setError(errorMessage);
  };

  const reset = () => {
    setStatus('idle');
    setTranslationTime(undefined);
    setConfidence(undefined);
    setError(undefined);
  };

  return {
    status,
    translationTime,
    confidence,
    error,
    startTranslation,
    setTranslating,
    setCompleted,
    setErrorStatus,
    reset
  };
}