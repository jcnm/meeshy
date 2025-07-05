'use client';

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Languages, 
  RotateCcw, 
  Loader2, 
  AlertTriangle,
  Eye,
  EyeOff 
} from 'lucide-react';
import { TranslatedMessage } from '@/types';
import { formatLanguageName } from '@/utils/language-detection';

interface MessageBubbleProps {
  message: TranslatedMessage;
  isOwn: boolean;
  senderName: string;
  onToggleTranslation: (messageId: string) => void;
  onRetranslate: (messageId: string) => void;
  isTranslationAvailable: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  senderName,
  onToggleTranslation,
  onRetranslate,
  isTranslationAvailable,
}: MessageBubbleProps) {
  const showTranslationControls = !isOwn && isTranslationAvailable;
  const hasTranslation = message.isTranslated && message.translatedContent;
  const hasError = Boolean(message.translationError);
  const isTranslating = Boolean(message.isTranslating);

  // Contenu à afficher
  const displayContent = message.showingOriginal || !hasTranslation 
    ? message.content 
    : message.translatedContent;

  // Informations sur la langue
  const sourceLanguage = message.originalLanguage || 'auto';

  return (
    <TooltipProvider>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
          {/* Avatar pour les messages reçus */}
          {!isOwn && (
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {senderName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground font-medium">
                {senderName}
              </span>
            </div>
          )}

          <div className={`relative group rounded-lg p-3 ${
            isOwn 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          }`}>
            {/* Contenu du message avec tooltip pour l'original */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-pointer">
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {displayContent}
                  </p>
                </div>
              </TooltipTrigger>
              {hasTranslation && !message.showingOriginal && (
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <span>{formatLanguageName(sourceLanguage, 'both')}</span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Indicateurs de statut */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {/* Indicateur de traduction en cours */}
                {isTranslating && (
                  <div className="flex items-center gap-1 text-xs opacity-70">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Traduction...</span>
                  </div>
                )}

                {/* Indicateur d'erreur */}
                {hasError && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Échec</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{message.translationError}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Badge de traduction */}
                {hasTranslation && !isTranslating && (
                  <Badge variant="secondary" className="text-xs">
                    <Languages className="h-3 w-3 mr-1" />
                    {message.showingOriginal ? 'Original' : 'Traduit'}
                  </Badge>
                )}

                {/* Badge de langue */}
                {sourceLanguage && !isOwn && (
                  <Badge variant="outline" className="text-xs">
                    {formatLanguageName(sourceLanguage, 'native')}
                  </Badge>
                )}
              </div>

              {/* Actions de traduction */}
              {showTranslationControls && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Basculer original/traduit */}
                  {hasTranslation && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onToggleTranslation(message.id)}
                          className="h-6 w-6 p-0 hover:bg-background/20"
                        >
                          {message.showingOriginal ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {message.showingOriginal ? 'Voir la traduction' : 'Voir l\'original'}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Traduire/Retraduire */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => hasTranslation ? onRetranslate(message.id) : onToggleTranslation(message.id)}
                        disabled={isTranslating}
                        className="h-6 w-6 p-0 hover:bg-background/20"
                      >
                        {hasTranslation ? (
                          <RotateCcw className="h-3 w-3" />
                        ) : (
                          <Languages className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {hasTranslation ? 'Retraduire' : 'Traduire'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground mt-1 opacity-70">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
