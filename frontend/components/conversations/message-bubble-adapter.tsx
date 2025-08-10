'use client';

import { BubbleMessage } from '@/components/common/bubble-message';
import type { TranslatedMessage, User } from '@/types';

interface MessageBubbleAdapterProps {
  message: TranslatedMessage;
  currentUserId: string;
  currentUserLanguage: string;
  onTranslate: (messageId: string, targetLanguage: string, forceRetranslate?: boolean, sourceLanguage?: string) => Promise<{detectedLanguage?: string} | void>;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onToggleOriginal: (messageId: string) => void;
}

/**
 * Adaptateur pour utiliser BubbleMessage dans les conversations existantes
 * Convertit les props de MessageBubble vers BubbleMessage
 */
export function MessageBubbleAdapter({ 
  message, 
  currentUserId, 
  currentUserLanguage,
  onTranslate, 
  onEdit,
  onToggleOriginal 
}: MessageBubbleAdapterProps) {
  // Créer un objet User simplifié pour currentUser
  const currentUser: User = {
    id: currentUserId,
    systemLanguage: currentUserLanguage,
    regionalLanguage: currentUserLanguage,
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    // Propriétés minimales requises pour l'interface User
    username: 'current-user',
    firstName: 'User',
    lastName: '',
    email: '',
    avatar: '',
    role: 'USER' as const,
    permissions: {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageGroups: false,
      canManageConversations: false,
      canViewAnalytics: false,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    isOnline: true,
    isActive: true,
    lastSeen: new Date(),
    createdAt: new Date(),
    lastActiveAt: new Date(),
    updatedAt: new Date()
  };

  // Convertir TranslatedMessage vers le format attendu par BubbleMessage
  const adaptedMessage = {
    ...message,
    originalLanguage: message.originalLanguage || 'fr',
    originalContent: message.originalContent || message.content,
    translations: message.translations?.map(translation => ({
      language: translation.targetLanguage,
      content: translation.translatedContent,
      status: 'completed' as const,
      timestamp: new Date(),
      confidence: 0.9
    })) || [],
    // Propriétés supplémentaires pour compatibilité
    conversationId: message.conversationId || '',
    sender: message.sender
  };

  // Déterminer les langues utilisées basées sur les traductions disponibles
  const usedLanguages = [
    currentUserLanguage,
    ...(message.translations?.map(t => t.targetLanguage) || [])
  ].filter((lang, index, array) => array.indexOf(lang) === index);

  return (
    <BubbleMessage
      message={adaptedMessage}
      currentUser={currentUser}
      userLanguage={currentUserLanguage}
      usedLanguages={usedLanguages}
    />
  );
}
