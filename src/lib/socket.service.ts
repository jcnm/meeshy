import { io, Socket } from 'socket.io-client';
import { User, Message, SocketResponse } from '@/types';
import { APP_CONFIG } from './config';

export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private currentUser: User | null = null;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Se connecte au serveur WebSocket
   */
  public connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      this.socket = io(APP_CONFIG.getBackendUrl(), {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('Connecté au serveur WebSocket');
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Erreur de connexion WebSocket:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Déconnecté du serveur WebSocket:', reason);
      });
    });
  }

  /**
   * Se déconnecte du serveur WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentUser = null;
  }

  /**
   * Connecte un utilisateur
   */
  public async loginUser(userId: string): Promise<User> {
    if (!this.socket) {
      throw new Error('Socket non connecté');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('userLogin', { userId }, (response: SocketResponse<User>) => {
        if (response.success && response.data) {
          this.currentUser = response.data;
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Erreur de connexion utilisateur'));
        }
      });
    });
  }

  /**
   * Envoie un message
   */
  public async sendMessage(
    recipientId: string,
    content: string,
    originalLanguage: string
  ): Promise<Message> {
    if (!this.socket) {
      throw new Error('Socket non connecté');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        'sendMessage',
        { recipientId, content, originalLanguage },
        (response: SocketResponse<Message>) => {
          if (response.success && response.data) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Erreur d\'envoi du message'));
          }
        }
      );
    });
  }

  /**
   * Récupère l'historique de chat avec un utilisateur
   */
  public async getChatHistory(otherUserId: string): Promise<Message[]> {
    if (!this.socket) {
      throw new Error('Socket non connecté');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        'getChatHistory',
        { otherUserId },
        (response: SocketResponse<Message[]>) => {
          if (response.success && response.data) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Erreur de récupération de l\'historique'));
          }
        }
      );
    });
  }

  /**
   * Récupère la liste des utilisateurs en ligne
   */
  public async getOnlineUsers(): Promise<User[]> {
    if (!this.socket) {
      throw new Error('Socket non connecté');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('getOnlineUsers', (response: SocketResponse<User[]>) => {
        if (response.success && response.data) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Erreur de récupération des utilisateurs'));
        }
      });
    });
  }

  /**
   * Met à jour les paramètres de l'utilisateur
   */
  public async updateUserSettings(settings: Partial<User>): Promise<User> {
    if (!this.socket) {
      throw new Error('Socket non connecté');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        'updateUserSettings',
        settings,
        (response: SocketResponse<User>) => {
          if (response.success && response.data) {
            this.currentUser = response.data;
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Erreur de mise à jour des paramètres'));
          }
        }
      );
    });
  }

  /**
   * Écoute les nouveaux messages
   */
  public onNewMessage(callback: (message: Message) => void): void {
    if (this.socket) {
      this.socket.on('newMessage', callback);
    }
  }

  /**
   * Écoute les confirmations d'envoi de message
   */
  public onMessageSent(callback: (message: Message) => void): void {
    if (this.socket) {
      this.socket.on('messageSent', callback);
    }
  }

  /**
   * Écoute les changements de statut des utilisateurs
   */
  public onUserStatusChanged(callback: (data: { userId: string; isOnline: boolean }) => void): void {
    if (this.socket) {
      this.socket.on('userStatusChanged', callback);
    }
  }

  /**
   * Retire l'écoute des nouveaux messages
   */
  public offNewMessage(callback?: (message: Message) => void): void {
    if (this.socket) {
      this.socket.off('newMessage', callback);
    }
  }

  /**
   * Retire l'écoute des confirmations d'envoi
   */
  public offMessageSent(callback?: (message: Message) => void): void {
    if (this.socket) {
      this.socket.off('messageSent', callback);
    }
  }

  /**
   * Retire l'écoute des changements de statut
   */
  public offUserStatusChanged(callback?: (data: { userId: string; isOnline: boolean }) => void): void {
    if (this.socket) {
      this.socket.off('userStatusChanged', callback);
    }
  }

  /**
   * Retourne l'utilisateur actuellement connecté
   */
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Vérifie si le socket est connecté
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
}
