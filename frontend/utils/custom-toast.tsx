/**
 * Custom toast notifications avec avatars et positions adaptatives
 * - Top-right sur desktop
 * - Top sur mobile
 * - Support des avatars pour les messages utilisateur
 * - Design moderne avec animations
 */

import { toast as sonnerToast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Bell, UserPlus, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { Notification } from '@/services/notification.service';

export interface CustomToastOptions {
  title: string;
  message: string;
  avatar?: string;
  senderName?: string;
  type?: 'message' | 'mention' | 'system' | 'success' | 'error' | 'info' | 'new_conversation';
  onClick?: () => void;
}

/**
 * Obtient les initiales d'un nom
 */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Obtient l'icône selon le type de notification
 */
function getIcon(type: string) {
  switch (type) {
    case 'message':
    case 'new_message':
      return <MessageCircle className="w-5 h-5 text-blue-500" />;
    case 'mention':
      return <MessageCircle className="w-5 h-5 text-orange-500" />;
    case 'new_conversation':
      return <UserPlus className="w-5 h-5 text-green-500" />;
    case 'system':
      return <Bell className="w-5 h-5 text-gray-500" />;
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
}

/**
 * Obtient la couleur de bordure selon le type
 */
function getBorderColor(type: string): string {
  switch (type) {
    case 'message':
    case 'new_message':
      return 'border-l-blue-500';
    case 'mention':
      return 'border-l-orange-500';
    case 'new_conversation':
      return 'border-l-green-500';
    case 'success':
      return 'border-l-green-500';
    case 'error':
      return 'border-l-red-500';
    case 'info':
      return 'border-l-blue-500';
    case 'system':
    default:
      return 'border-l-gray-500';
  }
}

/**
 * Toast fonctionnel simple (success/error/info)
 * Design épuré pour les notifications de développement
 */
function showFunctionalToast(type: 'success' | 'error' | 'info', title: string, message?: string) {
  const configs = {
    success: {
      bgClass: 'bg-green-500',
      icon: <CheckCircle className="w-4 h-4 text-white" />,
      textClass: 'text-white',
    },
    error: {
      bgClass: 'bg-red-500',
      icon: <AlertCircle className="w-4 h-4 text-white" />,
      textClass: 'text-white',
    },
    info: {
      bgClass: 'bg-blue-500',
      icon: <Info className="w-4 h-4 text-white" />,
      textClass: 'text-white',
    },
  };

  const config = configs[type];

  const ToastContent = (
    <div className={`flex items-center gap-2 px-3 py-2 ${config.bgClass} rounded-md shadow-md max-w-[280px]`}>
      {config.icon}
      <span className={`text-sm font-medium ${config.textClass} truncate`}>
        {title}
      </span>
    </div>
  );

  sonnerToast.custom(() => ToastContent, {
    duration: 3000,
    position: 'top-right',
  });
}

/**
 * Toast notification métier riche (avec avatar)
 */
export function showCustomToast(options: CustomToastOptions) {
  const { title, message, avatar, senderName, type = 'message', onClick } = options;

  const hasAvatar = !!avatar || !!senderName;
  const borderColor = getBorderColor(type);

  // Composant personnalisé du toast
  const ToastContent = (
    <div
      className={`flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 ${borderColor} cursor-pointer hover:shadow-xl transition-shadow duration-200 min-w-[320px] max-w-[420px]`}
      onClick={onClick}
    >
      {/* Avatar ou Icon */}
      {hasAvatar ? (
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={avatar} alt={senderName || 'User'} />
          <AvatarFallback className="text-sm font-medium bg-gradient-to-br from-blue-500 to-purple-500 text-white">
            {getInitials(senderName || 'U')}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          {getIcon(type)}
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </p>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
          {message}
        </p>
      </div>
    </div>
  );

  // Afficher le toast avec Sonner
  sonnerToast.custom(() => ToastContent, {
    duration: 5000,
    position: 'top-right', // Sera overridé par le layout
  });
}

/**
 * Toast de message utilisateur
 */
export function showMessageToast(notification: Notification) {
  showCustomToast({
    title: notification.senderName || notification.senderUsername || 'Nouveau message',
    message: notification.messagePreview || notification.message || 'Vous avez un nouveau message',
    avatar: notification.senderAvatar,
    senderName: notification.senderName || notification.senderUsername,
    type: 'message',
    onClick: () => {
      // Navigation vers la conversation
      if (notification.conversationId) {
        window.location.href = `/conversations/${notification.conversationId}`;
      }
    },
  });
}

/**
 * Toast de mention
 */
export function showMentionToast(notification: Notification) {
  showCustomToast({
    title: `${notification.senderName || 'Quelqu\'un'} vous a mentionné`,
    message: notification.messagePreview || notification.message || '',
    avatar: notification.senderAvatar,
    senderName: notification.senderName || notification.senderUsername,
    type: 'mention',
    onClick: () => {
      if (notification.conversationId && notification.messageId) {
        window.location.href = `/conversations/${notification.conversationId}?messageId=${notification.messageId}`;
      }
    },
  });
}

/**
 * Toast de nouvelle conversation
 */
export function showNewConversationToast(notification: Notification) {
  showCustomToast({
    title: notification.title || 'Nouvelle conversation',
    message: notification.message || `${notification.senderName || 'Quelqu\'un'} a démarré une conversation`,
    avatar: notification.senderAvatar,
    senderName: notification.senderName || notification.senderUsername,
    type: 'new_conversation',
    onClick: () => {
      if (notification.conversationId) {
        window.location.href = `/conversations/${notification.conversationId}`;
      }
    },
  });
}

/**
 * Toast système
 */
export function showSystemToast(notification: Notification) {
  showCustomToast({
    title: notification.title || 'Notification système',
    message: notification.message || '',
    type: 'system',
  });
}

/**
 * Toast générique basé sur le type de notification
 */
export function showNotificationToast(notification: Notification) {
  switch (notification.type) {
    case 'new_message':
    case 'message':
      showMessageToast(notification);
      break;
    case 'new_conversation':
      showNewConversationToast(notification);
      break;
    case 'system':
    case 'missed_call':
      showSystemToast(notification);
      break;
    default:
      // Mention ou autres types
      if (notification.message.includes('@')) {
        showMentionToast(notification);
      } else {
        showMessageToast(notification);
      }
  }
}

/**
 * Toast simple pour succès (fonctionnel, épuré)
 */
export function showSuccessToast(title: string, message?: string) {
  showFunctionalToast('success', message ? `${title}: ${message}` : title);
}

/**
 * Toast simple pour erreur (fonctionnel, épuré)
 */
export function showErrorToast(title: string, message?: string) {
  showFunctionalToast('error', message ? `${title}: ${message}` : title);
}

/**
 * Toast simple pour info (fonctionnel, épuré)
 */
export function showInfoToast(title: string, message?: string) {
  showFunctionalToast('info', message ? `${title}: ${message}` : title);
}
