import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

export interface NotificationEvent {
  id: string;
  type: 'message' | 'user_joined' | 'user_left' | 'role_changed' | 'system';
  title: string;
  message: string;
  userId: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface PresenceEvent {
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen?: Date;
  currentActivity?: string;
}

export interface AdminEvent {
  type: 'user_role_changed' | 'user_banned' | 'user_deleted' | 'system_alert';
  adminId: string;
  targetUserId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface MessageEvent {
  type: 'new_message' | 'message_edited' | 'message_deleted';
  message: any;
  conversationId: string;
}

/**
 * Service pour gérer les connexions WebSocket temps réel
 */
class RealtimeService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Callbacks pour les événements
  private onlineUsersCallbacks: Array<(users: string[]) => void> = [];
  private notificationCallbacks: Array<(notification: NotificationEvent) => void> = [];
  private presenceCallbacks: Array<(presence: PresenceEvent) => void> = [];
  private typingCallbacks: Array<(typing: TypingEvent) => void> = [];
  private messageCallbacks: Array<(message: MessageEvent) => void> = [];
  private adminCallbacks: Array<(event: AdminEvent) => void> = [];

  /**
   * Connecte au serveur WebSocket
   */
  connect(token: string, backendUrl?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = backendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        
        this.socket = io(wsUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          forceNew: true,
        });

        this.socket.on('connect', () => {
          console.log('✅ WebSocket connecté');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.setupEventListeners();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Erreur de connexion WebSocket:', error);
          this.isConnected = false;
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 WebSocket déconnecté:', reason);
          this.isConnected = false;
          
          if (reason === 'io server disconnect') {
            // Reconnexion automatique si le serveur ferme la connexion
            this.attemptReconnect(token);
          }
        });

      } catch (error) {
        console.error('Erreur lors de la connexion WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Configure les écouteurs d'événements
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Notifications
    this.socket.on('notification', (notification: NotificationEvent) => {
      console.log('🔔 Notification reçue:', notification);
      this.handleNotification(notification);
      this.notificationCallbacks.forEach(callback => callback(notification));
    });

    // Présence utilisateur
    this.socket.on('userPresenceChanged', (presence: PresenceEvent) => {
      console.log('👤 Présence mise à jour:', presence);
      this.presenceCallbacks.forEach(callback => callback(presence));
    });

    // Frappe
    this.socket.on('userTyping', (typing: TypingEvent) => {
      this.typingCallbacks.forEach(callback => callback(typing));
    });

    // Messages
    this.socket.on('newMessage', (message: MessageEvent) => {
      console.log('💬 Nouveau message:', message);
      this.messageCallbacks.forEach(callback => callback(message));
    });

    // Événements admin
    this.socket.on('adminEvent', (event: AdminEvent) => {
      console.log('⚡ Événement admin:', event);
      this.adminCallbacks.forEach(callback => callback(event));
    });

    // Statut utilisateur
    this.socket.on('userStatusChanged', (status: PresenceEvent) => {
      this.presenceCallbacks.forEach(callback => callback(status));
    });
  }

  /**
   * Tente une reconnexion automatique
   */
  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
      toast.error('Connexion temps réel perdue. Veuillez actualiser la page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Backoff exponentiel

    console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms`);

    setTimeout(() => {
      this.connect(token).catch(() => {
        this.attemptReconnect(token);
      });
    }, delay);
  }

  /**
   * Gère les notifications reçues
   */
  private handleNotification(notification: NotificationEvent): void {
    const { type, title, message } = notification;

    switch (type) {
      case 'message':
        toast.info(`💬 ${title}`, { description: message });
        break;
      case 'user_joined':
        toast.success(`👋 ${title}`, { description: message });
        break;
      case 'user_left':
        toast(`👋 ${title}`, { description: message });
        break;
      case 'role_changed':
        toast.success(`⚡ ${title}`, { description: message });
        break;
      case 'system':
        toast.warning(`🔧 ${title}`, { description: message });
        break;
      default:
        toast(`📢 ${title}`, { description: message });
    }
  }

  /**
   * Déconnecte le WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Vérifie si le WebSocket est connecté
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // === MÉTHODES D'ENVOI D'ÉVÉNEMENTS ===

  /**
   * Rejoint une conversation
   */
  joinConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('joinConversation', { conversationId });
    }
  }

  /**
   * Quitte une conversation
   */
  leaveConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('leaveConversation', { conversationId });
    }
  }

  /**
   * Envoie un indicateur de frappe
   */
  startTyping(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('startTyping', { conversationId });
    }
  }

  /**
   * Arrête l'indicateur de frappe
   */
  stopTyping(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('stopTyping', { conversationId });
    }
  }

  /**
   * Met à jour l'activité utilisateur
   */
  updateActivity(activity: string): void {
    if (this.socket) {
      this.socket.emit('updateActivity', { activity });
    }
  }

  /**
   * Rejoint la room admin
   */
  joinAdminRoom(): void {
    if (this.socket) {
      this.socket.emit('joinAdminRoom');
    }
  }

  /**
   * Obtient la liste des utilisateurs en ligne
   */
  getOnlineUsers(): void {
    if (this.socket) {
      this.socket.emit('getOnlineUsers');
    }
  }

  /**
   * Marque une notification comme lue
   */
  markNotificationRead(notificationId: string): void {
    if (this.socket) {
      this.socket.emit('markNotificationRead', { notificationId });
    }
  }

  // === MÉTHODES D'ABONNEMENT AUX ÉVÉNEMENTS ===

  /**
   * S'abonne aux notifications
   */
  onNotification(callback: (notification: NotificationEvent) => void): () => void {
    this.notificationCallbacks.push(callback);
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * S'abonne aux changements de présence
   */
  onPresenceChange(callback: (presence: PresenceEvent) => void): () => void {
    this.presenceCallbacks.push(callback);
    return () => {
      const index = this.presenceCallbacks.indexOf(callback);
      if (index > -1) {
        this.presenceCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * S'abonne aux indicateurs de frappe
   */
  onTyping(callback: (typing: TypingEvent) => void): () => void {
    this.typingCallbacks.push(callback);
    return () => {
      const index = this.typingCallbacks.indexOf(callback);
      if (index > -1) {
        this.typingCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * S'abonne aux nouveaux messages
   */
  onMessage(callback: (message: MessageEvent) => void): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) {
        this.messageCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * S'abonne aux événements admin
   */
  onAdminEvent(callback: (event: AdminEvent) => void): () => void {
    this.adminCallbacks.push(callback);
    return () => {
      const index = this.adminCallbacks.indexOf(callback);
      if (index > -1) {
        this.adminCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * S'abonne aux utilisateurs en ligne
   */
  onOnlineUsers(callback: (users: string[]) => void): () => void {
    this.onlineUsersCallbacks.push(callback);
    
    // Écouter la réponse de getOnlineUsers
    if (this.socket) {
      this.socket.on('getOnlineUsers', (response: { onlineUsers: string[] }) => {
        if (response.onlineUsers) {
          this.onlineUsersCallbacks.forEach(cb => cb(response.onlineUsers));
        }
      });
    }

    return () => {
      const index = this.onlineUsersCallbacks.indexOf(callback);
      if (index > -1) {
        this.onlineUsersCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Nettoie tous les callbacks
   */
  cleanup(): void {
    this.onlineUsersCallbacks = [];
    this.notificationCallbacks = [];
    this.presenceCallbacks = [];
    this.typingCallbacks = [];
    this.messageCallbacks = [];
    this.adminCallbacks = [];
  }
}

// Instance singleton
export const realtimeService = new RealtimeService();

export default realtimeService;
