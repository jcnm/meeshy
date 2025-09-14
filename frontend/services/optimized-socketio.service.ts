'use client';

import { io, Socket } from 'socket.io-client';
import type { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  SocketIOMessage as Message,
  TranslationEvent,
  TypingEvent,
  UserStatusEvent
} from '@shared/types';
import type { User } from '@shared/types';

// ===== TYPES =====

interface ConnectionConfig {
  url: string;
  autoConnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  timeout: number;
}

interface EventListeners {
  onNewMessage?: (message: Message) => void;
  onMessageEdited?: (message: Message) => void;
  onMessageDeleted?: (data: { messageId: string; conversationId: string }) => void;
  onTranslation?: (data: TranslationEvent) => void;
  onTyping?: (event: TypingEvent) => void;
  onUserStatus?: (event: UserStatusEvent) => void;
  onConversationJoined?: (data: { conversationId: string; participant: any }) => void;
  onConversationLeft?: (data: { conversationId: string; userId: string }) => void;
  onConversationStats?: (data: { conversationId: string; stats: any }) => void;
  onConversationOnlineStats?: (data: { conversationId: string; onlineUsers: any[]; updatedAt: Date }) => void;
  onError?: (error: { message: string; code?: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError: string | null;
  connectedAt: Date | null;
  lastReconnectAttempt: Date | null;
}

// ===== CONSTANTS =====

const CLIENT_EVENTS = {
  MESSAGE_SEND: 'message:send',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_DELETE: 'message:delete',
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  USER_STATUS: 'user:status',
  AUTHENTICATE: 'authenticate',
  REQUEST_TRANSLATION: 'request_translation'
} as const;

const SERVER_EVENTS = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_TRANSLATION: 'message:translation',
  MESSAGE_TRANSLATED: 'message_translated',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  USER_STATUS: 'user:status',
  CONVERSATION_JOINED: 'conversation:joined',
  CONVERSATION_LEFT: 'conversation:left',
  AUTHENTICATED: 'authenticated',
  MESSAGE_SENT: 'message_sent',
  ERROR: 'error',
  TRANSLATION_RECEIVED: 'translation_received',
  TRANSLATION_ERROR: 'translation_error',
  NOTIFICATION: 'notification',
  SYSTEM_MESSAGE: 'system_message',
  CONVERSATION_STATS: 'conversation:stats',
  CONVERSATION_ONLINE_STATS: 'conversation:online_stats'
} as const;

// ===== OPTIMIZED SOCKET.IO SERVICE =====

class OptimizedSocketIOService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private config: ConnectionConfig;
  private state: ConnectionState;
  private listeners: EventListeners = {};
  private currentUser: User | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isDestroyed = false;

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = {
      url: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
      autoConnect: false, // Lazy loading par défaut
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      timeout: 10000,
      ...config
    };

