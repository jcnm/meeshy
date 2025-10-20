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


interface BubbleMessageProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    translations: BubbleTranslation[];
    originalContent: string;
    readStatus?: Array<{ userId: string; readAt: Date }>;
    attachments?: any[]; // Attachments du message
  };
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
  // Props pour les actions (remontées au parent)
  onForceTranslation?: (messageId: string, targetLanguage: string, model?: 'basic' | 'medium' | 'premium') => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void> | void;
  onDeleteMessage?: (messageId: string) => Promise<void> | void;
  onLanguageSwitch?: (messageId: string, language: string) => void;
  onReplyMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
  onImageClick?: (attachmentId: string) => void; // Nouveau: click sur image
  // États contrôlés depuis le parent
  currentDisplayLanguage: string;
  isTranslating?: boolean;
  translationError?: string;
  conversationType?: 'direct' | 'group' | 'public' | 'global';
  userRole?: 'USER' | 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'CREATOR' | 'AUDIT' | 'ANALYST' | 'BIGBOSS';
}

function BubbleMessageInner({ 
  message, 
  currentUser, 
  userLanguage, 
  usedLanguages = [],
  onForceTranslation,
  onEditMessage,
  onDeleteMessage,
  onLanguageSwitch,
  onReplyMessage,
  onNavigateToMessage,
  onImageClick,
  currentDisplayLanguage,
  isTranslating = false,
  translationError,
  conversationType = 'direct',
  userRole = 'USER'
}: BubbleMessageProps) {
  const { t } = useI18n('bubbleStream');
  
  // Hook pour gérer les réactions de ce message
  const { addReaction } = useMessageReactions({
    messageId: message.id,
    currentUserId: currentUser.id,
    isAnonymous: false,
    enabled: true
  });
  
  // Hook pour fixer les z-index des popovers de traduction
  useFixTranslationPopoverZIndex();
  
  // Fonction pour formater la date du message parent
  const formatReplyDate = (date: Date | string) => {
    const messageDate = new Date(date);
    const now = new Date();
    
    // Réinitialiser l'heure pour comparer uniquement les dates
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const isSameDay = messageDateOnly.getTime() === nowDateOnly.getTime();
    const isSameYear = messageDate.getFullYear() === now.getFullYear();
    
    if (isSameDay) {
      // Même jour : afficher seulement l'heure
      return messageDate.toLocaleString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (isSameYear) {
      // Même année mais jour différent : afficher jour + mois + heure
      return messageDate.toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Année différente : afficher date complète + heure
      return messageDate.toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };
  
  // États UI locaux uniquement (pas de logique métier)
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  const [previousTranslationCount, setPreviousTranslationCount] = useState(0);
  const [isNewTranslation, setIsNewTranslation] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAddingReaction, setIsAddingReaction] = useState(false);
  
  // Fonction pour ajouter une réaction via le bouton emoji picker
  const handleAddReaction = async (emoji: string) => {
    // Protection contre les doubles clics
    if (isAddingReaction) {
      console.log('[BubbleMessage] Réaction déjà en cours d\'ajout, ignoré');
      return;
    }

    try {
      setIsAddingReaction(true);
      
      // Utiliser le hook useMessageReactions qui gère l'optimistic update
      const success = await addReaction(emoji);
      
      if (success) {
        console.log('[BubbleMessage] Reaction added successfully, closing picker');
        setIsEmojiPickerOpen(false);
      } else {
        console.error('[BubbleMessage] Failed to add reaction');
        toast.error(t('addReaction') + ': Failed');
      }
    } catch (error) {
      console.error('[BubbleMessage] Error adding reaction:', error);
      toast.error(t('addReaction') + ': Error');
    } finally {
      setIsAddingReaction(false);
    }
  };
  
  // Timer pour la fermeture automatique au mouse leave
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fonction pour gérer l'ouverture/fermeture de la popover de manière contrôlée
  const handlePopoverOpenChange = useCallback((open: boolean) => {
    
    // Annuler le timer de fermeture si on réouvre
    if (open && closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    
    setIsTranslationPopoverOpen(open);
    if (!open) {
      setTranslationFilter(''); // Réinitialiser le filtre quand on ferme
    }
    
    // Debug z-index quand on ouvre
    if (open) {
      setTimeout(() => {
        const popover = document.querySelector(`[data-radix-popover-content]`);
        if (popover) {
          const style = window.getComputedStyle(popover);
          console.log(`🎯 Popover style:`, {
            zIndex: style.zIndex,
            position: style.position,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
          });
        }
      }, 100);
    }
  }, [message.id]);
  
  // Gérer la fermeture automatique quand la souris quitte le popover
  const handlePopoverMouseLeave = useCallback(() => {
    // Délai de 300ms pour permettre de revenir dans le popover
    closeTimerRef.current = setTimeout(() => {
      handlePopoverOpenChange(false);
    }, 300);
  }, [handlePopoverOpenChange]);
  
  // Annuler la fermeture si la souris revient dans le popover
  const handlePopoverMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  
  // Cleanup du timer au démontage
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);
  
  const [translationFilter, setTranslationFilter] = useState('');
  
  const contentRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Calculer le positionnement dynamique du popover basé sur la position du message
  const getPopoverSide = useCallback((): 'top' | 'bottom' => {
    if (!messageRef.current) return 'top'; // Fallback par défaut
    
    try {
      const messageRect = messageRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const messageCenter = messageRect.top + (messageRect.height / 2);
      
      // Si le message est dans la moitié inférieure de l'écran, ouvrir vers le haut
      // Si le message est dans la moitié supérieure, ouvrir vers le bas
      return messageCenter > (viewportHeight / 2) ? 'top' : 'bottom';
    } catch (error) {
      console.warn('Erreur calcul position popover:', error);
      return 'top'; // Fallback en cas d'erreur
    }
  }, []);

  // Effet pour détecter les nouvelles traductions et déclencher l'animation
  useEffect(() => {
    const currentCount = message.translations?.length || 0;
    
    if (currentCount > previousTranslationCount && previousTranslationCount > 0) {
      // Une nouvelle traduction a été ajoutée
      setIsNewTranslation(true);
      
      // Si la nouvelle traduction est dans la langue de l'utilisateur, afficher une notification
      const newTranslation = message.translations?.find((t: any) => 
        (t.language || t.targetLanguage) === userLanguage
      );
      
      if (newTranslation && currentDisplayLanguage === userLanguage) {
        toast.success(t('messageTranslatedTo', { language: userLanguage }), {
          duration: 2000,
          position: 'bottom-right'
        });
      }
      
      // Arrêter l'animation après 2 secondes
      const timer = setTimeout(() => {
        setIsNewTranslation(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    
    setPreviousTranslationCount(currentCount);
  }, [message.translations?.length, previousTranslationCount, userLanguage, currentDisplayLanguage, message.id]);

  // Les traductions sont déjà normalisées
  const normalizedTranslations = message.translations || [];

  // Calculer si une traduction est réellement en cours
  const isActuallyTranslating = useMemo(() => {
    // Si aucune traduction, on se base sur la prop
    if (!message.translations || message.translations.length === 0) {
      return isTranslating;
    }

    // Les traductions venant du backend sont déjà complétées
    // Seules les traductions en cours côté frontend ont un statut 'pending'
    const hasOngoingTranslations = message.translations.some((t: any) => {
      const status = t.status;
      return status === 'pending' || status === 'processing';
    });

    // Si une traduction a un translatedContent et pas de statut, elle est complétée
    const allCompleted = message.translations.every((t: any) => {
      const status = t.status;
      return !status || status === 'completed' || !!t.translatedContent;
    });

    // Si toutes les traductions sont complétées, on n'est plus en cours de traduction
    if (allCompleted) {
      return false;
    }

    // Si on a des traductions en cours OU si le parent dit qu'on traduit ET qu'on n'a pas toutes les traductions complétées
    const result = hasOngoingTranslations || (isTranslating && !allCompleted);
    return result;
  }, [message.translations, isTranslating]);

  // Mémoriser le contenu actuel pour qu'il se mette à jour quand la langue change
  const currentContent = useMemo(() => {
    const originalLang = message.originalLanguage || 'fr';
    
    if (currentDisplayLanguage === originalLang) {
      const content = message.originalContent || message.content;
      return content;
    }
    
    const translation = message.translations?.find((t: any) => 
      (t?.language || t?.targetLanguage) === currentDisplayLanguage
    );
    
    if (translation) {
      const content = ((translation as any)?.content || (translation as any)?.translatedContent);
      return content || message.originalContent || message.content;
    }
    
    return message.originalContent || message.content;
  }, [currentDisplayLanguage, message.id, message.originalLanguage, message.content, message.originalContent, message.translations]);

  // Mémoriser le contenu traduit du message replyTo (même logique que currentContent)
  const replyToContent = useMemo(() => {
    if (!message.replyTo) return null;
    
    const originalLang = message.replyTo.originalLanguage || 'fr';
    
    // Si la langue d'affichage correspond à la langue originale, afficher l'original
    if (currentDisplayLanguage === originalLang) {
      return message.replyTo.content;
    }
    
    // Chercher une traduction dans la langue d'affichage actuelle
    const translation = message.replyTo.translations?.find((t: any) => 
      (t?.language || t?.targetLanguage) === currentDisplayLanguage
    );
    
    if (translation) {
      const content = ((translation as any)?.content || (translation as any)?.translatedContent);
      return content || message.replyTo.content;
    }
    
    // Fallback: afficher le contenu original
    return message.replyTo.content;
  }, [currentDisplayLanguage, message.replyTo?.id, message.replyTo?.originalLanguage, message.replyTo?.content, message.replyTo?.translations]);

  const formatTimeAgo = (timestamp: string | Date) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return t('justNow');
    if (diffInMinutes < 60) return t('minutesAgo', { minutes: diffInMinutes });
    if (diffInMinutes < 1440) return t('hoursAgo', { hours: Math.floor(diffInMinutes / 60) });
    return t('daysAgo', { days: Math.floor(diffInMinutes / 1440) });
  };

  // Handlers qui remontent les actions au parent
  const handleLanguageSwitch = (langCode: string) => {
    console.log(`📊 [BUBBLE-MESSAGE] Current display language: ${currentDisplayLanguage}`);
    handlePopoverOpenChange(false);
    onLanguageSwitch?.(message.id, langCode);
  };

  const handleForceTranslation = (targetLanguage: string) => {
    handlePopoverOpenChange(false);
    onForceTranslation?.(message.id, targetLanguage);
  };

  // Fonction pour obtenir le tier supérieur
  const getNextTier = (currentTier: string) => {
    const tiers = ['basic', 'medium', 'premium'];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  };

  // Fonction pour forcer une re-traduction avec tier supérieur
  const handleUpgradeTier = async (targetLanguage: string, currentTier: string) => {
    const nextTier = getNextTier(currentTier);
    if (!nextTier) {
      toast.info(t('maxModelReached'));
      return;
    }

    handlePopoverOpenChange(false);
    
    if (onForceTranslation) {
      try {
        // Appeler avec le tier supérieur spécifié
        await onForceTranslation(message.id, targetLanguage, nextTier as 'basic' | 'medium' | 'premium');
        toast.success(t('retranslatingTo', { 
          language: getLanguageInfo(targetLanguage).name, 
          model: nextTier 
        }));
      } catch (error) {
        toast.error(t('upgradeError'));
      }
    }
  };

  const handleEditMessage = async () => {
    const newContent = prompt(t('editMessagePrompt'), message.content);
    if (newContent && newContent.trim() !== message.content) {
      await onEditMessage?.(message.id, newContent.trim());
    }
  };

  const handleDeleteMessage = async () => {
    const confirmed = confirm(t('deleteMessageConfirm'));
    if (confirmed) {
      await onDeleteMessage?.(message.id);
    }
  };

  // Logique de permissions (pure, pas d'effets de bord)
  const isOwnMessage = message.senderId === currentUser.id || 
                      message.anonymousSenderId === currentUser.id;
  
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

  // Données dérivées pour l'affichage
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
    const langInfo = getLanguageInfo((version as any).language);
    const searchTerm = translationFilter.toLowerCase();
    return (
      langInfo.name.toLowerCase().includes(searchTerm) ||
      langInfo.code.toLowerCase().includes(searchTerm) ||
      (version as any).content.toLowerCase().includes(searchTerm)
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
              src={(message.sender as any)?.avatar} 
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
            
            {/* Date d'envoi */}
            <span className="text-[9px] text-gray-400 dark:text-gray-500 flex-shrink-0 text-center">
              {formatTimeAgo(message.createdAt)}
            </span>
            
            {/* Badge anonyme si applicable */}
            {message.anonymousSenderId && (
              <Ghost className="h-2.5 w-2.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Message Bubble */}
        <div className={cn(
          "relative flex-1 min-w-0 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] overflow-visible",
          isOwnMessage && "flex flex-col items-end"
        )}>
          {/* Main Message Card */}
          <Card 
            className={cn(
              "relative transition-colors duration-200 border shadow-none max-w-full overflow-visible group/message",
              isOwnMessage 
                ? 'bg-gradient-to-br from-blue-400 to-blue-500 border-blue-400 text-white' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            )}
          >
            <CardContent className="p-1 sm:p-2 max-w-full overflow-hidden">

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
                        onClick={() => handleLanguageSwitch(message.originalLanguage || 'fr')}
                      >
                        <span className="text-sm">{getLanguageInfo(message.originalLanguage || 'fr').flag}</span>
                        {/* Hide language code on mobile */}
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

                  {/* Bouton traduction avec popover */}
                  <Tooltip>
                    <Popover 
                      open={isTranslationPopoverOpen} 
                      onOpenChange={handlePopoverOpenChange}
                      modal={false}
                    >
                      <PopoverTrigger asChild>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseEnter={handlePopoverMouseEnter}
                            onMouseLeave={handlePopoverMouseLeave}
                            className={cn(
                              "relative h-7 w-7 p-0 rounded-full transition-all duration-200",
                              isNewTranslation
                                ? isOwnMessage
                                  ? "text-green-300 bg-white/30 hover:bg-white/40"
                                  : "text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-950 dark:hover:bg-green-900"
                                : isOwnMessage
                                  ? "text-white/70 hover:text-white hover:bg-white/20"
                                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                            )}
                            aria-label={t('translationOptions')}
                          >
                            <Languages className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              isActuallyTranslating && "animate-pulse"
                            )} />
                            
                            {message.translations && message.translations.length > 0 && (
                              <span 
                                className={cn(
                                  "absolute -top-0.5 -right-0.5 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold transition-all duration-300",
                                  isNewTranslation 
                                    ? "bg-green-500 shadow-md scale-110" 
                                    : "bg-blue-500"
                                )}
                              >
                                {message.translations.length}
                              </span>
                            )}
                          </Button>
                        </TooltipTrigger>
                      </PopoverTrigger>
                      <TooltipContent>
                        <p>{t('translationOptions')}</p>
                      </TooltipContent>
                <PopoverContent 
                  className={cn(
                    "w-[calc(100vw-32px)] sm:w-[270px] md:w-[294px] p-0 shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 backdrop-blur-sm",
                    Z_CLASSES.POPOVER
                  )}
                  side={getPopoverSide()} 
                  align="center"
                  sideOffset={8}
                  alignOffset={0}
                  collisionPadding={{ top: 80, right: 16, bottom: 80, left: 16 }}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onInteractOutside={(e) => {
                    e.preventDefault();
                    handlePopoverOpenChange(false);
                  }}
                  onMouseEnter={handlePopoverMouseEnter}
                  onMouseLeave={handlePopoverMouseLeave}
                >
                  <Tabs defaultValue="translations" className="w-full max-h-[min(500px,calc(100vh-160px))] flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 mb-2 sm:mb-3 flex-shrink-0">
                      <TabsTrigger value="translations" className="text-[10px] sm:text-xs py-1.5 sm:py-2">
                        {t('translations')} ({availableVersions.length})
                      </TabsTrigger>
                      <TabsTrigger value="translate" className="text-[10px] sm:text-xs py-1.5 sm:py-2">
                        {t('translateTo')} ({filteredMissingLanguages.length})
                      </TabsTrigger>
                    </TabsList>

                    {/* Onglet Traductions disponibles */}
                    <TabsContent value="translations" className="mt-0 flex-1 overflow-hidden">
                      <div className="p-2 sm:p-3 pt-0 h-full flex flex-col">
                        {/* Champ de filtre */}
                        {availableVersions.length > 1 && (
                          <div className="mb-3">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                              <Input
                                ref={filterInputRef}
                                placeholder={t('filterLanguages')}
                                value={translationFilter}
                                onChange={(e) => setTranslationFilter(e.target.value)}
                                className="pl-8 pr-8 h-8 text-xs bg-gray-50/80 dark:bg-gray-800/80 border-gray-200/60 dark:border-gray-600/60 focus:bg-white dark:focus:bg-gray-700 focus:border-blue-300 dark:focus:border-blue-600 transition-all text-gray-900 dark:text-gray-100"
                              />
                              {translationFilter && (
                                <button
                                  onClick={() => setTranslationFilter('')}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Liste des traductions - hauteur adaptative */}
                        <div className="space-y-1 max-h-[180px] sm:max-h-[220px] overflow-y-auto scrollbar-thin">
                      {filteredVersions.length > 0 ? (
                        filteredVersions.map((version, index) => {
                          const versionAny = version as any;
                          const langInfo = getLanguageInfo(versionAny.language);
                          const isCurrentlyDisplayed = currentDisplayLanguage === versionAny.language;
                          
                          return (
                            <button
                              key={`${message.id}-version-${versionAny.language}-${index}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLanguageSwitch(versionAny.language);
                                handlePopoverOpenChange(false);
                              }}
                              className={`w-full p-2 sm:p-2.5 rounded-lg text-left transition-all duration-200 group ${
                                isCurrentlyDisplayed 
                                  ? 'bg-blue-50/80 dark:bg-blue-900/40 border border-blue-200/60 dark:border-blue-700/60'
                                  : 'bg-white/60 dark:bg-gray-700/40 border border-transparent hover:bg-white/80 dark:hover:bg-gray-700/60 hover:border-gray-200/60 dark:hover:border-gray-600/60 active:bg-white/90 dark:active:bg-gray-700/70'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center space-x-2">
                                  <span className="text-base">{langInfo.flag}</span>
                                  <span className={`font-medium text-sm ${
                                    isCurrentlyDisplayed ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {langInfo.name}
                                  </span>
                                  {versionAny.isOriginal && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100/60 dark:bg-gray-700/60 px-1.5 py-0.5 rounded">
                                      {t('originalBadge')}
                                    </span>
                                  )}
                                  {isCurrentlyDisplayed && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                  )}
                                </div>
                                {!versionAny.isOriginal && (
                                  <div className="flex items-center space-x-1">
                                    {/* Icône d'upgrade vers tier supérieur */}
                                    {getNextTier && getNextTier(versionAny.model || 'basic') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpgradeTier && handleUpgradeTier(versionAny.language, versionAny.model || 'basic');
                                            }}
                                            className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors cursor-pointer"
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {t('improveQuality', { 
                                            current: versionAny.model || 'basic', 
                                            next: getNextTier(versionAny.model || 'basic') 
                                          })}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100/60 dark:bg-gray-700/60 px-1.5 py-0.5 rounded">
                                      {Math.round(versionAny.confidence * 100)}%
                                    </span>
                                    {versionAny.model && (
                                      <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/60 px-1.5 py-0.5 rounded">
                                        {versionAny.model}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2 group-hover:text-gray-800 dark:group-hover:text-gray-200">
                                {versionAny.content}
                              </p>
                              
                              {/* Indicateur de qualité discret */}
                              {!versionAny.isOriginal && (
                                <div className="mt-1.5 flex items-center space-x-1">
                                  <div className="flex-1 bg-gray-200/40 dark:bg-gray-700/40 rounded-full h-0.5">
                                    <div 
                                      className="bg-green-400 dark:bg-green-500 h-0.5 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.round((versionAny.confidence || 0.9) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })
                          ) : (
                            <div className="text-center p-4 text-gray-400 dark:text-gray-500">
                              <Languages className="h-6 w-6 mx-auto mb-2 opacity-60" />
                              <p className="text-xs">
                                {translationFilter ? t('noTranslationFound') : t('noTranslationAvailable')}
                              </p>
                            </div>
                          )}
                        </div>

                        {isActuallyTranslating && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-center space-x-2 text-sm text-blue-600 dark:text-blue-400 py-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="font-medium">{t('translating')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Onglet Traduire vers */}
                    <TabsContent value="translate" className="mt-0 flex-1 overflow-hidden">
                      <div className="p-2 sm:p-3 pt-0 h-full flex flex-col">
                        {/* Champ de filtre */}
                        {getMissingLanguages().length > 3 && (
                          <div className="mb-3">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                              <Input
                                placeholder={t('filterLanguages')}
                                value={translationFilter}
                                onChange={(e) => setTranslationFilter(e.target.value)}
                                className="pl-8 pr-8 h-8 text-xs bg-gray-50/80 dark:bg-gray-800/80 border-gray-200/60 dark:border-gray-600/60 focus:bg-white dark:focus:bg-gray-700 focus:border-blue-300 dark:focus:border-blue-600 transition-all text-gray-900 dark:text-gray-100"
                              />
                              {translationFilter && (
                                <button
                                  onClick={() => setTranslationFilter('')}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Liste des langues à traduire - hauteur adaptative */}
                        <div className="space-y-1 max-h-[180px] sm:max-h-[220px] overflow-y-auto scrollbar-thin">
                          {filteredMissingLanguages.length > 0 ? (
                            filteredMissingLanguages.map((lang, index) => (
                              <button
                                key={`${message.id}-missing-${lang.code}-${index}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleForceTranslation(lang.code);
                                  handlePopoverOpenChange(false);
                                }}
                                className="w-full p-2 sm:p-2.5 rounded-lg border border-gray-100/60 dark:border-gray-700/60 text-left transition-all hover:shadow-sm hover:border-green-200/60 dark:hover:border-green-700/60 hover:bg-green-50/60 dark:hover:bg-green-900/40 active:bg-green-50/80 dark:active:bg-green-900/60"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="text-base">{lang.flag}</span>
                                  <div className="flex-1">
                                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{lang.name}</span>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{lang.translateText}</p>
                                  </div>
                                  <Languages className="h-3.5 w-3.5 text-green-600 dark:text-green-400 opacity-60" />
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="text-center p-4 text-gray-400 dark:text-gray-500">
                              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 opacity-60" />
                              <p className="text-xs">
                                {t('allLanguagesTranslated')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
                    </Popover>
                  </Tooltip>

                  {/* Bouton ajout de réaction */}
                  <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('addReaction') || 'Add reaction'}
                            className={cn(
                              "h-7 w-7 p-0 rounded-full transition-colors",
                              isOwnMessage
                                ? 'text-white/70 hover:text-white hover:bg-white/20'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700'
                            )}
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('addReaction') || 'Add reaction'}</p>
                      </TooltipContent>
                    </Tooltip>
                    <PopoverContent 
                      className="w-auto p-0 border-0 shadow-lg"
                      align="start"
                      side="top"
                    >
                      <EmojiPicker
                        onEmojiSelect={handleAddReaction}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Bouton copie */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(currentContent);
                            toast.success(t('copied'), {
                              duration: 2000,
                            });
                          } catch (error) {
                            toast.error(t('copyFailed'), {
                              duration: 2000,
                            });
                          }
                        }}
                        aria-label={t('copyShowingContent')}
                        className={cn(
                          "h-7 w-7 p-0 rounded-full transition-colors",
                          isOwnMessage 
                            ? "text-white/70 hover:text-white hover:bg-white/20" 
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                        )}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('copyShowingContent')}</p>
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
              conversationId={message.conversationId}
              currentUserId={currentUser.id}
              isAnonymous={false}
              showAddButton={false}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export const BubbleMessage = BubbleMessageInner;