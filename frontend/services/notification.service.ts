/**
 * Service de gestion des notifications
 * Centralise toutes les notifications (messages, système, etc.)
 */

import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '@/lib/config';

export interface Notification {
  id: string;
  type: 'message' | 'system' | 'user_action' | 'conversation' | 'translation' | 'new_message' | 'missed_call';
  title: string;
  message: string;
  data?: any;
  conversationId?: string;
  messageId?: string;
  callSessionId?: string;
  senderId?: string;
  senderName?: string;
  senderUsername?: string;
  senderAvatar?: string;
  messagePreview?: string;
  timestamp: Date;
  isRead: boolean;
  translations?: {
    fr?: string;
    en?: string;
    es?: string;
  };
}

export interface NotificationCounts {
  total: number;
  unread: number;
  byType: {
    message: number;
    system: number;
    user_action: number;
    conversation: number;
    translation: number;
  };
}

export interface NotificationServiceConfig {
  token: string;
  userId: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onNotificationReceived?: (notification: Notification) => void;
  onCountsUpdated?: (counts: NotificationCounts) => void;
}

export class NotificationService {
  private static instance: NotificationService;
  private socket: Socket | null = null;
  private isConnected = false;
  private config: NotificationServiceConfig | null = null;
  private notifications: Map<string, Notification> = new Map();
  private counts: NotificationCounts = {
    total: 0,
    unread: 0,
    byType: {
      message: 0,
      system: 0,
      user_action: 0,
      conversation: 0,
      translation: 0
    }
  };

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialise le service de notifications
   */
  public async initialize(config: NotificationServiceConfig): Promise<void> {
    if (this.isConnected) {
      console.log('🔔 Service de notifications déjà connecté');
      return;
    }

    this.config = config;
    
    try {
      this.socket = io(APP_CONFIG.getBackendUrl(), {
        auth: { token: config.token },
        transports: ['websocket'],
        autoConnect: true,
      });

      this.setupEventListeners();
      
      console.log('🔔 Service de notifications initialisé');
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du service de notifications:', error);
      config.onError?.(error as Error);
    }
  }

  /**
   * Configure les écouteurs d'événements
   */
  private setupEventListeners(): void {
    if (!this.socket || !this.config) return;

    this.socket.on('connect', () => {
      console.log('🔔 Connecté au service de notifications');
      this.isConnected = true;
      this.config?.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      console.log('🔔 Déconnecté du service de notifications');
      this.isConnected = false;
      this.config?.onDisconnect?.();
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Erreur de connexion aux notifications:', error);
      this.config?.onError?.(error);
    });

    // Événement générique pour toutes les notifications (nouveau système)
    this.socket.on('notification', (data: any) => {
      this.handleGenericNotification(data);
    });

    // Événement pour les notifications de messages
    this.socket.on('newMessageNotification', (data: any) => {
      this.handleMessageNotification(data);
    });

    // Événement pour les notifications système
    this.socket.on('systemNotification', (data: any) => {
      this.handleSystemNotification(data);
    });

    // Événement pour les notifications de conversation
    this.socket.on('conversationNotification', (data: any) => {
      this.handleConversationNotification(data);
    });

    // Événement pour les notifications de traduction
    this.socket.on('translationNotification', (data: any) => {
      this.handleTranslationNotification(data);
    });

    // Événement pour les mises à jour de compteurs
    this.socket.on('notificationCountsUpdate', (data: any) => {
      this.updateCounts(data);
    });
  }

  /**
   * Traite une notification générique (nouveau système avec avatar et preview)
   */
  private handleGenericNotification(data: any): void {
    console.log('📢 Notification générique reçue:', data);

    const notification: Notification = {
      id: data.id,
      type: data.type,
      title: data.title,
      message: data.content || data.message,
      data: data.data,
      conversationId: data.conversationId,
      messageId: data.messageId,
      callSessionId: data.callSessionId,
      senderId: data.senderId,
      senderName: data.senderUsername,
      senderUsername: data.senderUsername,
      senderAvatar: data.senderAvatar,
      messagePreview: data.messagePreview,
      timestamp: new Date(data.createdAt || Date.now()),
      isRead: data.isRead || false,
      translations: data.translations
    };

    this.addNotification(notification);
  }

  /**
   * Traite une notification de message
   */
  private handleMessageNotification(data: any): void {
    const notification: Notification = {
      id: `msg-${data.messageId}`,
      type: 'message',
      title: this.getNotificationTitle('message', data.conversationType, data.senderName),
      message: this.buildMultilingualMessage(data.content, data.translations),
      data: {
        messageId: data.messageId,
        conversationId: data.conversationId,
        conversationType: data.conversationType,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        translations: data.translations
      },
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderName: data.senderName,
      timestamp: new Date(data.timestamp),
      isRead: false,
      translations: data.translations
    };

    this.addNotification(notification);
  }

  /**
   * Traite une notification système
   */
  private handleSystemNotification(data: any): void {
    const notification: Notification = {
      id: `sys-${Date.now()}`,
      type: 'system',
      title: data.title || 'Notification système',
      message: data.message || '',
      data: data,
      timestamp: new Date(),
      isRead: false
    };

    this.addNotification(notification);
  }

