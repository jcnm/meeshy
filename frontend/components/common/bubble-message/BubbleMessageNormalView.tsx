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
  MessageCircle,
  Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useAuth } from '@/hooks/use-auth';
import type { BubbleMessage, MessageTranslation, MessageVersion, MessageSender, AnonymousSender } from './types';
import { MessageActionsBar } from './MessageActionsBar';
import { LanguageSelectionMessageView } from './LanguageSelectionMessageView';

interface BubbleMessageNormalViewProps {
  message: Omit<Message, 'translations'> & {
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
  onEnterReportMode?: () => void;
  
  // Actions originales
  onForceTranslation?: (messageId: string, targetLanguage: string, model?: 'basic' | 'medium' | 'premium') => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void> | void;
  onDeleteMessage?: (messageId: string) => Promise<void> | void;
  onLanguageSwitch?: (messageId: string, language: string) => void;
  onReplyMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
  onImageClick?: (attachmentId: string) => void;
}

export const BubbleMessageNormalView = memo(function BubbleMessageNormalView({
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
  onEnterReportMode,
  onForceTranslation,
  onEditMessage,
  onDeleteMessage,
  onLanguageSwitch,
  onReplyMessage,
  onNavigateToMessage,
  onImageClick
}: BubbleMessageNormalViewProps) {
  const { t: tBubble } = useI18n('bubbleStream');
  const { t: tReport } = useI18n('reportMessage');

  // États locaux (copiés de l'original)
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);
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

  // Obtenir le token d'authentification pour la suppression d'attachments
  const { token } = useAuth();

  // Callback appelé quand un attachment est supprimé
  const handleAttachmentDeleted = useCallback((attachmentId: string) => {
    setDeletedAttachmentIds(prev => [...prev, attachmentId]);
  }, []);

  // Filtrer les attachments pour masquer ceux qui ont été supprimés
  const visibleAttachments = useMemo(() => {
    return message.attachments?.filter(att => !deletedAttachmentIds.includes(att.id)) || [];
  }, [message.attachments, deletedAttachmentIds]);

  // Logique copiée de l'original
  const formatReplyDate = (date: Date | string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - messageDate.getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return tBubble('justNow');
    if (diffMinutes < 60) return tBubble('minutesAgo', { minutes: diffMinutes });
    if (diffHours < 24) return tBubble('hoursAgo', { hours: diffHours });
    if (diffDays < 7) return tBubble('daysAgo', { days: diffDays });
    return messageDate.toLocaleDateString();
  };

  // Contenu traduit (utilise les bons noms de champs du backend)
  const displayContent = useMemo(() => {
    if (currentDisplayLanguage === (message.originalLanguage || 'fr')) {
      return message.originalContent || message.content;
    }

    const translation = message.translations?.find((t: any) =>
      (t.language || t.targetLanguage) === currentDisplayLanguage
    );

    if (translation) {
      return (translation as any).content || (translation as any).translatedContent || message.content;
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
      const content = (translation as MessageTranslation)?.translatedContent;
      return content || message.replyTo.content;
    }
    
    return message.replyTo.content;
  }, [currentDisplayLanguage, message.replyTo?.id, message.replyTo?.originalLanguage, message.replyTo?.content, message.replyTo?.translations]);

  // Handlers (logique copiée et adaptée)
  const handleForceTranslation = (targetLanguage: string, model?: 'basic' | 'medium' | 'premium') => {
    onForceTranslation?.(message.id, targetLanguage, model);
  };

  const handleEditMessage = async () => {
    if (onEnterEditMode) {
      // Nouveau système
      onEnterEditMode();
    } else {
      // Ancien système
      const newContent = prompt(tBubble('editMessagePrompt'), message.content);
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
      const confirmed = confirm(tBubble('deleteMessageConfirm'));
      if (confirmed) {
        await onDeleteMessage?.(message.id);
      }
    }
  };

  const handleReportMessage = () => {
    if (onEnterReportMode) {
      onEnterReportMode();
    }
  };

  const handleReactionClick = () => {
    if (onEnterReactionMode) {
      // Nouveau système - entrer en mode réaction
      onEnterReactionMode();
    }
    // Sinon, le popover normal s'ouvre
  };

  const handleCopyMessage = useCallback(async () => {
    try {
      // Générer l'URL du message selon le contexte actuel
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      
      let messageUrl: string;
      
      if (conversationId) {
        // Si on est déjà dans /chat/, utiliser /chat/, sinon utiliser /conversations/
        if (currentPath.startsWith('/chat/')) {
          messageUrl = `${baseUrl}/chat/${conversationId}#message-${message.id}`;
        } else {
          messageUrl = `${baseUrl}/conversations/${conversationId}#message-${message.id}`;
        }
      } else {
        messageUrl = `${baseUrl}/message/${message.id}`;
      }
      
      // Contenu à copier avec le lien
      const contentToCopy = `${displayContent}\n\n${messageUrl}`;
      
      // Copier dans le presse-papiers
      await navigator.clipboard.writeText(contentToCopy);
      
      // Afficher une notification de succès
      toast.success(tBubble('messageCopied'));
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error(tBubble('copyFailed'));
    }
  }, [displayContent, conversationId, message.id, tBubble]);

  // Copier uniquement le lien du message (pour attachments seuls)
  const handleCopyMessageLink = useCallback(async () => {
    try {
      // Générer l'URL du message selon le contexte actuel
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      
      let messageUrl: string;
      
      if (conversationId) {
        // Si on est déjà dans /chat/, utiliser /chat/, sinon utiliser /conversations/
        if (currentPath.startsWith('/chat/')) {
          messageUrl = `${baseUrl}/chat/${conversationId}#message-${message.id}`;
        } else {
          messageUrl = `${baseUrl}/conversations/${conversationId}#message-${message.id}`;
        }
      } else {
        messageUrl = `${baseUrl}/message/${message.id}`;
      }
      
      // Copier uniquement l'URL dans le presse-papiers
      await navigator.clipboard.writeText(messageUrl);
      
      // Afficher une notification de succès
      toast.success(tBubble('linkCopied') || 'Lien copié !');
    } catch (error) {
      console.error('Failed to copy message link:', error);
      toast.error(tBubble('copyFailed'));
    }
  }, [conversationId, message.id, tBubble]);

  // Logique de permissions (copiée)
  const isOwnMessage = currentUser && (
    message.senderId === currentUser.id || 
    message.anonymousSenderId === currentUser.id
  );
  
  const canModifyMessage = () => {
    // Si le parent a fourni onEnterEditMode, c'est qu'on peut éditer
    if (onEnterEditMode) return true;
    
    // Sinon, fallback sur la logique originale
    if (isOwnMessage) return true;
    if (conversationType === 'group' || conversationType === 'public' || conversationType === 'global') {
      return ['MODERATOR', 'MODO', 'ADMIN', 'CREATOR', 'BIGBOSS'].includes(userRole);
    }
    return false;
  };

  const canDeleteMessage = () => {
    // Si le parent a fourni onEnterDeleteMode, c'est qu'on peut supprimer
    if (onEnterDeleteMode) return true;

    // Sinon, fallback sur la logique originale
    if (['BIGBOSS', 'ADMIN', 'MODERATOR', 'MODO'].includes(userRole)) return true;

    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const twelveHours = 12 * 60 * 60 * 1000;
    
    if (messageAge > twelveHours) return false;
    return canModifyMessage();
  };

  const canReportMessage = () => {
    // On ne peut pas signaler si on est anonyme
    if (isAnonymous) return false;
    // On ne peut pas signaler son propre message
    if (isOwnMessage) return false;
    // On doit avoir onEnterReportMode pour pouvoir signaler
    return !!onEnterReportMode;
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

  // Plus besoin de filtrage depuis la suppression de la recherche dans le popover
  const filteredVersions = availableVersions;
  const filteredMissingLanguages = getMissingLanguages();

  return (
    <TooltipProvider>
      {/* Container with avatar on side */}
      <motion.div
        id={`message-${message.id}`}
        ref={messageRef}
        className={cn(
          "bubble-message flex gap-1 sm:gap-1.5 mb-5 px-2 sm:px-4",
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar on side - cliquable pour voir en grand */}
        <div className="flex-shrink-0 mt-1">
          <Avatar 
            className={cn(
              "h-8 w-8 sm:h-9 sm:w-9",
              (message.sender as MessageSender)?.avatar && "cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            )}
            onClick={(e) => {
              e.stopPropagation();
              const avatarUrl = (message.sender as MessageSender)?.avatar;
              if (avatarUrl) {
                // Ouvrir l'avatar dans une nouvelle fenêtre pour le voir en grand
                window.open(avatarUrl, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            <AvatarImage 
              src={(message.sender as MessageSender)?.avatar} 
              alt={message.sender?.firstName} 
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs sm:text-sm font-semibold">
              {getMessageInitials(message)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Message content wrapper */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header: Nom + Date en horizontal au-dessus */}
          <div className={cn(
            "flex items-center gap-1 mb-0.5 px-1",
            isOwnMessage && "flex-row-reverse"
          )}>
            {(() => {
              const username = message.anonymousSender?.username || message.sender?.username;
              const baseName = message.anonymousSender
                ? (message.anonymousSender.username ||
                   `${message.anonymousSender.firstName || ''} ${message.anonymousSender.lastName || ''}`.trim() ||
                   tBubble('anonymous'))
                : (message.sender?.username || tBubble('anonymous'));

              const isAnonymous = !!message.anonymousSender;

              // Les utilisateurs anonymes ne sont pas cliquables
              if (isAnonymous) {
                return (
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Ghost className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    {baseName}
                  </span>
                );
              }

              return username ? (
                <Link
                  href={`/u/${username}`}
                  className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {baseName}
                </Link>
              ) : (
                <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {baseName}
                </span>
              );
            })()}
            <span className="text-gray-400 dark:text-gray-500">•</span>
            <time className="text-xs text-gray-500 dark:text-gray-400">
              {formatReplyDate(message.createdAt)}
            </time>
          </div>

          {/* Attachments EN PREMIER (hors de la bulle) - Avec réactions si pas de texte */}
          {message.attachments && message.attachments.length > 0 && (
            <>
              {(!message.content || !message.content.trim()) ? (
                // Si attachments seuls : dans le flux avec les réactions
                <>
                  <div className={cn(
                    "mb-2 max-w-[85%] sm:max-w-[75%] md:max-w-[65%]",
                    isOwnMessage ? "ml-auto" : "mr-auto"
                  )}>
                    <MessageAttachments
                      attachments={visibleAttachments}
                      onImageClick={onImageClick}
                      currentUserId={isAnonymous ? currentAnonymousUserId : currentUser?.id}
                      token={token || undefined}
                      onAttachmentDeleted={handleAttachmentDeleted}
                    />
                  </div>

                  {/* Réactions - Dans le flux avec 10% de chevauchement */}
                  <div
                    className={cn(
                      "-mt-[1.5px] z-[9999]",
                      isOwnMessage ? "flex justify-end pr-2" : "flex justify-start pl-2"
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
                </>
              ) : (
                // Si avec texte : pas de wrapper relative (les réactions sont sur la bulle)
                <div className={cn(
                  "mb-2 max-w-[85%] sm:max-w-[75%] md:max-w-[65%]",
                  isOwnMessage ? "ml-auto" : "mr-auto"
                )}>
                  <MessageAttachments
                    attachments={visibleAttachments}
                    onImageClick={onImageClick}
                    currentUserId={isAnonymous ? currentAnonymousUserId : currentUser?.id}
                    token={token || undefined}
                    onAttachmentDeleted={handleAttachmentDeleted}
                  />
                </div>
              )}
            </>
          )}

          {/* Message bubble wrapper with reactions - Seulement si contenu textuel */}
          {message.content && message.content.trim() && (
            <div className="relative group/message">
              <Card
                className={cn(
                  "relative transition-colors duration-200 border shadow-none max-w-[85%] sm:max-w-[75%] md:max-w-[65%] overflow-visible py-0",
                  isOwnMessage
                    ? 'bg-gradient-to-br from-blue-400 to-blue-500 dark:from-gray-700 dark:to-gray-800 border-blue-400 dark:border-gray-600 text-white ml-auto'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mr-auto'
                )}
              >
                <CardContent className="p-1 max-w-full overflow-visible">

                {/* Message parent si c'est une réponse */}
              {message.replyTo && (
                <motion.div
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-1"
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
                            const replyBaseName = message.replyTo.anonymousSender
                              ? (message.replyTo.anonymousSender.username || tBubble('anonymous'))
                              : (message.replyTo.sender?.username || tBubble('unknownUser'));

                            const isReplyAnonymous = !!message.replyTo.anonymousSender;

                            // Les utilisateurs anonymes ne sont pas cliquables
                            if (isReplyAnonymous) {
                              return (
                                <span className={cn(
                                  "text-xs font-semibold truncate flex items-center gap-1",
                                  isOwnMessage ? "text-white/90" : "text-gray-700 dark:text-gray-200"
                                )}>
                                  <Ghost className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                  {replyBaseName}
                                </span>
                              );
                            }

                            return replyUsername ? (
                              <Link
                                href={`/u/${replyUsername}`}
                                className={cn(
                                  "text-xs font-semibold truncate hover:underline transition-colors cursor-pointer",
                                  isOwnMessage ? "text-white/90 hover:text-white" : "text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {replyBaseName}
                              </Link>
                            ) : (
                              <span className={cn(
                                "text-xs font-semibold truncate",
                                isOwnMessage ? "text-white/90" : "text-gray-700 dark:text-gray-200"
                              )}>
                                {replyBaseName}
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
              <div className="mb-0" style={{ position: 'relative', zIndex: 1 }}>
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
                  </motion.div>
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Réactions - Dans le flux avec 10% de chevauchement */}
          <div
            className={cn(
              "-mt-[1.5px] z-[9999]",
              isOwnMessage ? "flex justify-end pr-2" : "flex justify-start pl-2"
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
          )}

          {/* Actions Bar - TOUJOURS afficher */}
          <MessageActionsBar
              message={message}
              isOwnMessage={isOwnMessage}
              canReportMessage={canReportMessage()}
              canEditMessage={canModifyMessage()}
              canDeleteMessage={canDeleteMessage()}
              onReply={onReplyMessage ? () => onReplyMessage(message) : undefined}
              onReaction={handleReactionClick}
              onCopy={handleCopyMessage}
              onReport={canReportMessage() ? handleReportMessage : undefined}
              onEdit={canModifyMessage() ? handleEditMessage : undefined}
              onDelete={canDeleteMessage() ? handleDeleteMessage : undefined}
              t={tBubble}
              tReport={tReport}
              translationError={translationError}
              currentDisplayLanguage={currentDisplayLanguage}
              originalLanguage={message.originalLanguage || 'fr'}
              userLanguage={userLanguage}
              availableVersions={availableVersions}
              onLanguageSwitch={onLanguageSwitch ? (lang: string) => onLanguageSwitch(message.id, lang) : () => {}}
              onEnterLanguageMode={onEnterLanguageMode}
              getLanguageInfo={getLanguageInfo}
            />
        </div>
      </motion.div>
    </TooltipProvider>
  );
});