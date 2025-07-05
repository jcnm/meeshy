import { io, Socket } from 'socket.io-client';
import { User, Message, SocketResponse } from '@/types';
import { APP_CONFIG } from './config';

class WebSocketService {
  private socket: Socket | null = null;
  private currentUser: User | null = null;

  connect(serverUrl: string = APP_CONFIG.getBackendUrl()): void {
    if (this.socket?.connected) return;

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentUser = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connecté au serveur WebSocket');
    });

    this.socket.on('disconnect', () => {
      console.log('Déconnecté du serveur WebSocket');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erreur de connexion WebSocket:', error);
    });
  }

  async loginUser(userId: string): Promise<SocketResponse<User>> {
    if (!this.socket) {
      throw new Error('WebSocket non connecté');
    }

    return new Promise((resolve) => {
      this.socket!.emit('userLogin', { userId }, (response: SocketResponse<User>) => {
        if (response.success && response.data) {
          this.currentUser = response.data;
        }
        resolve(response);
      });
    });
  }

  async sendMessage(
    recipientId: string,
    content: string,
    originalLanguage: string
  ): Promise<SocketResponse<Message>> {
    if (!this.socket) {
      throw new Error('WebSocket non connecté');
    }

    return new Promise((resolve) => {
      this.socket!.emit(
        'sendMessage',
        { recipientId, content, originalLanguage },
        (response: SocketResponse<Message>) => {
          resolve(response);
        }
      );
    });
  }

  async getChatHistory(otherUserId: string): Promise<SocketResponse<Message[]>> {
    if (!this.socket) {
      throw new Error('WebSocket non connecté');
    }

    return new Promise((resolve) => {
      this.socket!.emit(
        'getChatHistory',
        { otherUserId },
        (response: SocketResponse<Message[]>) => {
          resolve(response);
        }
      );
    });
  }

  async getOnlineUsers(): Promise<SocketResponse<User[]>> {
    if (!this.socket) {
      throw new Error('WebSocket non connecté');
    }

    return new Promise((resolve) => {
      this.socket!.emit('getOnlineUsers', (response: SocketResponse<User[]>) => {
        resolve(response);
      });
    });
  }

  async updateUserSettings(settings: Partial<User>): Promise<SocketResponse<User>> {
    if (!this.socket) {
      throw new Error('WebSocket non connecté');
    }

    return new Promise((resolve) => {
      this.socket!.emit(
        'updateUserSettings',
        settings,
        (response: SocketResponse<User>) => {
          if (response.success && response.data) {
            this.currentUser = response.data;
          }
          resolve(response);
        }
      );
    });
  }

  // Event listeners pour les événements entrants
  onConnect(callback: () => void): void {
    if (!this.socket) return;
    this.socket.on('connect', callback);
  }

  onDisconnect(callback: () => void): void {
    if (!this.socket) return;
    this.socket.on('disconnect', callback);
  }

  onConnectError(callback: (error: Error) => void): void {
    if (!this.socket) return;
    this.socket.on('connect_error', callback);
  }

  onNewMessage(callback: (message: Message) => void): void {
    if (!this.socket) return;
    this.socket.on('newMessage', callback);
  }

  onMessageSent(callback: (message: Message) => void): void {
    if (!this.socket) return;
    this.socket.on('messageSent', callback);
  }

  onUserStatusChanged(callback: (data: { userId: string; isOnline: boolean }) => void): void {
    if (!this.socket) return;
    this.socket.on('userStatusChanged', callback);
  }

  // Méthodes pour les indicateurs de frappe
  onUserTyping(callback: (data: { userId: string; chatId: string; isTyping: boolean }) => void): void {
    if (!this.socket) return;
    this.socket.on('user-typing', callback);
  }

  offUserTyping(callback?: (data: { userId: string; chatId: string; isTyping: boolean }) => void): void {
    if (!this.socket) return;
    this.socket.off('user-typing', callback);
  }

  emitUserTyping(chatId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('user-typing', { chatId });
  }

  emitUserStoppedTyping(chatId: string): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('user-stopped-typing', { chatId });
  }

  // Getters
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get user(): User | null {
    return this.currentUser;
  }

  // Nettoyer les event listeners
  removeAllListeners(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
  }

  removeListener(event: string, callback?: (...args: unknown[]) => void): void {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.removeAllListeners(event);
    }
  }
}

// Instance singleton
export const webSocketService = new WebSocketService();
export default webSocketService;
