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
  UserPlus
} from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { notificationService } from '@/services/notification.service';
import { NotificationTest } from '@/components/notifications/NotificationTest';
import type { Notification } from '@/services/notification.service';

export default function NotificationsPage() {
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
  
  // Les préférences seront gérées dans une version future

  // Les notifications sont maintenant gérées par le hook useNotifications
  // Plus besoin de charger manuellement

  // Les actions sont maintenant gérées par le hook useNotifications

  // Les préférences seront gérées par le nouveau système

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
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

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'MESSAGE_RECEIVED':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'USER_JOINED':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'USER_LEFT':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'CONVERSATION_CREATED':
        return 'bg-purple-500/10 text-purple-700 border-purple-200';
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

    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `${diffMinutes} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
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
    <DashboardLayout title="Notifications">
      <div className="max-w-4xl mx-auto">
        {/* Header avec actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600 mt-1">
              {unreadCount > 0 
                ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''} sur ${totalCount}`
                : totalCount > 0 
                  ? `${totalCount} notification${totalCount > 1 ? 's' : ''} (toutes lues)`
                  : 'Aucune notification'
              }
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log('Préférences - à implémenter')}
              className="hidden sm:flex"
            >
              <Settings className="h-4 w-4 mr-2" />
              Préférences
            </Button>
            
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="flex items-center space-x-2"
              >
                <CheckCheck className="h-4 w-4" />
                <span>Tout marquer</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications List */}
          <div className="lg:col-span-2">
            {totalCount === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <BellOff className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Aucune notification
                  </h3>
                  <p className="text-gray-600 text-center max-w-sm">
                    Vous êtes à jour ! Toutes vos notifications ont été lues.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Card key={notification.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {notification.title}
                              </h4>
                              <Badge variant="secondary" className="text-xs">
                                {notification.type.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            <p className="text-gray-600 text-sm mb-2">
                              {notification.message}
                            </p>
                            
                            <p className="text-xs text-gray-400">
                              {formatNotificationTime(notification.timestamp)}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Statut du Système</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Service de notifications</span>
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Notifications totales</span>
                  <Badge variant="secondary">{totalCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Non lues</span>
                  <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>{unreadCount}</Badge>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <NotificationTest />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
