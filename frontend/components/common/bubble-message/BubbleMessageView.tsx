'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  Smile,
  Copy,
  AlertTriangle,
  Timer,
  Languages,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  ArrowUp,
  Search,
  X,
  Ghost,
  Edit,
  Trash2,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { User, BubbleTranslation } from '@shared/types';
import { SUPPORTED_LANGUAGES, getLanguageInfo } from '@shared/types';
import type { Message } from '@shared/types/conversation';
import type { BubbleStreamMessage } from '@/types/bubble-stream';
import { Z_CLASSES } from '@/lib/z-index';
import { useI18n } from '@/hooks/useI18n';
import { getMessageInitials } from '@/lib/avatar-utils';
import { cn } from '@/lib/utils';
import { useFixTranslationPopoverZIndex } from '@/hooks/use-fix-z-index';
import { MessageWithLinks } from '@/components/chat/message-with-links';
import { MessageAttachments } from '@/components/attachments/MessageAttachments';
import { MessageReactions } from '@/components/common/message-reactions';
import { EmojiPicker } from '@/components/common/emoji-picker';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { CLIENT_EVENTS } from '@shared/types/socketio-events';
import { useMessageReactions } from '@/hooks/use-message-reactions';
import type { BubbleMessage, MessageTranslation, MessageVersion, MessageSender, AnonymousSender } from './types';

interface BubbleMessageViewProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    translations: BubbleTranslation[];
    originalContent: string;
    readStatus?: Array<{ userId: string; readAt: Date }>;
    attachments?: any[];
  };
  currentUser?: User; // Rendre optionnel pour éviter les erreurs
  userLanguage: string;
  usedLanguages: string[];
  currentDisplayLanguage: string;
  isTranslating?: boolean;
  translationError?: string;
  conversationType?: 'direct' | 'group' | 'public' | 'global';
  userRole?: 'USER' | 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'CREATOR' | 'AUDIT' | 'ANALYST' | 'BIGBOSS';
  conversationId?: string;
  isAnonymous?: boolean;
  currentAnonymousUserId?: string;
  
  // Actions du nouveau système (optionnelles pour compatibilité)
  onEnterReactionMode?: () => void;
  onEnterLanguageMode?: () => void;
  onEnterEditMode?: () => void;
  onEnterDeleteMode?: () => void;
  
  // Actions originales
  onForceTranslation?: (messageId: string, targetLanguage: string, model?: 'basic' | 'medium' | 'premium') => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void> | void;
  onDeleteMessage?: (messageId: string) => Promise<void> | void;
  onLanguageSwitch?: (messageId: string, language: string) => void;
  onReplyMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
  onImageClick?: (attachmentId: string) => void;
}

