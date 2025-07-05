import { Controller, Get, Post, Body, Param, UseGuards, Request, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService, NotificationType, UserNotificationPreferences } from './notification.service';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * Récupère les notifications de l'utilisateur connecté
   */
  @Get()
  getUserNotifications(@Request() req: AuthenticatedRequest) {
    const notifications = this.notificationService.getUserNotifications(req.user.id);
    
    return {
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Marque une notification comme lue
   */
  @Delete(':notificationId')
  markAsRead(
    @Param('notificationId') notificationId: string,
    @Request() req: AuthenticatedRequest
  ) {
    const success = this.notificationService.markAsRead(req.user.id, notificationId);
    
    return {
      success,
      message: success ? 'Notification marked as read' : 'Notification not found',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Marque toutes les notifications comme lues
   */
  @Delete()
  markAllAsRead(@Request() req: AuthenticatedRequest) {
    const count = this.notificationService.markAllAsRead(req.user.id);
    
    return {
      success: true,
      message: `${count} notifications marked as read`,
      count,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Récupère les préférences de notification
   */
  @Get('preferences')
  async getPreferences(@Request() req: AuthenticatedRequest) {
    // Utilisation d'une méthode publique accessible
    return {
      preferences: await this.getUserPreferencesPublic(req.user.id),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Met à jour les préférences de notification
   */
  @Post('preferences')
  async updatePreferences(
    @Body() preferences: Partial<UserNotificationPreferences>,
    @Request() req: AuthenticatedRequest
  ) {
    const updatedPreferences = await this.notificationService.updateUserPreferences(
      req.user.id,
      preferences
    );

    return {
      success: true,
      preferences: updatedPreferences,
      message: 'Preferences updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Envoie une notification test (pour debug/développement)
   */
  @Post('test')
  async sendTestNotification(@Request() req: AuthenticatedRequest) {
    const notification = this.notificationService.createNotification(
      NotificationType.MESSAGE_RECEIVED,
      'Test Notification',
      'This is a test notification from the system',
      { source: 'test', userId: req.user.id }
    );

    await this.notificationService.sendToUser(req.user.id, notification);

    return {
      success: true,
      notification,
      message: 'Test notification sent',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Récupère les statistiques des notifications (admin uniquement pour l'instant)
   */
  @Get('stats')
  getNotificationStats() {
    const stats = this.notificationService.getStats();
    
    return {
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Méthode publique pour récupérer les préférences utilisateur
   * Workaround pour les méthodes privées du service
   */
  private async getUserPreferencesPublic(userId: string): Promise<UserNotificationPreferences> {
    // Préférences par défaut si pas de service spécifique
    return {
      userId,
      pushEnabled: true,
      emailEnabled: false,
      types: {
        [NotificationType.MESSAGE_RECEIVED]: true,
        [NotificationType.USER_JOINED]: true,
        [NotificationType.USER_LEFT]: false,
        [NotificationType.CONVERSATION_CREATED]: true,
        [NotificationType.CONVERSATION_UPDATED]: false,
        [NotificationType.TYPING_START]: false,
        [NotificationType.TYPING_STOP]: false,
        [NotificationType.USER_ONLINE]: false,
        [NotificationType.USER_OFFLINE]: false,
      },
    };
  }
}
