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
import { notificationsService, type Notification, type NotificationPreferences } from '@/services';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    loadNotifications();
    loadPreferences();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await notificationsService.getNotifications();
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
      console.log('Impossible de charger les notifications');
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await notificationsService.getPreferences();
      setPreferences(response.data.preferences);
    } catch (error) {
      console.error('Erreur lors du chargement des préférences:', error);
      console.log('Impossible de charger les préférences');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationsService.markAsRead(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      console.log('Notification marquée comme lue');
    } catch (error) {
      console.error('Erreur lors du marquage:', error);
      console.log('Impossible de marquer la notification');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      setNotifications([]);
      console.log('Toutes les notifications ont été marquées comme lues');
    } catch (error) {
      console.error('Erreur lors du marquage global:', error);
      console.log('Impossible de marquer toutes les notifications');
    }
  };

  const updatePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    if (!preferences) return;

    try {
      const response = await notificationsService.updatePreferences(newPreferences);
      setPreferences(response.data.preferences);
      console.log('Préférences mises à jour');
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences:', error);
      console.log('Impossible de mettre à jour les préférences');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE_RECEIVED':
        return <MessageSquare className="h-4 w-4" />;
      case 'USER_JOINED':
      case 'USER_LEFT':
        return <Users className="h-4 w-4" />;
      case 'CONVERSATION_CREATED':
        return <UserPlus className="h-4 w-4" />;
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

  const formatNotificationTime = (createdAt: string) => {
    const date = new Date(createdAt);
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

  if (loading) {
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
              {notifications.length > 0 
                ? `${notifications.length} notification${notifications.length > 1 ? 's' : ''} non lue${notifications.length > 1 ? 's' : ''}`
                : 'Aucune notification'
              }
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreferences(!showPreferences)}
              className="hidden sm:flex"
            >
              <Settings className="h-4 w-4 mr-2" />
              Préférences
            </Button>
            
            {notifications.length > 0 && (
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
            {notifications.length === 0 ? (
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
                              {formatNotificationTime(notification.createdAt)}
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

          {/* Preferences Panel */}
          <div className={`space-y-6 ${showPreferences ? 'block' : 'hidden lg:block'}`}>
            {preferences && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Préférences</span>
                  </CardTitle>
                  <CardDescription>
                    Gérez vos préférences de notification
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* General Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="push-enabled" className="text-sm font-medium">
                        Notifications push
                      </Label>
                      <Switch
                        id="push-enabled"
                        checked={preferences.pushEnabled}
                        onCheckedChange={(checked) => 
                          updatePreferences({ pushEnabled: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-enabled" className="text-sm font-medium">
                        Notifications email
                      </Label>
                      <Switch
                        id="email-enabled"
                        checked={preferences.emailEnabled}
                        onCheckedChange={(checked) => 
                          updatePreferences({ emailEnabled: checked })
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Type-specific Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Types de notifications</h4>
                    
                    {Object.entries(preferences.types).map(([type, enabled]) => (
                      <div key={type} className="flex items-center justify-between">
                        <Label className="text-sm">
                          {type.replace('_', ' ').toLowerCase()}
                        </Label>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) => 
                            updatePreferences({
                              types: { ...preferences.types, [type]: checked }
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => {
                    try {
                      await notificationsService.sendTestNotification();
                      console.log('Notification test envoyée');
                      loadNotifications();
                    } catch {
                      console.log('Erreur lors de l\'envoi');
                    }
                  }}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Test de notification
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
