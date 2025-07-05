import { io, Socket } from 'socket.io-client';
import { User, Message, SocketResponse } from '@/types';

class WebSocketService {
  private socket: Socket | null = null;
  private currentUser: User | null = null;

  connect(serverUrl: string = 'http://localhost:3002'): void {
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
