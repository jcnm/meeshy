'use client';

import { io, Socket } from 'socket.io-client';
import { 
  TypingEvent, 
  PresenceEvent, 
  MessageEvent, 
  NotificationEvent,
  ConversationUpdateEvent,
  GroupUpdateEvent,
  User 
} from '@/types';
import { toast } from 'sonner';

interface WebSocketConfig {
  url: string;
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  timeout: number;
}

type EventCallback<T = unknown> = (data: T) => void;
type EventUnsubscribe = () => void;

/**
 * Service WebSocket pour la communication temps réel
 * Gère les messages, notifications, présence et typing indicators
 */
export class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentUser: User | null = null;
  private eventListeners = new Map<string, Set<EventCallback>>();

  constructor(config?: Partial<WebSocketConfig>) {
    this.config = {
      url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
      ...config,
    };
  }

  /**
   * Initialise la connexion WebSocket
   */
  async connect(user: User, token: string): Promise<void> {
    if (this.socket?.connected) {
      console.log('WebSocket déjà connecté');
      return;
    }

    this.currentUser = user;

    try {
      this.socket = io(this.config.url, {
        auth: {
          token: `Bearer ${token}`,
          userId: user.id,
        },
        reconnection: this.config.reconnection,
        reconnectionAttempts: this.config.reconnectionAttempts,
        reconnectionDelay: this.config.reconnectionDelay,
        timeout: this.config.timeout,
      });

      this.setupEventListeners();
      
      // Attendre la connexion
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket non initialisé'));
          return;
        }

        this.socket.on('connect', () => {
          console.log('WebSocket connecté');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Erreur de connexion WebSocket:', error);
          this.isConnected = false;
          reject(error);
        });

        // Timeout de connexion
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Timeout de connexion WebSocket'));
          }
        }, this.config.timeout);
      });

    } catch (error) {
      console.error('Erreur lors de la connexion WebSocket:', error);
      throw error;
    }
  }

  /**
   * Déconnecte le WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentUser = null;
    this.eventListeners.clear();
    console.log('WebSocket déconnecté');
  }

  /**
   * Vérifie si la connexion est active
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Configuration des écouteurs d'événements internes
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Événements de connexion
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('WebSocket reconnecté');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('WebSocket déconnecté:', reason);
      
      if (reason === 'io server disconnect') {
        // Reconnexion manuelle nécessaire
        this.handleReconnection();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`WebSocket reconnecté après ${attemptNumber} tentatives`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', (error) => {
      this.reconnectAttempts++;
      console.error(`Erreur de reconnexion (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        toast.error('Connexion perdue. Veuillez recharger la page.');
      }
    });

    // Événements métier
    this.socket.on('message', (data: MessageEvent) => {
      this.emitToListeners('message', data);
    });

    this.socket.on('typing', (data: TypingEvent) => {
      this.emitToListeners('typing', data);
    });

    this.socket.on('presence', (data: PresenceEvent) => {
      this.emitToListeners('presence', data);
    });

    this.socket.on('notification', (data: NotificationEvent) => {
      this.emitToListeners('notification', data);
      
      // Afficher notification toast si ce n'est pas notre propre action
      if (data.userId !== this.currentUser?.id && data.type === 'new') {
        toast.info(data.notification.title, {
          description: data.notification.message,
        });
      }
    });

    this.socket.on('conversation_update', (data: ConversationUpdateEvent) => {
      this.emitToListeners('conversation_update', data);
    });

    this.socket.on('group_update', (data: GroupUpdateEvent) => {
      this.emitToListeners('group_update', data);
    });

    this.socket.on('error', (error) => {
      console.error('Erreur WebSocket:', error);
      toast.error('Erreur de connexion temps réel');
    });
  }

  /**
   * Gère la reconnexion manuelle
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        if (this.currentUser && !this.isConnected) {
          console.log('Tentative de reconnexion...');
          this.socket?.connect();
        }
      }, this.config.reconnectionDelay * Math.pow(2, this.reconnectAttempts));
    }
  }

  /**
   * Émet un événement vers tous les listeners
   */
  private emitToListeners<T>(eventType: string, data: T): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Erreur dans le listener ${eventType}:`, error);
        }
      });
    }
  }

  // === MÉTHODES PUBLIQUES POUR LES ÉVÉNEMENTS ===

  /**
   * S'abonne à un type d'événement
   */
  on<T>(eventType: string, callback: EventCallback<T>): EventUnsubscribe {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(callback as EventCallback);

    // Retourne une fonction pour se désabonner
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(callback as EventCallback);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType);
        }
      }
    };
  }

  // === MÉTHODES D'ENVOI D'ÉVÉNEMENTS ===

  /**
   * Envoie un message
   */
  sendMessage(conversationId: string, content: string, replyToId?: string): void {
    if (!this.isSocketConnected()) {
      throw new Error('WebSocket non connecté');
    }

    this.socket!.emit('send_message', {
      conversationId,
      content,
      replyToId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Indique qu'on est en train de taper
   */
  startTyping(conversationId: string): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('typing_start', {
      conversationId,
      userId: this.currentUser?.id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Indique qu'on a arrêté de taper
   */
  stopTyping(conversationId: string): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('typing_stop', {
      conversationId,
      userId: this.currentUser?.id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Met à jour son statut de présence
   */
  updatePresence(isOnline: boolean): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('presence_update', {
      userId: this.currentUser?.id,
      isOnline,
      lastActiveAt: new Date().toISOString(),
    });
  }

  /**
   * Rejoint une conversation (room)
   */
  joinConversation(conversationId: string): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('join_conversation', {
      conversationId,
      userId: this.currentUser?.id,
    });
  }

  /**
   * Quitte une conversation (room)
   */
  leaveConversation(conversationId: string): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('leave_conversation', {
      conversationId,
      userId: this.currentUser?.id,
    });
  }

  /**
   * Rejoint un groupe (room)
   */
  joinGroup(groupId: string): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('join_group', {
      groupId,
      userId: this.currentUser?.id,
    });
  }

  /**
   * Quitte un groupe (room)
   */
  leaveGroup(groupId: string): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('leave_group', {
      groupId,
      userId: this.currentUser?.id,
    });
  }

  /**
   * Marque les messages comme lus
   */
  markMessagesAsRead(conversationId: string, messageIds: string[]): void {
    if (!this.isSocketConnected()) return;

    this.socket!.emit('messages_read', {
      conversationId,
      messageIds,
      userId: this.currentUser?.id,
      timestamp: new Date().toISOString(),
    });
  }

  // === UTILITAIRES ===

  /**
   * Obtient les statistiques de connexion
   */
  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      socketId: this.socket?.id,
      currentUser: this.currentUser?.username,
    };
  }

  /**
   * Force une reconnexion
   */
  forceReconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }
}

// Instance singleton
export const websocketService = new WebSocketService();

export default websocketService;