    this.state = {
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      reconnectAttempts: 0,
      lastError: null,
      connectedAt: null,
      lastReconnectAttempt: null
    };
  }

  // ===== CONNECTION MANAGEMENT =====

  /**
   * Initialise la connexion Socket.IO (lazy loading)
   */
  public async connect(user: User): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Service has been destroyed');
    }

    if (this.state.isConnected || this.state.isConnecting) {
      return;
    }

    this.currentUser = user;
    this.state.isConnecting = true;
    this.state.lastError = null;

    try {
      console.log('🔌 [OptimizedSocketIO] Initialisation de la connexion...');

      this.socket = io(this.config.url, {
        transports: ['websocket', 'polling'],
        timeout: this.config.timeout,
        forceNew: true,
        autoConnect: true,
        reconnection: false, // Gestion manuelle de la reconnexion
        auth: {
          userId: user.id,
          sessionToken: localStorage.getItem('auth_token')
        }
      });

      this.setupEventListeners();
      this.setupConnectionHandlers();

      // Attendre la connexion
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      console.log('✅ [OptimizedSocketIO] Connexion établie');
    } catch (error) {
      console.error('❌ [OptimizedSocketIO] Erreur de connexion:', error);
      this.state.isConnecting = false;
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Déconnecte proprement le socket
   */
  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 [OptimizedSocketIO] Déconnexion...');
      
      // Nettoyer les timeouts
      this.clearReconnectTimeout();
      this.clearHeartbeat();
      this.clearTypingTimeouts();

      // Déconnecter le socket
      this.socket.disconnect();
      this.socket = null;
    }

    this.state = {
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      reconnectAttempts: 0,
      lastError: null,
      connectedAt: null,
      lastReconnectAttempt: null
    };

    console.log('✅ [OptimizedSocketIO] Déconnecté');
  }

  /**
   * Détruit complètement le service
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.listeners = {};
    this.currentUser = null;
  }

  // ===== EVENT LISTENERS SETUP =====

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Messages
    this.socket.on(SERVER_EVENTS.MESSAGE_NEW, (message: Message) => {
      console.log('📨 [OptimizedSocketIO] Nouveau message reçu:', message.id);
      this.listeners.onNewMessage?.(message);
    });

    this.socket.on(SERVER_EVENTS.MESSAGE_EDITED, (message: Message) => {
      console.log('✏️ [OptimizedSocketIO] Message édité:', message.id);
      this.listeners.onMessageEdited?.(message);
    });

    this.socket.on(SERVER_EVENTS.MESSAGE_DELETED, (data) => {
      console.log('🗑️ [OptimizedSocketIO] Message supprimé:', data.messageId);
      this.listeners.onMessageDeleted?.(data);
    });

    // Traductions
    this.socket.on(SERVER_EVENTS.MESSAGE_TRANSLATION, (data: TranslationEvent) => {
      console.log('🌐 [OptimizedSocketIO] Traduction reçue:', data.messageId);
      this.listeners.onTranslation?.(data);
    });

    this.socket.on(SERVER_EVENTS.TRANSLATION_RECEIVED, (data) => {
      console.log('🌐 [OptimizedSocketIO] Traduction reçue (legacy):', data.messageId);
      // Convertir en format TranslationEvent
      const translationEvent: TranslationEvent = {
        messageId: data.messageId,
        translations: [{
          messageId: data.messageId,
          sourceLanguage: 'unknown',
          targetLanguage: data.targetLanguage,
          translatedContent: data.translatedText,
          translationModel: 'basic',
          cacheKey: `${data.messageId}-${data.targetLanguage}`,
          cached: false,
          confidenceScore: data.confidenceScore
        }]
      };
      this.listeners.onTranslation?.(translationEvent);
    });

    // Frappe
    this.socket.on(SERVER_EVENTS.TYPING_START, (event: TypingEvent) => {
      this.listeners.onTyping?.({ ...event, isTyping: true });
    });

    this.socket.on(SERVER_EVENTS.TYPING_STOP, (event: TypingEvent) => {
      this.listeners.onTyping?.({ ...event, isTyping: false });
    });

    // Statut utilisateur
    this.socket.on(SERVER_EVENTS.USER_STATUS, (event: UserStatusEvent) => {
      this.listeners.onUserStatus?.(event);
    });

    // Conversations
    this.socket.on(SERVER_EVENTS.CONVERSATION_JOINED, (data) => {
      this.listeners.onConversationJoined?.(data);
    });

    this.socket.on(SERVER_EVENTS.CONVERSATION_LEFT, (data) => {
      this.listeners.onConversationLeft?.(data);
    });

    // Statistiques
    this.socket.on(SERVER_EVENTS.CONVERSATION_STATS, (data) => {
      this.listeners.onConversationStats?.(data);
    });

    this.socket.on(SERVER_EVENTS.CONVERSATION_ONLINE_STATS, (data) => {
      this.listeners.onConversationOnlineStats?.(data);
    });

    // Erreurs
    this.socket.on(SERVER_EVENTS.ERROR, (error) => {
      console.error('❌ [OptimizedSocketIO] Erreur serveur:', error);
      this.listeners.onError?.(error);
    });
  }

  private setupConnectionHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ [OptimizedSocketIO] Connecté');
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.isReconnecting = false;
      this.state.reconnectAttempts = 0;
      this.state.connectedAt = new Date();
      this.state.lastError = null;

      this.startHeartbeat();
      this.listeners.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [OptimizedSocketIO] Déconnecté:', reason);
      this.state.isConnected = false;
      this.state.isConnecting = false;
      this.clearHeartbeat();
      this.listeners.onDisconnect?.();

      // Reconnexion automatique seulement si ce n'est pas une déconnexion volontaire
      if (reason !== 'io client disconnect' && !this.isDestroyed) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [OptimizedSocketIO] Erreur de connexion:', error);
      this.state.isConnecting = false;
      this.state.lastError = error.message;
      this.listeners.onError?.({ message: error.message });
    });
  }

  // ===== RECONNECTION LOGIC =====

  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= this.config.reconnectAttempts) {
      console.log('❌ [OptimizedSocketIO] Nombre maximum de tentatives de reconnexion atteint');
      return;
    }

    this.state.isReconnecting = true;
    this.state.reconnectAttempts++;
    this.state.lastReconnectAttempt = new Date();

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.state.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    console.log(`🔄 [OptimizedSocketIO] Reconnexion dans ${delay}ms (tentative ${this.state.reconnectAttempts}/${this.config.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isDestroyed && this.currentUser) {
        this.connect(this.currentUser)
          .then(() => {
            console.log('✅ [OptimizedSocketIO] Reconnexion réussie');
            this.listeners.onReconnect?.();
          })
          .catch((error) => {
            console.error('❌ [OptimizedSocketIO] Échec de la reconnexion:', error);
            this.scheduleReconnect();
          });
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // ===== HEARTBEAT =====

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping toutes les 30 secondes
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ===== TYPING MANAGEMENT =====

  private clearTypingTimeouts(): void {
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
  }

  // ===== PUBLIC API =====

  /**
   * Configure les listeners d'événements
   */
  public setListeners(listeners: EventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * Envoie un message
   */
  public sendMessage(data: {
    conversationId: string;
    content: string;
    originalLanguage?: string;
    messageType?: string;
    replyToId?: string;
  }): Promise<{ messageId: string }> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(CLIENT_EVENTS.MESSAGE_SEND, data, (response) => {
        if (response.success) {
          resolve({ messageId: response.data?.messageId || '' });
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });
    });
  }

  /**
   * Rejoint une conversation
   */
  public joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot join conversation');
      return;
    }

    this.socket.emit(CLIENT_EVENTS.CONVERSATION_JOIN, { conversationId });
  }

  /**
   * Quitte une conversation
   */
  public leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot leave conversation');
      return;
    }

    this.socket.emit(CLIENT_EVENTS.CONVERSATION_LEAVE, { conversationId });
  }

  /**
   * Démarre l'indicateur de frappe
   */
  public startTyping(conversationId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit(CLIENT_EVENTS.TYPING_START, { conversationId });

    // Auto-stop après 3 secondes
    const existingTimeout = this.typingTimeouts.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.stopTyping(conversationId);
      this.typingTimeouts.delete(conversationId);
    }, 3000);

    this.typingTimeouts.set(conversationId, timeout);
  }

  /**
   * Arrête l'indicateur de frappe
   */
  public stopTyping(conversationId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit(CLIENT_EVENTS.TYPING_STOP, { conversationId });

    const timeout = this.typingTimeouts.get(conversationId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(conversationId);
    }
  }

  /**
   * Demande une traduction
   */
  public requestTranslation(messageId: string, targetLanguage: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot request translation');
      return;
    }

    this.socket.emit(CLIENT_EVENTS.REQUEST_TRANSLATION, { messageId, targetLanguage });
  }

  /**
   * Met à jour le statut utilisateur
   */
  public updateUserStatus(isOnline: boolean): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit(CLIENT_EVENTS.USER_STATUS, { isOnline });
  }

  // ===== GETTERS =====

  public getConnectionState(): ConnectionState {
    return { ...this.state };
  }

  public isConnected(): boolean {
    return this.state.isConnected && this.socket?.connected === true;
  }

  public isConnecting(): boolean {
    return this.state.isConnecting;
  }

  public isReconnecting(): boolean {
    return this.state.isReconnecting;
  }

  public getLastError(): string | null {
    return this.state.lastError;
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// ===== SINGLETON INSTANCE =====

let socketServiceInstance: OptimizedSocketIOService | null = null;

export function getSocketService(): OptimizedSocketIOService {
  if (!socketServiceInstance) {
    socketServiceInstance = new OptimizedSocketIOService();
  }
  return socketServiceInstance;
}

export function destroySocketService(): void {
  if (socketServiceInstance) {
    socketServiceInstance.destroy();
    socketServiceInstance = null;
  }
}

export default OptimizedSocketIOService;
