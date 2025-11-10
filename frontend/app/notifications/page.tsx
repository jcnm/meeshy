'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Settings,
  MessageSquare,
  PhoneMissed,
  Trash2,
  Search,
  X,
  Filter
} from '@/lib/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationTest } from '@/components/notifications/NotificationTest';
import { useI18n } from '@/hooks/useI18n';
import type { Notification } from '@/services/notification.service';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { NotificationFilters, type NotificationType } from '@/components/notifications/NotificationFilters';
import { cn } from '@/lib/utils';

function NotificationsPageContent() {
  const { t } = useI18n('notifications');
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<NotificationType>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Filtrer et rechercher dans les notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Filtrer par type
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(n => n.type === selectedFilter);
    }

    // Filtrer par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(n => {
        const title = (n.title || '').toLowerCase();
        const message = (n.message || '').toLowerCase();
        const preview = (n.messagePreview || '').toLowerCase();
        const senderName = (n.senderName || n.senderUsername || '').toLowerCase();

        return title.includes(query) ||
               message.includes(query) ||
               preview.includes(query) ||
               senderName.includes(query);
      });
    }

    return filtered;
  }, [notifications, selectedFilter, searchQuery]);

  // Calculer les compteurs par type
  const typeCounts = useMemo(() => ({
    all: notifications.length,
    new_message: notifications.filter(n => n.type === 'new_message' || n.type === 'message').length,
    missed_call: notifications.filter(n => n.type === 'missed_call').length,
    system: notifications.filter(n => n.type === 'system').length,
    conversation: notifications.filter(n => n.type === 'conversation').length,
  }), [notifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
      case 'new_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'missed_call':
        return <PhoneMissed className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Marquer comme lue
    markAsRead(notification.id);

    // Naviguer vers la destination avec ancre #message-{messageId}
    if (notification.conversationId) {
      if (notification.messageId) {
        // Construire l'URL avec ancre : /conversations/{conversationId}?messageId={messageId}#message-{messageId}
        router.push(`/conversations/${notification.conversationId}?messageId=${notification.messageId}#message-${notification.messageId}`);
      } else {
        router.push(`/conversations/${notification.conversationId}`);
      }
    } else if (notification.callSessionId && notification.conversationId) {
      router.push(`/conversations/${notification.conversationId}`);
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    return t(`types.${type}`) || type.replace('_', ' ');
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message':
      case 'new_message':
        return 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-800';
      case 'missed_call':
        return 'bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-800';
      case 'system':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-800';
      case 'conversation':
        return 'bg-purple-500/10 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-800';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-800';
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

    // Remplacer manuellement le placeholder {count}
    if (diffMinutes < 60) {
      const template = t('timeAgo.minute');
      return template.replace('{count}', diffMinutes.toString());
    }

    if (diffHours < 24) {
      const template = t('timeAgo.hour');
      return template.replace('{count}', diffHours.toString());
    }

    if (diffDays < 7) {
      const template = t('timeAgo.day');
      return template.replace('{count}', diffDays.toString());
    }

    // Pour les dates plus anciennes, utiliser un format court
    const day = date.toLocaleDateString('fr-FR', { day: 'numeric' });
    const month = date.toLocaleDateString('fr-FR', { month: 'short' });
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    // N'afficher l'année que si différente de l'année en cours
    return currentYear === year ? `${day} ${month}` : `${day} ${month} ${year}`;
  };

  const getUnreadCountMessage = () => {
    if (unreadCount > 0) {
      const key = unreadCount === 1 ? 'unreadCount.single' : 'unreadCount.plural';
      const template = t(key);
      return template
        .replace('{count}', unreadCount.toString())
        .replace('{total}', totalCount.toString());
    } else if (totalCount > 0) {
      const plural = totalCount > 1 ? 's' : '';
      const template = t('unreadCount.allRead');
      return template
        .replace('{total}', totalCount.toString())
        .replace('{plural}', plural);
    } else {
      return t('unreadCount.empty');
    }
  };

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="h-full flex flex-col">
        {/* Header avec actions - responsive */}
        <div className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">
                    {t('pageTitle')}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getUnreadCountMessage()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/notifications/preferences')}
                    className="hidden sm:flex"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {t('preferences')}
                  </Button>

                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAsRead}
                      className="flex items-center gap-2"
                    >
                      <CheckCheck className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('markAllRead')}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Barre de recherche - toujours visible */}
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search')}
                  className="pl-9 pr-9 h-10 w-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filtres par type - responsive */}
              <div className="mt-4">
                <NotificationFilters
                  selectedType={selectedFilter}
                  onTypeChange={setSelectedFilter}
                  counts={typeCounts}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contenu principal scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Liste des notifications - 3 colonnes sur large écran */}
              <div className="lg:col-span-3">
                {totalCount === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 sm:py-24">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                        <BellOff className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {t('empty.title')}
                      </h3>
                      <p className="text-muted-foreground text-center max-w-sm text-sm sm:text-base">
                        {t('empty.description')}
                      </p>
                    </CardContent>
                  </Card>
                ) : filteredNotifications.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 sm:py-24">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-center text-sm sm:text-base">
                        {t('noResults')}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {filteredNotifications.map((notification) => (
                      <Card
                        key={notification.id}
                        className={cn(
                          "hover:shadow-md transition-all cursor-pointer border",
                          !notification.isRead && "border-l-4 border-l-primary bg-accent/5"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-start gap-3">
                            {/* Avatar ou icône */}
                            {notification.senderAvatar || notification.senderId ? (
                              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                                <AvatarImage src={notification.senderAvatar} alt={notification.senderUsername || 'User'} />
                                <AvatarFallback className="text-xs sm:text-sm">
                                  {(notification.senderUsername || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className={cn(
                                "p-2 sm:p-2.5 rounded-full flex-shrink-0",
                                getNotificationColor(notification.type)
                              )}>
                                {getNotificationIcon(notification.type)}
                              </div>
                            )}

                            {/* Contenu */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <h4 className={cn(
                                    "text-sm truncate",
                                    !notification.isRead ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground'
                                  )}>
                                    {notification.title}
                                  </h4>
                                  {!notification.isRead && (
                                    <span className="inline-block w-2 h-2 bg-primary rounded-full flex-shrink-0"></span>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-xs flex-shrink-0 hidden sm:inline-flex">
                                  {getNotificationTypeLabel(notification.type)}
                                </Badge>
                              </div>

                              {/* Message preview */}
                              <p className={cn(
                                "text-sm mb-2 line-clamp-2",
                                !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                              )}>
                                {notification.messagePreview || notification.message}
                              </p>

                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  {formatNotificationTime(notification.timestamp)}
                                </p>

                                {/* Actions - visibles sur hover desktop, toujours visibles sur mobile */}
                                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  {!notification.isRead && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markAsRead(notification.id);
                                      }}
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                      title={t('actions.markAsRead')}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeNotification(notification.id);
                                    }}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                    title={t('actions.delete')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar - cachée sur mobile, visible sur large écran */}
              <div className="hidden lg:block space-y-6">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">{t('systemStatus')}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('service')}</span>
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        isConnected ? 'bg-green-500' : 'bg-red-500'
                      )} />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('totalNotifications')}</span>
                      <Badge variant="secondary">{totalCount}</Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('unread')}</span>
                      <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>
                        {unreadCount}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                {process.env.NODE_ENV === 'development' && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-3">{t('quickActions')}</h3>
                      <NotificationTest />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
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
