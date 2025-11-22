/**
 * Composant NotificationItem v2
 * Affiche une notification avec formatage contextuel selon le type
 */

'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X, Check, Phone, UserPlus, MessageSquare } from 'lucide-react';
import type { NotificationItemProps } from '@/types/notification-v2';
import { NotificationType } from '@/types/notification-v2';
import {
  getNotificationIcon,
  formatNotificationContext,
  formatMessagePreview,
  getNotificationLink,
  requiresUserAction
} from '@/utils/notification-formatters';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

/**
 * Composant NotificationItem
 */
export function NotificationItem({
  notification,
  onRead,
  onDelete,
  onClick,
  showActions = true,
  compact = false
}: NotificationItemProps) {
  const router = useRouter();
  const icon = getNotificationIcon(notification);
  const context = formatNotificationContext(notification);
  const link = getNotificationLink(notification);
  const needsAction = requiresUserAction(notification);

  /**
   * Gère le clic sur la notification
   */
  const handleClick = () => {
    if (onClick) {
      onClick(notification);
    } else if (link) {
      // Marquer comme lue avant la navigation
      if (!notification.isRead && onRead) {
        onRead(notification.id);
      }
      router.push(link);
    }
  };

  /**
   * Gère le clic sur "Marquer comme lu"
   */
  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRead?.(notification.id);
  };

  /**
   * Gère le clic sur "Supprimer"
   */
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(notification.id);
  };

  /**
   * Rendu des actions rapides pour certains types de notifications
   */
  const renderQuickActions = () => {
    if (!showActions) return null;

    switch (notification.type) {
      case NotificationType.CONTACT_REQUEST:
        return (
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implémenter l'acceptation de contact
                console.log('Accept contact request:', notification.id);
              }}
              className="flex-1"
            >
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implémenter le refus de contact
                console.log('Decline contact request:', notification.id);
              }}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" />
              Decline
            </Button>
          </div>
        );

      case NotificationType.MISSED_CALL:
        return (
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                if (notification.context?.conversationId) {
                  router.push(`/chat/${notification.context.conversationId}?action=call`);
                }
              }}
              className="flex-1"
            >
              <Phone className="w-4 h-4 mr-1" />
              Call Back
            </Button>
          </div>
        );

      case NotificationType.NEW_CONVERSATION_GROUP:
        if (!notification.metadata?.isMember) {
          return (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  if (notification.context?.conversationId) {
                    router.push(`/join/${notification.context.conversationId}`);
                  }
                }}
                className="flex-1"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Join
              </Button>
            </div>
          );
        }
        break;
    }

    return null;
  };

  /**
   * Rendu du contenu principal de la notification
   */
  const renderContent = () => {
    // Pour les messages avec aperçu d'attachment
    if (notification.metadata?.attachments) {
      return (
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
          {formatMessagePreview(
            notification.content,
            notification.metadata.attachments
          )}
        </p>
      );
    }

    // Contenu texte normal
    return (
      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
        {notification.content}
      </p>
    );
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex gap-3 p-4 transition-colors cursor-pointer',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        !notification.isRead && 'bg-blue-50/50 dark:bg-blue-900/10',
        compact && 'p-3'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {/* Badge non lu */}
      {!notification.isRead && (
        <div className="absolute top-4 left-2 w-2 h-2 bg-blue-600 rounded-full" />
      )}

      {/* Icône ou Avatar */}
      <div className="flex-shrink-0">
        {notification.sender?.avatar ? (
          <Avatar className={cn('w-10 h-10', compact && 'w-8 h-8')}>
            <AvatarImage src={notification.sender.avatar} alt={notification.sender.username} />
            <AvatarFallback>
              {notification.sender.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div
            className={cn(
              'flex items-center justify-center rounded-full',
              'w-10 h-10 text-lg',
              compact && 'w-8 h-8 text-base',
              icon.bgColor,
              icon.color
            )}
          >
            {icon.emoji}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        {/* Titre */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className={cn(
            'font-medium text-gray-900 dark:text-white line-clamp-1',
            compact ? 'text-sm' : 'text-base'
          )}>
            {notification.title}
          </h4>

          {/* Badge de priorité */}
          {notification.priority === 'urgent' && (
            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold text-red-700 bg-red-100 rounded-full dark:bg-red-900 dark:text-red-200">
              Urgent
            </span>
          )}
          {notification.priority === 'high' && (
            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full dark:bg-orange-900 dark:text-orange-200">
              Important
            </span>
          )}
        </div>

        {/* Contenu */}
        {renderContent()}

        {/* Contexte (timestamp + conversation) */}
        {context && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {context}
          </p>
        )}

        {/* Actions rapides */}
        {renderQuickActions()}
      </div>

      {/* Actions de la notification */}
      {showActions && (
        <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.isRead && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleMarkAsRead}
              className="h-8 w-8"
              title="Mark as read"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Indicateur cliquable */}
      {link && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageSquare className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationItem;
