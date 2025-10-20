'use client';

import { memo } from 'react';
import Link from 'next/link';
import { 
  Copy,
  AlertTriangle,
  Languages,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  Edit,
  Trash2,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { getLanguageInfo } from '@shared/types';
import type { Message } from '@shared/types/conversation';
import { cn } from '@/lib/utils';
import { MessageWithLinks } from '@/components/chat/message-with-links';
import { MessageAttachments } from '@/components/attachments/MessageAttachments';
import { MessageReactions } from '@/components/common/message-reactions';

interface BubbleMessageViewProps {
  message: Message & {
    originalLanguage: string;
    translations: any[];
    attachments?: any[];
  };
  currentContent: string;
  currentDisplayLanguage: string;
  isOwnMessage: boolean;
  isTranslating?: boolean;
  translationError?: string;
  replyToContent?: string;
  contentRef: React.RefObject<HTMLDivElement>;
  formatReplyDate: (date: Date | string) => string;
  t: (key: string) => string;
  
  // Actions
  onReplyMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
  onImageClick?: (attachmentId: string) => void;
  onLanguageSwitch: (language: string) => void;
  onEnterReactionMode: () => void;
  onEnterLanguageMode: () => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void> | void;
  onDeleteMessage?: (messageId: string) => Promise<void> | void;
  onCopyMessage: () => void;
  onReportMessage: () => void;
  
  // Permissions
  canEdit: boolean;
  canDelete: boolean;
}

export const BubbleMessageView = memo(function BubbleMessageView({
  message,
  currentContent,
  currentDisplayLanguage,
  isOwnMessage,
  isTranslating = false,
  translationError,
  replyToContent,
  contentRef,
  formatReplyDate,
  t,
  onReplyMessage,
  onNavigateToMessage,
  onImageClick,
  onLanguageSwitch,
  onEnterReactionMode,
  onEnterLanguageMode,
  onEditMessage,
  onDeleteMessage,
  onCopyMessage,
  onReportMessage,
  canEdit,
  canDelete
}: BubbleMessageViewProps) {
  
  return (
    <Card 
      className={cn(
        "relative transition-colors duration-200 border shadow-none max-w-full overflow-visible group/message",
        isOwnMessage 
          ? 'bg-gradient-to-br from-blue-400 to-blue-500 border-blue-400 text-white' 
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      )}
    >
      <CardContent className="p-1 sm:p-2 max-w-full overflow-visible">

        {/* Message parent si c'est une réponse */}
        {message.replyTo && (
          <motion.div
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-2"
          >
            <div 
              onClick={() => {
                if (message.replyTo?.id && onNavigateToMessage) {
                  onNavigateToMessage(message.replyTo.id);
                }
              }}
              className={cn(
                "relative overflow-hidden rounded-md border-l-2 px-2 py-1.5 cursor-pointer transition-all duration-200 group text-xs",
                isOwnMessage 
                  ? "bg-white/20 border-white/40 backdrop-blur-sm hover:bg-white/30" 
                  : "bg-gray-50/90 dark:bg-gray-700/40 border-blue-400 dark:border-blue-500 hover:bg-gray-100/90 dark:hover:bg-gray-700/60"
              )}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {(() => {
                      const replyUsername = message.replyTo.anonymousSender?.username || message.replyTo.sender?.username;
                      const replyDisplayName = message.replyTo.anonymousSender 
                        ? (message.replyTo.anonymousSender.username || t('anonymous'))
                        : (message.replyTo.sender?.username || t('unknownUser'));
                      
                      return replyUsername ? (
                        <Link 
                          href={`/u/${replyUsername}`}
                          className={cn(
                            "text-xs font-semibold truncate hover:underline transition-colors cursor-pointer",
                            isOwnMessage ? "text-white/90 hover:text-white" : "text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {replyDisplayName}
                        </Link>
                      ) : (
                        <span className={cn(
                          "text-xs font-semibold truncate",
                          isOwnMessage ? "text-white/90" : "text-gray-700 dark:text-gray-200"
                        )}>
                          {replyDisplayName}
                        </span>
                      );
                    })()}
                    <span className={cn(
                      "text-[10px]",
                      isOwnMessage ? "text-white/60" : "text-gray-500 dark:text-gray-400"
                    )}>
                      {formatReplyDate(message.replyTo.createdAt)}
                    </span>
                  </div>
                  <p className={cn(
                    "text-xs line-clamp-2 leading-snug",
                    isOwnMessage ? "text-white/80" : "text-gray-600 dark:text-gray-300"
                  )}>
                    {replyToContent || message.replyTo.content}
                  </p>
                </div>
                <MessageCircle className={cn(
                  "h-3 w-3 flex-shrink-0 mt-0.5",
                  isOwnMessage ? "text-white/50" : "text-blue-500/50 dark:text-blue-400/50"
                )} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Contenu principal */}
        <div className="mb-2" style={{ position: 'relative', zIndex: 1 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`content-${message.id}-${currentDisplayLanguage}-${currentContent.substring(0, 10)}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              ref={contentRef}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <MessageWithLinks
                content={currentContent}
                className={cn(
                  "leading-relaxed text-sm sm:text-base break-words",
                  isOwnMessage 
                    ? "text-white" 
                    : "text-gray-800 dark:text-gray-100"
                )}
                linkClassName={cn(
                  "relative z-10",
                  isOwnMessage
                    ? "text-white hover:text-white/90 decoration-white/40 hover:decoration-white/70"
                    : "text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 decoration-blue-500/30 hover:decoration-blue-500/60"
                )}
                textClassName="whitespace-pre-wrap"
                enableTracking={true}
                onLinkClick={(url, isTracking) => {
                  console.log(`Link clicked: ${url} (tracking: ${isTracking})`);
                }}
              />

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="max-w-full overflow-hidden">
                  <MessageAttachments
                    attachments={message.attachments as any}
                    onImageClick={onImageClick}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: Language badge + Actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Language Badge + Action Buttons */}
          <div className="flex items-center gap-1.5">
            {translationError && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center",
                    isOwnMessage ? "text-red-200" : "text-red-500"
                  )}>
                    <AlertTriangle className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {translationError}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "cursor-pointer transition-all text-xs border font-medium h-5 sm:h-6",
                    currentDisplayLanguage === (message.originalLanguage || 'fr')
                      ? isOwnMessage 
                        ? "bg-white/20 border-white/40 text-white hover:bg-white/30"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                      : isOwnMessage
                        ? "bg-white/30 border-white/50 text-white hover:bg-white/40"
                        : "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300"
                  )}
                  onClick={() => onLanguageSwitch(message.originalLanguage || 'fr')}
                >
                  <span className="text-sm">{getLanguageInfo(message.originalLanguage || 'fr').flag}</span>
                  <span className="hidden sm:inline ml-1">
                    {getLanguageInfo(message.originalLanguage || 'fr').code.toUpperCase()}
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {currentDisplayLanguage === (message.originalLanguage || 'fr')
                  ? `${t('originalLanguage')}: ${getLanguageInfo(message.originalLanguage || 'fr').name}`
                  : `${t('viewing')}: ${getLanguageInfo(currentDisplayLanguage).name}`
                }
              </TooltipContent>
            </Tooltip>

            {/* Bouton de réponse */}
            {onReplyMessage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReplyMessage(message)}
                    aria-label={t('replyToMessage')}
                    className={cn(
                      "h-7 w-7 p-0 rounded-full transition-colors",
                      isOwnMessage 
                        ? "text-white/70 hover:text-white hover:bg-white/20" 
                        : "text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30"
                    )}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('replyToMessage')}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Bouton traduction */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEnterLanguageMode}
                  className={cn(
                    "relative h-7 w-7 p-0 rounded-full transition-all duration-200",
                    isOwnMessage
                      ? "text-white/70 hover:text-white hover:bg-white/20"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                  )}
                  aria-label={t('translationOptions')}
                >
                  <Languages className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isTranslating && "animate-pulse"
                  )} />
                  
                  {message.translations && message.translations.length > 0 && (
                    <span 
                      className={cn(
                        "absolute -top-0.5 -right-0.5 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold transition-all duration-300 bg-blue-500"
                      )}
                    >
                      {message.translations.length}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('translationOptions')}</p>
              </TooltipContent>
            </Tooltip>

            {/* Bouton réaction - intégré dans MessageReactions */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEnterReactionMode}
                  className={cn(
                    "h-7 w-7 p-0 rounded-full transition-colors",
                    isOwnMessage 
                      ? "text-white/70 hover:text-white hover:bg-white/20" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                  )}
                  aria-label={t('addReaction')}
                >
                  <span className="text-base">😀</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('addReaction')}</p>
              </TooltipContent>
            </Tooltip>

            {/* Menu Plus */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 rounded-full transition-colors",
                        isOwnMessage 
                          ? "text-white/70 hover:text-white hover:bg-white/20" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                      )}
                      aria-label={t('moreOptions')}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('moreOptions')}</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onCopyMessage}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('copyMessage')}
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEditMessage?.(message.id, currentContent)}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t('editMessage')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDeleteMessage?.(message.id)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('deleteMessage')}
                  </DropdownMenuItem>
                )}
                {!isOwnMessage && (
                  <DropdownMenuItem onClick={onReportMessage}>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    {t('reportMessage')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Réactions */}
        {(message as any).reactions && (message as any).reactions.length > 0 && (
          <div className="mt-2">
            <MessageReactions
              reactions={(message as any).reactions}
              isOwnMessage={isOwnMessage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});