export const BubbleMessageView = memo(function BubbleMessageView({
  message,
  currentUser,
  userLanguage,
  usedLanguages = [],
  currentDisplayLanguage,
  isTranslating = false,
  translationError,
  conversationType = 'direct',
  userRole = 'USER',
  conversationId,
  isAnonymous = false,
  currentAnonymousUserId,
  onEnterReactionMode,
  onEnterLanguageMode,
  onEnterEditMode,
  onEnterDeleteMode,
  onForceTranslation,
  onEditMessage,
  onDeleteMessage,
  onLanguageSwitch,
  onReplyMessage,
  onNavigateToMessage,
  onImageClick
}: BubbleMessageViewProps) {
  const { t } = useI18n('bubbleStream');
  
  // États locaux (copiés de l'original)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [translationFilter, setTranslationFilter] = useState('');
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  
  // Hook pour gérer les réactions (comme dans l'original)
  const { addReaction } = useMessageReactions({
    messageId: message.id,
    currentUserId: isAnonymous ? currentAnonymousUserId : (currentUser?.id || ''),
    isAnonymous,
    enabled: !!currentUser || !!currentAnonymousUserId
  });
  
  // Hook pour fixer les z-index des popovers
  useFixTranslationPopoverZIndex();
  
  // Logique copiée de l'original
  const formatReplyDate = (date: Date | string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) return t('justNow');
    if (diffHours < 24) return t('hoursAgo', { hours: Math.floor(diffHours) });
    if (diffHours < 168) return t('daysAgo', { days: Math.floor(diffHours / 24) });
    return messageDate.toLocaleDateString();
  };

  // Contenu traduit (logique copiée)
  const displayContent = useMemo(() => {
    if (currentDisplayLanguage === (message.originalLanguage || 'fr')) {
      return message.originalContent || message.content;
    }
    
    const translation = message.translations?.find((t: any) => 
      (t?.language || t?.targetLanguage) === currentDisplayLanguage
    );
    
    if (translation) {
      return (translation as MessageTranslation)?.content || (translation as MessageTranslation)?.translatedContent || message.content;
    }
    
    return message.content;
  }, [currentDisplayLanguage, message.originalLanguage, message.originalContent, message.content, message.translations]);

  // Contenu de réponse traduit
  const replyToContent = useMemo(() => {
    if (!message.replyTo) return null;
    
    if (currentDisplayLanguage === (message.replyTo.originalLanguage || 'fr')) {
      return message.replyTo.originalContent || message.replyTo.content;
    }
    
    const translation = message.replyTo.translations?.find((t: any) => 
      (t?.language || t?.targetLanguage) === currentDisplayLanguage
    );
    
    if (translation) {
      const content = ((translation as MessageTranslation)?.content || (translation as MessageTranslation)?.translatedContent);
      return content || message.replyTo.content;
    }
    
    return message.replyTo.content;
  }, [currentDisplayLanguage, message.replyTo?.id, message.replyTo?.originalLanguage, message.replyTo?.content, message.replyTo?.translations]);

  // Handlers (logique copiée et adaptée)
  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (!open) {
      setTranslationFilter('');
    }
  };

  const handleLanguageSwitch = (langCode: string) => {
    if (onEnterLanguageMode) {
      // Nouveau système - entrer en mode langue
      onEnterLanguageMode();
    } else {
      // Ancien système - action directe
      handlePopoverOpenChange(false);
      onLanguageSwitch?.(message.id, langCode);
    }
  };

  const handleForceTranslation = (targetLanguage: string) => {
    handlePopoverOpenChange(false);
    onForceTranslation?.(message.id, targetLanguage);
  };

  const handleEditMessage = async () => {
    if (onEnterEditMode) {
      // Nouveau système
      onEnterEditMode();
    } else {
      // Ancien système
      const newContent = prompt(t('editMessagePrompt'), message.content);
      if (newContent && newContent.trim() !== message.content) {
        await onEditMessage?.(message.id, newContent.trim());
      }
    }
  };

  const handleDeleteMessage = async () => {
    if (onEnterDeleteMode) {
      // Nouveau système
      onEnterDeleteMode();
    } else {
      // Ancien système
      const confirmed = confirm(t('deleteMessageConfirm'));
      if (confirmed) {
        await onDeleteMessage?.(message.id);
      }
    }
  };

  const handleReactionClick = () => {
    if (onEnterReactionMode) {
      // Nouveau système - entrer en mode réaction
      onEnterReactionMode();
    }
    // Sinon, le popover normal s'ouvre
  };

  // Logique de permissions (copiée)
  const isOwnMessage = currentUser && (
    message.senderId === currentUser.id || 
    message.anonymousSenderId === currentUser.id
  );
  
  const canModifyMessage = () => {
    if (isOwnMessage) return true;
    if (conversationType === 'group' || conversationType === 'public' || conversationType === 'global') {
      return ['MODERATOR', 'MODO', 'ADMIN', 'CREATOR', 'BIGBOSS'].includes(userRole);
    }
    return false;
  };

  const canDeleteMessage = () => {
    if (['BIGBOSS', 'ADMIN', 'MODERATOR', 'MODO'].includes(userRole)) return true;
    
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const twelveHours = 12 * 60 * 60 * 1000;
    
    if (messageAge > twelveHours) return false;
    return canModifyMessage();
  };

  // Données pour les traductions (copiées)
  const availableVersions = [
    {
      language: message.originalLanguage || 'fr',
      content: message.originalContent || message.content,
      isOriginal: true,
      confidence: 1,
      model: 'original'
    },
    ...message.translations?.map((t: any) => ({
      language: t.language || t.targetLanguage,
      content: t.content || t.translatedContent,
      isOriginal: false,
      confidence: t.confidence || t.confidenceScore || 0.9,
      model: t.model || t.translationModel || 'basic'
    })) || []
  ];

  const getMissingLanguages = () => {
    const translatedLanguages = new Set([
      message.originalLanguage || 'fr',
      ...message.translations?.map((t: any) => t?.language || t?.targetLanguage).filter(Boolean) || []
    ]);
    
    return SUPPORTED_LANGUAGES.filter(lang => !translatedLanguages.has(lang.code));
  };

  const filteredVersions = availableVersions.filter(version => {
    if (!translationFilter.trim()) return true;
    const langInfo = getLanguageInfo((version as MessageVersion).language);
    const searchTerm = translationFilter.toLowerCase();
    return (
      langInfo.name.toLowerCase().includes(searchTerm) ||
      langInfo.code.toLowerCase().includes(searchTerm) ||
      (version as MessageVersion).content.toLowerCase().includes(searchTerm)
    );
  });

  const filteredMissingLanguages = getMissingLanguages().filter(lang => {
    if (!translationFilter.trim()) return true;
    const searchTerm = translationFilter.toLowerCase();
    return (
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <TooltipProvider>
      {/* Container with flex alignment based on sender */}
      <div 
        id={`message-${message.id}`}
        ref={messageRef}
        className={cn(
          "bubble-message flex gap-2 sm:gap-3 mb-8 px-2 sm:px-4",
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar + Nom + Date - Hidden on mobile for own messages */}
        <div className={cn(
          "flex flex-col items-center gap-1 flex-shrink-0",
          isOwnMessage && "hidden sm:flex"
        )}>
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
            <AvatarImage 
              src={(message.sender as MessageSender)?.avatar} 
              alt={message.sender?.firstName} 
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs sm:text-sm font-semibold">
              {getMessageInitials(message)}
            </AvatarFallback>
          </Avatar>
          
          {/* Nom de l'auteur */}
          <div className="flex flex-col items-center gap-0.5 max-w-[60px]">
            {(() => {
              const username = message.anonymousSender?.username || message.sender?.username;
              const displayName = message.anonymousSender 
                ? (message.anonymousSender.username || 
                   `${message.anonymousSender.firstName || ''} ${message.anonymousSender.lastName || ''}`.trim() || 
                   t('anonymous'))
                : (message.sender?.username || t('anonymous'));
              
              return username ? (
                <Link 
                  href={`/u/${username}`}
                  className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-center w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayName}
                </Link>
              ) : (
                <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate text-center w-full">
                  {displayName}
                </span>
              );
            })()}
            <time className="text-[9px] text-gray-500 dark:text-gray-400 text-center">
              {formatReplyDate(message.createdAt)}
            </time>
          </div>
        </div>

        {/* Message bubble wrapper with reactions */}
        <div className="relative flex-1 min-w-0 group/message">
          <Card 
            className={cn(
              "relative transition-colors duration-200 border shadow-none max-w-[85%] sm:max-w-[75%] md:max-w-[65%] overflow-visible group/message",
              isOwnMessage 
                ? 'bg-gradient-to-br from-blue-400 to-blue-500 border-blue-400 text-white ml-auto' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mr-auto'
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
                    key={`content-${message.id}-${currentDisplayLanguage}-${displayContent.substring(0, 10)}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ position: 'relative', zIndex: 1 }}
                  >
                    <MessageWithLinks
                      content={displayContent}
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
                          attachments={message.attachments}
                          onImageClick={onImageClick}
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer: Actions Bar */}
              <div className="flex items-center justify-between gap-2">
                {/* Left: Language Badge + Translation Actions */}
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

                  {/* Language Badge + Translation Popover */}
                  <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
                    <PopoverTrigger asChild>
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
                        onClick={() => onEnterLanguageMode ? handleLanguageSwitch('') : undefined}
                      >
                        <span className="text-sm">{getLanguageInfo(message.originalLanguage || 'fr').flag}</span>
                        <span className="hidden sm:inline ml-1">
                          {getLanguageInfo(message.originalLanguage || 'fr').code.toUpperCase()}
                        </span>
                      </Badge>
                    </PopoverTrigger>
                    
                    {/* Popover de traduction (seulement si ancien système) */}
                    {!onEnterLanguageMode && (
                      <PopoverContent 
                        className={cn("w-96 p-0 overflow-hidden", Z_CLASSES.POPOVER_CONTENT)}
                        side="top"
                        align="start"
                        sideOffset={8}
                        collisionPadding={16}
                      >
                        <div className="flex flex-col max-h-[400px]">
                          {/* Header avec recherche */}
                          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <div className="flex items-center gap-2 mb-2">
                              <Languages className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-sm">{t('selectLanguage')}</span>
                              {isTranslating && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                            </div>
                            
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                              <Input
                                type="text"
                                placeholder={t('searchLanguage')}
                                value={translationFilter}
                                onChange={(e) => setTranslationFilter(e.target.value)}
                                className="pl-7 h-8 text-xs"
                              />
                            </div>
                          </div>

                          {/* Contenu avec scroll */}
                          <div className="flex-1 overflow-y-auto">
                            <Tabs defaultValue="available" className="w-full">
                              <TabsList className="w-full justify-start rounded-none border-b h-9">
                                <TabsTrigger value="available" className="text-xs">
                                  {t('available')} ({filteredVersions.length})
                                </TabsTrigger>
                                <TabsTrigger value="generate" className="text-xs">
                                  {t('generate')} ({filteredMissingLanguages.length})
                                </TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="available" className="mt-0">
                                <div className="p-2 space-y-1">
                                  {filteredVersions.map((version: any, index) => {
                                    const langInfo = getLanguageInfo(version.language);
                                    const isCurrentlyDisplayed = currentDisplayLanguage === version.language;
                                    
                                    return (
                                      <div
                                        key={`${version.language}-${index}`}
                                        onClick={() => handleLanguageSwitch(version.language)}
                                        className={cn(
                                          "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors text-left group",
                                          isCurrentlyDisplayed
                                            ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                                            : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                        )}
                                      >
                                        <span className="text-lg mt-0.5">{langInfo.flag}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm">{langInfo.name}</span>
                                            <Badge variant="outline" className="text-xs h-4 px-1">
                                              {version.language.toUpperCase()}
                                            </Badge>
                                            {version.isOriginal && (
                                              <Badge variant="secondary" className="text-xs h-4 px-1">
                                                {t('original')}
                                              </Badge>
                                            )}
                                            {isCurrentlyDisplayed && (
                                              <CheckCircle2 className="h-3 w-3 text-blue-600" />
                                            )}
                                          </div>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug">
                                            {version.content}
                                          </p>
                                          {!version.isOriginal && (
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[10px] text-gray-500">
                                                {t('modelUsed')}: {version.model}
                                              </span>
                                              <div className="flex items-center text-[10px] text-gray-500">
                                                <span className="mr-1">{t('confidence')}:</span>
                                                <div className="flex">
                                                  {[...Array(5)].map((_, i) => (
                                                    <span key={i} className={cn(
                                                      "text-[8px]",
                                                      i < Math.round(version.confidence * 5) ? "text-yellow-400" : "text-gray-300"
                                                    )}>★</span>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {filteredVersions.length === 0 && (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                      {t('noLanguagesFound')}
                                    </div>
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="generate" className="mt-0">
                                <div className="p-2 space-y-1">
                                  {filteredMissingLanguages.map((lang) => (
                                    <div
                                      key={lang.code}
                                      onClick={() => handleForceTranslation(lang.code)}
                                      className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <span className="text-lg">{lang.flag}</span>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">{lang.name}</span>
                                          <Badge variant="outline" className="text-xs h-4 px-1">
                                            {lang.code.toUpperCase()}
                                          </Badge>
                                        </div>
                                        <span className="text-xs text-gray-500">{t('clickToTranslate')}</span>
                                      </div>
                                      <ArrowUp className="h-3 w-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                    </div>
                                  ))}
                                  
                                  {filteredMissingLanguages.length === 0 && (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                      {t('allLanguagesTranslated')}
                                    </div>
                                  )}
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>

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

                  {/* Bouton réaction */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {onEnterReactionMode ? (
                        // Nouveau système - bouton simple qui ouvre la vue inline
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleReactionClick}
                          className={cn(
                            "h-7 w-7 p-0 rounded-full transition-colors",
                            isOwnMessage 
                              ? "text-white/70 hover:text-white hover:bg-white/20" 
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                          )}
                          aria-label={t('addReaction')}
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        // Ancien système - popover avec EmojiPicker
                        <EmojiPicker
                          onEmojiSelect={addReaction}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-7 w-7 p-0 rounded-full transition-colors",
                                isOwnMessage 
                                  ? "text-white/70 hover:text-white hover:bg-white/20" 
                                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                              )}
                              aria-label={t('addReaction')}
                            >
                              <Smile className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('addReaction')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Right: Options Menu - Appears on hover/touch */}
                {canModifyMessage() && (
                  <div className="opacity-0 group-hover/message:opacity-100 active:opacity-100 transition-opacity duration-200">
                    <DropdownMenu>
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
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={handleEditMessage}>
                          <Edit className="h-4 w-4 mr-2" />
                          <span>{t('edit')}</span>
                        </DropdownMenuItem>
                        {canDeleteMessage() && (
                          <DropdownMenuItem 
                            onClick={handleDeleteMessage}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>{t('delete')}</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message Reactions - Position selon l'expéditeur */}
          <div 
            className={cn(
              "absolute -bottom-3 z-[9999]",
              isOwnMessage ? "right-2" : "left-2"
            )}
            style={{ pointerEvents: 'auto' }}
          >
            <MessageReactions
              messageId={message.id}
              conversationId={conversationId || message.conversationId}
              currentUserId={currentUser?.id || ''}
              currentAnonymousUserId={currentAnonymousUserId}
              isAnonymous={isAnonymous}
              showAddButton={false}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});