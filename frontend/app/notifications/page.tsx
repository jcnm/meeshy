'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Settings,
  MessageSquare,
  Users,
  UserPlus,
  PhoneMissed,
  Trash2
} from '@/lib/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/use-notifications';
import { notificationService } from '@/services/notification.service';
import { NotificationTest } from '@/components/notifications/NotificationTest';
import { useI18n } from '@/hooks/useI18n';
import type { Notification } from '@/services/notification.service';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { NotificationFilters, type NotificationType } from '@/components/notifications/NotificationFilters';

function NotificationsPageContent() {
  const { t } = useI18n('notifications');
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<NotificationType>('all');
  const {
    notifications,
    unreadNotifications,
    unreadCount,
    totalCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    isConnected
  } = useNotifications();

  // Filtrer les notifications selon le type sélectionné
  const filteredNotifications = selectedFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === selectedFilter);

  // Calculer les compteurs par type
  const typeCounts = {
    all: notifications.length,
    new_message: notifications.filter(n => n.type === 'new_message').length,
    missed_call: notifications.filter(n => n.type === 'missed_call').length,
    system: notifications.filter(n => n.type === 'system').length,
    conversation: notifications.filter(n => n.type === 'conversation').length,
  };
  
  // Les préférences seront gérées dans une version future

  // Les notifications sont maintenant gérées par le hook useNotifications
  // Plus besoin de charger manuellement

  // Les actions sont maintenant gérées par le hook useNotifications

  // Les préférences seront gérées par le nouveau système

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
      case 'new_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'missed_call':
        return <PhoneMissed className="h-4 w-4" />;
      case 'conversation':
        return <Users className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      case 'translation':
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Marquer comme lue
    markAsRead(notification.id);

    // Naviguer vers la destination
    if (notification.conversationId) {
      // Si c'est une notification de message avec un messageId, naviguer vers le message spécifique
      if (notification.messageId) {
        router.push(`/conversations/${notification.conversationId}?messageId=${notification.messageId}`);
      } else {
        // Sinon, juste naviguer vers la conversation
        router.push(`/conversations/${notification.conversationId}`);
      }
    } else if (notification.callSessionId) {
      // Pour les appels manqués, naviguer vers la conversation
      if (notification.conversationId) {
        router.push(`/conversations/${notification.conversationId}`);
      }
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    return t(`notifications.types.${type}`) || type.replace('_', ' ');
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message':
      case 'new_message':
      case 'MESSAGE_RECEIVED':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'missed_call':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'USER_JOINED':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'USER_LEFT':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'CONVERSATION_CREATED':
        return 'bg-purple-500/10 text-purple-700 border-purple-200';
      case 'system':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const formatNotificationTime = (timestamp: Date) => {
    const date = timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return t('timeAgo.now');
    if (diffMinutes < 60) return t('timeAgo.minute', { count: diffMinutes });
    if (diffHours < 24) return t('timeAgo.hour', { count: diffHours });
    if (diffDays < 7) return t('timeAgo.day', { count: diffDays });
    return date.toLocaleDateString();
  };

  const getUnreadCountMessage = () => {
    if (unreadCount > 0) {
      const key = unreadCount === 1 ? 'notifications.unreadCount.single' : 'notifications.unreadCount.plural';
      return t(key, { count: unreadCount, total: totalCount });
    } else if (totalCount > 0) {
      const plural = totalCount > 1 ? 's' : '';
      return t('unreadCount.allRead', { total: totalCount, plural });
    } else {
      return t('unreadCount.empty');
    }
  };

  if (false) { // loading supprimé
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4 mb-8">
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="max-w-4xl mx-auto">
        {/* Header avec actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('pageTitle')}</h1>
            <p className="text-gray-600 mt-1">
              {getUnreadCountMessage()}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="flex items-center space-x-2"
              >
                <CheckCheck className="h-4 w-4" />
                <span>{t('markAllRead')}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filtres par type */}
        <NotificationFilters
          selectedType={selectedFilter}
          onTypeChange={setSelectedFilter}
          counts={typeCounts}
        />

        <div className="w-full">
          {/* Notifications List */}
          <div className="w-full">
            {totalCount === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <BellOff className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t('empty.title')}
                  </h3>
                  <p className="text-gray-600 text-center max-w-sm">
                    {t('empty.description')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <p className="text-gray-600">Aucune notification de ce type</p>
                    </CardContent>
                  </Card>
                ) : filteredNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`hover:shadow-md transition-shadow cursor-pointer ${!notification.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        {/* Avatar de l'expéditeur */}
                        {notification.senderAvatar || notification.senderId ? (
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={notification.senderAvatar} alt={notification.senderUsername || 'User'} />
                            <AvatarFallback>
                              {(notification.senderUsername || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                        )}

                        {/* Contenu de la notification */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className={`text-sm truncate ${!notification.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                              {notification.title}
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {getNotificationTypeLabel(notification.type)}
                            </Badge>
                            {!notification.isRead && (
                              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                          </div>

                          {/* Aperçu du message ou contenu */}
                          <p className={`text-sm mb-2 ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                            {notification.messagePreview || notification.message}
                          </p>

                          <p className="text-xs text-gray-400">
                            {formatNotificationTime(notification.timestamp)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                              title="Marquer comme lu"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            className="text-gray-400 hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationsPageContent />
    </AuthGuard>
  );
}
