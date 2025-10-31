'use client';

import { memo, useCallback, useState, useMemo } from 'react';
import { Smile, Copy, MessageCircle, Flag, Trash2, MoreVertical, Edit, Languages, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSingleTap } from '@/hooks/use-single-tap';
import type { Message } from '@shared/types/conversation';

interface MessageActionsBarProps {
  message: Message;
  isOwnMessage: boolean;
  canReportMessage: boolean;
  canEditMessage: boolean;
  canDeleteMessage: boolean;
  onReply?: () => void;
  onReaction: () => void;
  onCopy: () => void;
  onReport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
  tReport: (key: string) => string;
  // Props pour les traductions
  translationError?: string;
  currentDisplayLanguage: string;
  originalLanguage: string;
  userLanguage: string;
  availableVersions: Array<{
    language: string;
    content: string;
    isOriginal: boolean;
  }>;
  onLanguageSwitch: (language: string) => void;
  onEnterLanguageMode?: () => void;
  getLanguageInfo: (code: string) => { name: string; flag: string; code: string };
}

export const MessageActionsBar = memo(function MessageActionsBar({
  message,
  isOwnMessage,
  canReportMessage,
  canEditMessage,
  canDeleteMessage,
  onReply,
  onReaction,
  onCopy,
  onReport,
  onEdit,
  onDelete,
  t,
  tReport,
  translationError,
  currentDisplayLanguage,
  originalLanguage,
  userLanguage,
  availableVersions,
  onLanguageSwitch,
  onEnterLanguageMode,
  getLanguageInfo,
}: MessageActionsBarProps) {
  const router = useRouter();
  const [isTranslationMenuOpen, setIsTranslationMenuOpen] = useState(false);

  const handleLanguageSwitch = useCallback((langCode: string) => {
    // Close menu IMMEDIATELY before switching to prevent flickering from re-renders
    setIsTranslationMenuOpen(false);
    // Switch language after menu starts closing
    setTimeout(() => {
      onLanguageSwitch(langCode);
    }, 50);
  }, [onLanguageSwitch]);

  // Composant de traduction (drapeau + menu languages) - Memoïsé pour éviter les re-renders
  const TranslationControls = useMemo(() => ({ showLanguagesMenu = true }: { showLanguagesMenu?: boolean }) => (
    <>
      {/* Erreur de traduction */}
      {translationError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center text-red-500">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{translationError}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Bouton drapeau - Toggle langue originale/utilisateur */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            {...useSingleTap(() => {
              const targetLang = currentDisplayLanguage === originalLanguage
                ? userLanguage
                : originalLanguage;
              onLanguageSwitch(targetLang);
            })}
            className={cn(
              "h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full transition-colors",
              currentDisplayLanguage === originalLanguage
                ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
            )}
            aria-label={currentDisplayLanguage === originalLanguage ? t('showInUserLanguage') : t('showOriginal')}
          >
            <span className="text-sm">{getLanguageInfo(originalLanguage).flag}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{currentDisplayLanguage === originalLanguage ? t('showInUserLanguage') : t('showOriginal')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Menu traductions - Icône Languages - Show only for own messages */}
      {showLanguagesMenu && (
        <DropdownMenu open={isTranslationMenuOpen} onOpenChange={setIsTranslationMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full transition-colors text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30"
                  aria-label={t('selectLanguage')}
                >
                  <Languages className="h-3.5 w-3.5" />
                </Button>

                {/* Badge du nombre de traductions */}
                {message.translations && message.translations.length > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm bg-blue-600 text-white">
                    {message.translations.length}
                  </div>
                )}
              </div>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('selectLanguage')} ({availableVersions.length})</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          align="start"
          side="top"
          sideOffset={8}
          className="w-64 p-0 max-h-[240px] overflow-y-auto"
        >
          <div className="p-2 space-y-1">
            {/* Version originale */}
            <button
              onClick={() => handleLanguageSwitch(originalLanguage)}
              className={cn(
                "w-full flex items-start gap-2 p-2 rounded-md text-left transition-colors",
                currentDisplayLanguage === originalLanguage
                  ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              <span className="text-lg mt-0.5">{getLanguageInfo(originalLanguage).flag}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">{getLanguageInfo(originalLanguage).name}</span>
                  <Badge variant="secondary" className="text-xs h-4 px-1">
                    {t('original')}
                  </Badge>
                  {currentDisplayLanguage === originalLanguage && (
                    <CheckCircle2 className="h-3 w-3 text-blue-600" />
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 leading-snug">
                  {message.originalContent || message.content}
                </p>
              </div>
            </button>

            {/* Traductions disponibles */}
            {availableVersions
              .filter(v => !v.isOriginal)
              .map((version, index) => {
                const langInfo = getLanguageInfo(version.language);
                const isCurrentlyDisplayed = currentDisplayLanguage === version.language;

                return (
                  <button
                    key={`${version.language}-${index}`}
                    onClick={() => handleLanguageSwitch(version.language)}
                    className={cn(
                      "w-full flex items-start gap-2 p-2 rounded-md text-left transition-colors",
                      isCurrentlyDisplayed
                        ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    <span className="text-lg mt-0.5">{langInfo.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm">{langInfo.name}</span>
                        {isCurrentlyDisplayed && (
                          <CheckCircle2 className="h-3 w-3 text-blue-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 leading-snug">
                        {version.content}
                      </p>
                    </div>
                  </button>
                );
              })}

            {/* Séparateur + lien vers vue complète */}
            {onEnterLanguageMode && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={() => {
                    setIsTranslationMenuOpen(false);
                    onEnterLanguageMode();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded-md text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>{t('moreTranslationOptions')}</span>
                </button>
              </>
            )}
          </div>
        </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  ), [
    translationError,
    currentDisplayLanguage,
    originalLanguage,
    userLanguage,
    t,
    getLanguageInfo,
    message.translations,
    message.originalContent,
    message.content,
    availableVersions,
    handleLanguageSwitch,
    isTranslationMenuOpen,
    onEnterLanguageMode
  ]);

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-1.5 px-1 mt-2',
          isOwnMessage ? 'justify-end' : 'justify-start'
        )}
      >
        {/* Translation Controls - Always show flag first, then Languages menu inline for ALL messages */}
        <TranslationControls showLanguagesMenu={true} />

        {/* Bouton de réponse */}
        {onReply && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                {...useSingleTap(onReply)}
                aria-label={t('replyToMessage')}
                className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full transition-colors text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('replyToMessage')}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Bouton réaction */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              {...useSingleTap(onReaction)}
              className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
              aria-label={t('addReaction')}
            >
              <Smile className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('addReaction')}</p>
          </TooltipContent>
        </Tooltip>

        {/* Menu trois points - Toujours visible */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                  aria-label={t('messageActions.more') || 'Plus d\'options'}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('messageActions.more') || 'Plus d\'options'}</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent align={isOwnMessage ? 'end' : 'start'} className="w-48">
            {/* Copy option - Always visible */}
            <DropdownMenuItem
              onClick={onCopy}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Copy className="h-4 w-4" />
              <span>
                {message.content && message.content.trim()
                  ? t('copyMessage')
                  : t('copyLink') || 'Copier le lien'}
              </span>
            </DropdownMenuItem>

            {/* Separator before Edit/Delete if they exist */}
            {(canEditMessage || canDeleteMessage) && <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />}

            {canEditMessage && onEdit && (
              <DropdownMenuItem
                onClick={onEdit}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Edit className="h-4 w-4" />
                <span>{t('edit')}</span>
              </DropdownMenuItem>
            )}
            {canDeleteMessage && onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/30"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('delete')}</span>
              </DropdownMenuItem>
            )}

            {/* Report option */}
            {canReportMessage && onReport && (
              <>
                {(canEditMessage || canDeleteMessage) && <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />}
                <DropdownMenuItem
                  onClick={onReport}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Flag className="h-4 w-4" />
                  <span>{tReport('reportMessage')}</span>
                </DropdownMenuItem>
              </>
            )}

            {/* Separator before Help */}
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

            {/* Need Help option - Always visible */}
            <DropdownMenuItem
              onClick={() => router.push('/contact')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Besoin d'aide</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
});
