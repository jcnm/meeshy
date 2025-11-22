/**
 * Utilitaires de formatage pour les notifications
 * Timestamps, previews, icônes, couleurs selon NOTIFICATION_TYPES_REFERENCE.md
 */

import {
  NotificationType,
  type NotificationV2,
  type NotificationIcon,
  type AttachmentType
} from '@/types/notification-v2';

/**
 * Configuration des icônes et couleurs par type de notification
 */
export const NOTIFICATION_ICONS: Record<NotificationType, NotificationIcon> = {
  [NotificationType.NEW_MESSAGE]: {
    emoji: '💬',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  [NotificationType.MESSAGE_REPLY]: {
    emoji: '↩️',
    color: 'text-blue-400',
    bgColor: 'bg-blue-50'
  },
  [NotificationType.USER_MENTIONED]: {
    emoji: '@',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  [NotificationType.MESSAGE_REACTION]: {
    emoji: '❤️',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50'
  },
  [NotificationType.CONTACT_REQUEST]: {
    emoji: '🤝',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  [NotificationType.CONTACT_ACCEPTED]: {
    emoji: '✅',
    color: 'text-green-400',
    bgColor: 'bg-green-50'
  },
  [NotificationType.NEW_CONVERSATION_DIRECT]: {
    emoji: '👤',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  [NotificationType.NEW_CONVERSATION_GROUP]: {
    emoji: '👥',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  [NotificationType.MEMBER_JOINED]: {
    emoji: '👋',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  },
  [NotificationType.MISSED_CALL]: {
    emoji: '📞',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  [NotificationType.SYSTEM]: {
    emoji: '🔔',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  }
};

/**
 * Icônes pour les types d'attachments
 */
export const ATTACHMENT_ICONS: Record<AttachmentType, string> = {
  image: '📷',
  video: '🎥',
  audio: '🎵',
  pdf: '📄',
  document: '📎'
};

/**
 * Formate un timestamp de manière intelligente
 * Règles:
 * - < 10 secondes: "à l'instant"
 * - < 1 minute: "il y a X secondes"
 * - < 1 heure: "il y a X minutes"
 * - < 24 heures: "il y a X heures"
 * - < 7 jours: "il y a X jours"
 * - >= 7 jours: date absolue "12 Jan 2024"
 */
export function formatNotificationTimestamp(date: Date, locale = 'en'): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Temps réel (< 10 secondes)
  if (diffSeconds < 10) {
    return getTranslation('justNow', locale);
  }

  // Secondes
  if (diffSeconds < 60) {
    return getTranslation('secondsAgo', locale, { count: diffSeconds });
  }

  // Minutes
  if (diffMinutes < 60) {
    return getTranslation('minutesAgo', locale, { count: diffMinutes });
  }

  // Heures
  if (diffHours < 24) {
    return getTranslation('hoursAgo', locale, { count: diffHours });
  }

  // Jours
  if (diffDays < 7) {
    return getTranslation('daysAgo', locale, { count: diffDays });
  }

  // Date absolue
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  }).format(date);
}

/**
 * Tronque un message à un nombre de mots maximum
 */
export function truncateMessage(message: string, maxWords = 25): string {
  const words = message.trim().split(/\s+/);

  if (words.length <= maxWords) {
    return message;
  }

  return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Formate l'aperçu d'un message avec attachments
 * Règles:
 * - Texte seul: tronquer à 25 mots
 * - Avec attachment: tronquer à 15 mots + icône
 * - Attachment seul: juste l'icône
 */
export function formatMessagePreview(
  content: string,
  attachments?: {
    count: number;
    firstType: AttachmentType;
    firstFilename?: string;
  },
  locale = 'en'
): string {
  const hasContent = content && content.trim().length > 0;
  const hasAttachments = attachments && attachments.count > 0;

  // Attachment seul
  if (!hasContent && hasAttachments) {
    const icon = ATTACHMENT_ICONS[attachments.firstType] || '📎';
    const label = getAttachmentLabel(attachments.firstType, locale);

    if (attachments.count > 1) {
      return `${icon} ${label} (+${attachments.count - 1})`;
    }

    return `${icon} ${label}`;
  }

  // Texte avec attachments
  if (hasContent && hasAttachments) {
    const truncated = truncateMessage(content, 15);
    const icon = ATTACHMENT_ICONS[attachments.firstType] || '📎';
    const label = getAttachmentLabel(attachments.firstType, locale);

    return `${truncated} ${icon} ${label}`;
  }

  // Texte seul
  return truncateMessage(content, 25);
}

/**
 * Formate le contexte d'une notification (temps + conversation)
 * Règles:
 * - Temps réel (< 10s): Pas de contexte
 * - Différé: "il y a X minutes • dans Y"
 */
export function formatNotificationContext(
  notification: NotificationV2,
  locale = 'en'
): string | null {
  const timestamp = formatNotificationTimestamp(notification.createdAt, locale);
  const conversationTitle = notification.context?.conversationTitle;

  // Temps réel: pas de contexte
  const diffSeconds = Math.floor((Date.now() - notification.createdAt.getTime()) / 1000);
  if (diffSeconds < 10) {
    return null;
  }

  // Différé avec conversation
  if (conversationTitle) {
    return `${timestamp} • ${getTranslation('in', locale)} ${conversationTitle}`;
  }

  // Différé sans conversation
  return timestamp;
}

/**
 * Génère le titre d'une notification selon son type et son contexte
 */
export function generateNotificationTitle(
  notification: NotificationV2,
  locale = 'en'
): string {
  const senderName = notification.sender?.username || 'Unknown';

  switch (notification.type) {
    case NotificationType.NEW_MESSAGE:
      return getTranslation('notifications.newMessage', locale, { sender: senderName });

    case NotificationType.MESSAGE_REPLY:
      return getTranslation('notifications.reply', locale, { sender: senderName });

    case NotificationType.USER_MENTIONED:
      return getTranslation('notifications.mentioned', locale, { sender: senderName });

    case NotificationType.MESSAGE_REACTION: {
      const emoji = notification.metadata?.reactionEmoji || '❤️';
      return getTranslation('notifications.reaction', locale, { sender: senderName, emoji });
    }

    case NotificationType.CONTACT_REQUEST:
      return getTranslation('notifications.contactRequest', locale, { sender: senderName });

    case NotificationType.CONTACT_ACCEPTED:
      return getTranslation('notifications.contactAccepted', locale, { sender: senderName });

    case NotificationType.NEW_CONVERSATION_DIRECT:
      return getTranslation('notifications.newConversationDirect', locale, { sender: senderName });

    case NotificationType.NEW_CONVERSATION_GROUP: {
      const title = notification.context?.conversationTitle || 'Group';
      return getTranslation('notifications.newConversationGroup', locale, { title });
    }

    case NotificationType.MEMBER_JOINED: {
      const title = notification.context?.conversationTitle || 'Group';
      return getTranslation('notifications.memberJoined', locale, { title });
    }

    case NotificationType.MISSED_CALL: {
      const callType = notification.metadata?.action === 'open_call' ? 'video' : 'audio';
      return getTranslation('notifications.missedCall', locale, { type: callType });
    }

    case NotificationType.SYSTEM:
      return notification.title || getTranslation('notifications.system', locale);

    default:
      return notification.title || getTranslation('notifications.default', locale);
  }
}

/**
 * Récupère l'icône appropriée pour une notification
 */
export function getNotificationIcon(notification: NotificationV2): NotificationIcon {
  // Pour les réactions, utiliser l'emoji de la réaction
  if (notification.type === NotificationType.MESSAGE_REACTION && notification.metadata?.reactionEmoji) {
    return {
      emoji: notification.metadata.reactionEmoji,
      color: NOTIFICATION_ICONS[NotificationType.MESSAGE_REACTION].color,
      bgColor: NOTIFICATION_ICONS[NotificationType.MESSAGE_REACTION].bgColor
    };
  }

  return NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS[NotificationType.SYSTEM];
}

/**
 * Génère le lien de navigation pour une notification
 */
export function getNotificationLink(notification: NotificationV2): string | null {
  const { context, metadata } = notification;

  switch (notification.type) {
    case NotificationType.NEW_MESSAGE:
    case NotificationType.MESSAGE_REPLY:
    case NotificationType.USER_MENTIONED:
    case NotificationType.MESSAGE_REACTION:
      if (context?.conversationId) {
        const messageAnchor = context.messageId ? `#msg-${context.messageId}` : '';
        return `/chat/${context.conversationId}${messageAnchor}`;
      }
      return null;

    case NotificationType.NEW_CONVERSATION_DIRECT:
    case NotificationType.NEW_CONVERSATION_GROUP:
    case NotificationType.MEMBER_JOINED:
      if (context?.conversationId) {
        return `/chat/${context.conversationId}`;
      }
      return null;

    case NotificationType.CONTACT_REQUEST:
      return '/contacts?tab=requests';

    case NotificationType.CONTACT_ACCEPTED:
      if (context?.conversationId) {
        return `/chat/${context.conversationId}`;
      }
      return '/contacts';

    case NotificationType.MISSED_CALL:
      if (context?.conversationId) {
        return `/chat/${context.conversationId}?action=call`;
      }
      return null;

    case NotificationType.SYSTEM:
      if (metadata?.action === 'view_details') {
        return '/settings/notifications';
      }
      return null;

    default:
      return null;
  }
}

/**
 * Vérifie si une notification nécessite une action utilisateur
 */
export function requiresUserAction(notification: NotificationV2): boolean {
  return notification.type === NotificationType.CONTACT_REQUEST;
}

/**
 * Vérifie si une notification peut être marquée comme lue automatiquement
 */
export function canAutoRead(notification: NotificationV2): boolean {
  return notification.type !== NotificationType.CONTACT_REQUEST;
}

/**
 * Helper pour obtenir le label d'un type d'attachment
 */
function getAttachmentLabel(type: AttachmentType, locale: string): string {
  const labels: Record<AttachmentType, Record<string, string>> = {
    image: { en: 'Photo', fr: 'Photo', es: 'Foto', pt: 'Foto' },
    video: { en: 'Video', fr: 'Vidéo', es: 'Video', pt: 'Vídeo' },
    audio: { en: 'Audio', fr: 'Audio', es: 'Audio', pt: 'Áudio' },
    pdf: { en: 'PDF', fr: 'PDF', es: 'PDF', pt: 'PDF' },
    document: { en: 'Document', fr: 'Document', es: 'Documento', pt: 'Documento' }
  };

  return labels[type]?.[locale] || labels[type]?.['en'] || 'File';
}

/**
 * Helper temporaire pour les traductions (sera remplacé par le système i18n)
 */
function getTranslation(key: string, locale: string, params: Record<string, any> = {}): string {
  const translations: Record<string, Record<string, string>> = {
    justNow: {
      en: 'just now',
      fr: 'à l\'instant',
      es: 'ahora mismo',
      pt: 'agora mesmo'
    },
    secondsAgo: {
      en: `${params.count} seconds ago`,
      fr: `il y a ${params.count} secondes`,
      es: `hace ${params.count} segundos`,
      pt: `há ${params.count} segundos`
    },
    minutesAgo: {
      en: `${params.count} minute${params.count > 1 ? 's' : ''} ago`,
      fr: `il y a ${params.count} minute${params.count > 1 ? 's' : ''}`,
      es: `hace ${params.count} minuto${params.count > 1 ? 's' : ''}`,
      pt: `há ${params.count} minuto${params.count > 1 ? 's' : ''}`
    },
    hoursAgo: {
      en: `${params.count} hour${params.count > 1 ? 's' : ''} ago`,
      fr: `il y a ${params.count} heure${params.count > 1 ? 's' : ''}`,
      es: `hace ${params.count} hora${params.count > 1 ? 's' : ''}`,
      pt: `há ${params.count} hora${params.count > 1 ? 's' : ''}`
    },
    daysAgo: {
      en: `${params.count} day${params.count > 1 ? 's' : ''} ago`,
      fr: `il y a ${params.count} jour${params.count > 1 ? 's' : ''}`,
      es: `hace ${params.count} día${params.count > 1 ? 's' : ''}`,
      pt: `há ${params.count} dia${params.count > 1 ? 's' : ''}`
    },
    in: {
      en: 'in',
      fr: 'dans',
      es: 'en',
      pt: 'em'
    }
  };

  return translations[key]?.[locale] || translations[key]?.['en'] || key;
}

/**
 * Trie les notifications par priorité puis par date
 */
export function sortNotifications(notifications: NotificationV2[]): NotificationV2[] {
  const priorityOrder = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3
  };

  return [...notifications].sort((a, b) => {
    // Trier par priorité d'abord
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // Puis par date (plus récent d'abord)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Groupe les notifications par conversation
 */
export function groupNotificationsByConversation(
  notifications: NotificationV2[]
): Map<string, NotificationV2[]> {
  const groups = new Map<string, NotificationV2[]>();

  notifications.forEach(notification => {
    const conversationId = notification.context?.conversationId || 'other';
    const existing = groups.get(conversationId) || [];
    groups.set(conversationId, [...existing, notification]);
  });

  return groups;
}

/**
 * Groupe les notifications par type
 */
export function groupNotificationsByType(
  notifications: NotificationV2[]
): Map<NotificationType, NotificationV2[]> {
  const groups = new Map<NotificationType, NotificationV2[]>();

  notifications.forEach(notification => {
    const existing = groups.get(notification.type) || [];
    groups.set(notification.type, [...existing, notification]);
  });

  return groups;
}
