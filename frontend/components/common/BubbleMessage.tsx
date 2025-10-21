'use client';

import { memo, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { User, BubbleTranslation } from '@shared/types';
import type { Message } from '@shared/types/conversation';
import { useI18n } from '@/hooks/useI18n';
import { useMessageView } from '@/hooks/use-message-view-state';
import { BubbleMessageNormalView } from './bubble-message/BubbleMessageNormalView';
import { ReactionSelectionMessageView } from './bubble-message/ReactionSelectionMessageView';
import { LanguageSelectionMessageView } from './bubble-message/LanguageSelectionMessageView';
import { EditMessageView } from './bubble-message/EditMessageView';
import { DeleteConfirmationView } from './bubble-message/DeleteConfirmationView';

interface BubbleMessageProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    translations: BubbleTranslation[];
    originalContent: string;
    readStatus?: Array<{ userId: string; readAt: Date }>;
    attachments?: any[];
  };
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
  
  // Actions remontées au parent (AUCUN CHANGEMENT)
  onForceTranslation?: (messageId: string, targetLanguage: string, model?: 'basic' | 'medium' | 'premium') => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void> | void;
  onDeleteMessage?: (messageId: string) => Promise<void> | void;
  onLanguageSwitch?: (messageId: string, language: string) => void;
  onReplyMessage?: (message: Message) => void;
  onNavigateToMessage?: (messageId: string) => void;
  onImageClick?: (attachmentId: string) => void;
  
  // États contrôlés depuis le parent (AUCUN CHANGEMENT)
  currentDisplayLanguage: string;
  isTranslating?: boolean;
  translationError?: string;
  conversationType?: 'direct' | 'group' | 'public' | 'global';
  userRole?: 'USER' | 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'CREATOR' | 'AUDIT' | 'ANALYST' | 'BIGBOSS';
  conversationId?: string;
  isAnonymous?: boolean;
  currentAnonymousUserId?: string;
}