  /**
   * Traite une notification de conversation
   */
  private handleConversationNotification(data: any): void {
    const notification: Notification = {
      id: `conv-${data.conversationId}-${data.type}`,
      type: 'conversation',
      title: this.getConversationNotificationTitle(data),
      message: data.message || '',
      data: data,
      conversationId: data.conversationId,
      timestamp: new Date(),
      isRead: false
    };

    this.addNotification(notification);
  }

  /**
   * Traite une notification de traduction
   */
  private handleTranslationNotification(data: any): void {
    const notification: Notification = {
      id: `trans-${data.messageId}`,
      type: 'translation',
      title: 'Traduction disponible',
      message: this.buildMultilingualMessage(data.content, data.translations),
      data: data,
      conversationId: data.conversationId,
      timestamp: new Date(),
      isRead: false,
      translations: data.translations
    };

    this.addNotification(notification);
  }

  /**
   * Ajoute une notification et met à jour les compteurs
   */
  private addNotification(notification: Notification): void {
    this.notifications.set(notification.id, notification);
    this.updateCountsFromNotifications();
    this.config?.onNotificationReceived?.(notification);
  }

  /**
   * Met à jour les compteurs à partir des notifications
   */
  private updateCountsFromNotifications(): void {
    const notifications = Array.from(this.notifications.values());
    
    this.counts = {
      total: notifications.length,
      unread: notifications.filter(n => !n.isRead).length,
      byType: {
        message: notifications.filter(n => n.type === 'message').length,
        system: notifications.filter(n => n.type === 'system').length,
        user_action: notifications.filter(n => n.type === 'user_action').length,
        conversation: notifications.filter(n => n.type === 'conversation').length,
        translation: notifications.filter(n => n.type === 'translation').length
      }
    };

    this.config?.onCountsUpdated?.(this.counts);
  }

  /**
   * Met à jour les compteurs depuis le serveur
   */
  private updateCounts(data: any): void {
    this.counts = data;
    this.config?.onCountsUpdated?.(this.counts);
  }

  /**
   * Construit un message multilingue
   */
  private buildMultilingualMessage(content: string, translations?: any): string {
    const baseMessage = content.substring(0, 30) + (content.length > 30 ? '...' : '');
    
    if (translations && (translations.fr || translations.en || translations.es)) {
      const messages = [];
      
      messages.push(`🇫🇷 ${baseMessage}`);
      
      if (translations.en) {
        const enMessage = translations.en.substring(0, 30) + (translations.en.length > 30 ? '...' : '');
        messages.push(`🇺🇸 ${enMessage}`);
      }
      
      if (translations.es) {
        const esMessage = translations.es.substring(0, 30) + (translations.es.length > 30 ? '...' : '');
        messages.push(`🇪🇸 ${esMessage}`);
      }
      
      return messages.join('\n');
    }
    
    return baseMessage;
  }

  /**
   * Génère un titre de notification
   */
  private getNotificationTitle(type: string, conversationType: string, senderName: string): string {
    switch (type) {
      case 'message':
        switch (conversationType) {
          case 'direct':
            return `Message direct de ${senderName}`;
          case 'group':
            return `Message de groupe de ${senderName}`;
          case 'public':
            return `Message public de ${senderName}`;
          default:
            return `Nouveau message de ${senderName}`;
        }
      default:
        return 'Nouvelle notification';
    }
  }

  /**
   * Génère un titre de notification de conversation
   */
  private getConversationNotificationTitle(data: any): string {
    switch (data.type) {
      case 'user_joined':
        return `${data.username} a rejoint la conversation`;
      case 'user_left':
        return `${data.username} a quitté la conversation`;
      default:
        return 'Mise à jour de conversation';
    }
  }

  /**
   * Marque une notification comme lue
   */
  public markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification && !notification.isRead) {
      notification.isRead = true;
      this.updateCountsFromNotifications();
    }
  }

  /**
   * Marque toutes les notifications comme lues
   */
  public markAllAsRead(): void {
    for (const notification of this.notifications.values()) {
      notification.isRead = true;
    }
    this.updateCountsFromNotifications();
  }

  /**
   * Supprime une notification
   */
  public removeNotification(notificationId: string): void {
    this.notifications.delete(notificationId);
    this.updateCountsFromNotifications();
  }

  /**
   * Supprime toutes les notifications
   */
  public clearAll(): void {
    this.notifications.clear();
    this.updateCountsFromNotifications();
  }

  /**
   * Obtient toutes les notifications
   */
  public getNotifications(): Notification[] {
    return Array.from(this.notifications.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Obtient les notifications non lues
   */
  public getUnreadNotifications(): Notification[] {
    return this.getNotifications().filter(n => !n.isRead);
  }

  /**
   * Obtient les compteurs de notifications
   */
  public getCounts(): NotificationCounts {
    return { ...this.counts };
  }

  /**
   * Déconnecte le service
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.config = null;
      console.log('🔔 Service de notifications déconnecté');
    }
  }

  /**
   * Vérifie si le service est connecté
   */
  public isServiceConnected(): boolean {
    return this.isConnected && this.socket?.connected;
  }
}

// Export de l'instance singleton
export const notificationService = NotificationService.getInstance();