const BubbleMessageInner = memo(function BubbleMessageInner({
  message,
  currentUser,
  userLanguage,
  usedLanguages,
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
  conversationType = 'global',
  userRole = 'USER',
  conversationId,
  isAnonymous = false,
  currentAnonymousUserId
}: BubbleMessageProps) {
  
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);

  // Hook de virtualization pour ce message spécifique
  const {
    currentMode,
    currentData,
    isActive,
    enterReactionMode,
    enterLanguageMode,
    enterEditMode,
    enterDeleteMode,
    exitMode
  } = useMessageView(message.id);

  // Déterminer si c'est notre message
  const isOwnMessage = useMemo(() => {
    if (!currentUser) return false;
    if (isAnonymous && currentAnonymousUserId) {
      return message.anonymousSender?.id === currentAnonymousUserId;
    }
    return message.sender?.id === currentUser.id;
  }, [message.sender?.id, message.anonymousSender?.id, currentUser, isAnonymous, currentAnonymousUserId]);

  // Permissions
  const canEdit = useMemo(() => {
    if (isOwnMessage) return true;
    if (userRole && ['MODERATOR', 'ADMIN', 'CREATOR', 'BIGBOSS'].includes(userRole)) return true;
    return false;
  }, [isOwnMessage, userRole]);

  const canDelete = useMemo(() => {
    if (isOwnMessage) return true;
    if (userRole && ['MODERATOR', 'ADMIN', 'CREATOR', 'BIGBOSS'].includes(userRole)) return true;
    return false;
  }, [isOwnMessage, userRole]);

  // Contenu affiché actuellement
  const currentContent = useMemo(() => {
    if (currentDisplayLanguage === (message.originalLanguage || 'fr')) {
      return message.originalContent || message.content;
    }
    
    const translation = message.translations.find(t => t.language === currentDisplayLanguage);
    return translation?.content || message.content;
  }, [currentDisplayLanguage, message.originalLanguage, message.originalContent, message.content, message.translations]);

  // Contenu de réponse (pour les messages parents)
  const replyToContent = useMemo(() => {
    if (!message.replyTo) return undefined;
    
    const replyMessage = message.replyTo;
    if (currentDisplayLanguage === (replyMessage.originalLanguage || 'fr')) {
      return replyMessage.originalContent || replyMessage.content;
    }
    
    const translation = replyMessage.translations?.find(t => t.language === currentDisplayLanguage);
    return translation?.content || replyMessage.content;
  }, [message.replyTo, currentDisplayLanguage]);

  // Format de date pour les réponses
  const formatReplyDate = useCallback((date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return t('justNow');
    if (diffHours < 24) return t('hoursAgo', { hours: diffHours });
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('daysAgo', { days: diffDays });
    
    return dateObj.toLocaleDateString();
  }, [t]);

  // Actions des vues spécialisées
  const handleReactionSelect = useCallback((emoji: string) => {
    // L'ajout de réaction se fait via MessageReactions existant
    // La vue se ferme automatiquement
    exitMode();
  }, [exitMode]);

  const handleLanguageSelect = useCallback((language: string) => {
    onLanguageSwitch?.(message.id, language);
    exitMode();
  }, [onLanguageSwitch, message.id, exitMode]);

  const handleRequestTranslation = useCallback((language: string, model?: 'basic' | 'medium' | 'premium') => {
    onForceTranslation?.(message.id, language, model);
    exitMode();
  }, [onForceTranslation, message.id, exitMode]);

  const handleSaveEdit = useCallback(async (messageId: string, newContent: string) => {
    try {
      await onEditMessage?.(messageId, newContent);
      exitMode();
      toast.success(t('messageUpdated'));
    } catch (error) {
      toast.error(t('failedToUpdateMessage'));
      throw error; // Re-throw pour que la vue puisse afficher l'erreur
    }
  }, [onEditMessage, exitMode, t]);

  const handleConfirmDelete = useCallback(async (messageId: string) => {
    try {
      await onDeleteMessage?.(messageId);
      exitMode();
      toast.success(t('messageDeleted'));
    } catch (error) {
      toast.error(t('failedToDeleteMessage'));
      throw error; // Re-throw pour que la vue puisse afficher l'erreur
    }
  }, [onDeleteMessage, exitMode, t]);

  const handleCopyMessage = useCallback(() => {
    navigator.clipboard.writeText(currentContent);
    toast.success(t('messageCopied'));
  }, [currentContent, t]);

  const handleReportMessage = useCallback(() => {
    // TODO: Implémenter le système de signalement
    toast.info(t('reportSubmitted'));
  }, [t]);

  // Emojis récents (dummy data pour l'instant)
  const recentEmojis = ['❤️', '😀', '👍', '😂', '🔥', '🎉', '💯', '✨'];

  // VIRTUALIZATION SMART: Rendu conditionnel selon le mode
  return (
    <AnimatePresence mode="wait" initial={false}>
      {currentMode === 'normal' && (
        <BubbleMessageNormalView
          key={`normal-${message.id}`}
          message={message}
          currentUser={currentUser}
          userLanguage={userLanguage}
          usedLanguages={usedLanguages}
          currentDisplayLanguage={currentDisplayLanguage}
          isTranslating={isTranslating}
          translationError={translationError}
          conversationType={conversationType}
          userRole={userRole}
          conversationId={conversationId}
          isAnonymous={isAnonymous}
          currentAnonymousUserId={currentAnonymousUserId}
          onReplyMessage={onReplyMessage}
          onNavigateToMessage={onNavigateToMessage}
          onImageClick={onImageClick}
          onLanguageSwitch={onLanguageSwitch}
          onEnterReactionMode={enterReactionMode}
          onEnterLanguageMode={enterLanguageMode}
          onEnterEditMode={canEdit ? enterEditMode : undefined}
          onEnterDeleteMode={canDelete ? enterDeleteMode : undefined}
          onEditMessage={canEdit ? onEditMessage : undefined}
          onDeleteMessage={canDelete ? onDeleteMessage : undefined}
        />
      )}

      {currentMode === 'reaction' && (
        <ReactionSelectionMessageView
          key={`reaction-${message.id}`}
          message={message}
          isOwnMessage={isOwnMessage}
          onSelectReaction={handleReactionSelect}
          onClose={exitMode}
          recentEmojis={recentEmojis}
          conversationId={conversationId || message.conversationId}
          currentUserId={currentUser?.id || ''}
          currentAnonymousUserId={currentAnonymousUserId}
          isAnonymous={isAnonymous}
        />
      )}

      {currentMode === 'language' && (
        <LanguageSelectionMessageView
          key={`language-${message.id}`}
          message={message}
          currentDisplayLanguage={currentDisplayLanguage}
          isOwnMessage={isOwnMessage}
          isTranslating={isTranslating}
          onSelectLanguage={handleLanguageSelect}
          onRequestTranslation={handleRequestTranslation}
          onClose={exitMode}
          t={t}
          userLanguage={userLanguage}
          usedLanguages={usedLanguages}
        />
      )}

      {currentMode === 'edit' && (
        <EditMessageView
          key={`edit-${message.id}`}
          message={message}
          isOwnMessage={isOwnMessage}
          onSave={handleSaveEdit}
          onCancel={exitMode}
        />
      )}

      {currentMode === 'delete' && (
        <DeleteConfirmationView
          key={`delete-${message.id}`}
          message={message}
          isOwnMessage={isOwnMessage}
          onConfirm={handleConfirmDelete}
          onCancel={exitMode}
        />
      )}
    </AnimatePresence>
  );
});

export const BubbleMessage = BubbleMessageInner;