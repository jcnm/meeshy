/**
 * SERVICE UNIFIÉ DE MESSAGING POUR MEESHY
 * Point unique d'émission et réception des messages
 */

'use client';

import io, { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import type { Message, User } from '@/types';

interface MessageEvent {
  type: 'new_message' | 'message_edited' | 'message_deleted';
  message: Message;
  conversationId: string;
}

interface TypingEvent {
  userId: string;
  username: string;
  conversationId: string;
  isTyping: boolean;
}

interface UserStatusEvent {
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen?: Date;
}

class MessagingService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentUser: User | null = null;
  private messageListeners: Set<(message: Message) => void> = new Set();
  private editListeners: Set<(message: Message) => void> = new Set();
  private deleteListeners: Set<(messageId: string) => void> = new Set();
  private typingListeners: Set<(event: TypingEvent) => void> = new Set();
  private statusListeners: Set<(event: UserStatusEvent) => void> = new Set();

  constructor() {
    this.initializeConnection();
  }

  private initializeConnection() {
    // Vérification côté client uniquement
    if (typeof window === 'undefined') {
      console.log('🔒 MessagingService: Côté serveur - connexion différée');
      return;
    }
    
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('🔒 MessagingService: Aucun token JWT trouvé');
      return;
    }

    console.log('🔌 MessagingService: Initialisation connexion WebSocket...');

    this.socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('✅ MessagingService: WebSocket connecté');
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('❌ MessagingService: WebSocket déconnecté');
    });

    // POINT UNIQUE DE RÉCEPTION DES MESSAGES
    this.socket.on('newMessage', (event: MessageEvent) => {
      console.log('📨 MessagingService: Nouveau message reçu', {
        type: event.type,
        messageId: event.message.id,
        conversationId: event.conversationId,
        content: event.message.content.substring(0, 50) + '...',
        senderId: event.message.senderId
      });

      // Notifier tous les listeners
      this.messageListeners.forEach(listener => {
        try {
          listener(event.message);
        } catch (error) {
          console.error('❌ MessagingService: Erreur dans listener de message', error);
        }
      });

      // Notification toast si ce n'est pas notre message
      if (this.currentUser && event.message.senderId !== this.currentUser.id) {
        toast.info(`Nouveau message de ${event.message.senderName || 'Quelqu\'un'}`);
      }
    });

    this.socket.on('messageEdited', (event: MessageEvent) => {
      console.log('✏️ MessagingService: Message modifié', {
        messageId: event.message.id,
        conversationId: event.conversationId
      });

      this.editListeners.forEach(listener => {
        try {
          listener(event.message);
        } catch (error) {
          console.error('❌ MessagingService: Erreur dans listener d\'édition', error);
        }
      });
    });

    this.socket.on('messageDeleted', (event: MessageEvent) => {
      console.log('🗑️ MessagingService: Message supprimé', {
        messageId: event.message.id,
        conversationId: event.conversationId
      });

      this.deleteListeners.forEach(listener => {
        try {
          listener(event.message.id);
        } catch (error) {
          console.error('❌ MessagingService: Erreur dans listener de suppression', error);
        }
      });
    });

    // Autres événements - Frappe unifiée
    this.socket.on('userTyping', (event: TypingEvent) => {
      console.log('⌨️ MessagingService: Événement de frappe', event);
      if (event.isTyping) {
        console.log('⌨️ MessagingService: Frappe commencée', event);
      } else {
        console.log('⌨️ MessagingService: Frappe arrêtée', event);
      }
      this.typingListeners.forEach(listener => listener(event));
    });

    this.socket.on('userStatusChanged', (event: UserStatusEvent) => {
      console.log('👤 MessagingService: Statut utilisateur changé', event);
      this.statusListeners.forEach(listener => listener(event));
    });
  }

  // POINT UNIQUE D'ÉMISSION DES MESSAGES
  async sendMessage(conversationId: string, content: string): Promise<boolean> {
    if (!this.isConnected || !this.socket) {
      console.error('❌ MessagingService: Impossible d\'envoyer - socket non connecté');
      toast.error('Connexion non établie');
      return false;
    }

    if (!content.trim()) {
      console.warn('⚠️ MessagingService: Tentative d\'envoi d\'un message vide');
      return false;
    }

    console.log('📤 MessagingService: Envoi message', {
      conversationId,
      contentLength: content.length,
      content: content.substring(0, 50) + '...'
    });

    try {
      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        this.socket!.emit('sendMessage', {
          conversationId,
          content: content.trim(),
          originalLanguage: this.currentUser?.systemLanguage || 'fr'
        }, (response: { success: boolean; error?: string }) => {
          resolve(response);
        });
      });

      if (result.success) {
        console.log('✅ MessagingService: Message envoyé avec succès');
        return true;
      } else {
        console.error('❌ MessagingService: Échec envoi message', result.error);
        toast.error(result.error || 'Erreur lors de l\'envoi');
        return false;
      }
    } catch (error) {
      console.error('❌ MessagingService: Exception lors de l\'envoi', error);
      toast.error('Erreur de connexion');
      return false;
    }
  }

  async editMessage(messageId: string, newContent: string): Promise<boolean> {
    if (!this.isConnected || !this.socket) {
      toast.error('Connexion non établie');
      return false;
    }

    console.log('✏️ MessagingService: Modification message', { messageId, newContent: newContent.substring(0, 50) + '...' });

    try {
      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        this.socket!.emit('editMessage', {
          messageId,
          content: newContent.trim()
        }, resolve);
      });

      if (result.success) {
        console.log('✅ MessagingService: Message modifié avec succès');
        return true;
      } else {
        console.error('❌ MessagingService: Échec modification message', result.error);
        toast.error(result.error || 'Erreur lors de la modification');
        return false;
      }
    } catch (error) {
      console.error('❌ MessagingService: Exception lors de la modification', error);
      toast.error('Erreur de connexion');
      return false;
    }
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    if (!this.isConnected || !this.socket) {
      toast.error('Connexion non établie');
      return false;
    }

    console.log('🗑️ MessagingService: Suppression message', { messageId });

    try {
      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        this.socket!.emit('deleteMessage', { messageId }, resolve);
      });

      if (result.success) {
        console.log('✅ MessagingService: Message supprimé avec succès');
        return true;
      } else {
        console.error('❌ MessagingService: Échec suppression message', result.error);
        toast.error(result.error || 'Erreur lors de la suppression');
        return false;
      }
    } catch (error) {
      console.error('❌ MessagingService: Exception lors de la suppression', error);
      toast.error('Erreur de connexion');
      return false;
    }
  }

  // Gestion des conversations
  joinConversation(conversationId: string) {
    if (this.socket && this.isConnected) {
      console.log('🚪 MessagingService: Rejoindre conversation', { conversationId });
      this.socket.emit('joinConversation', { conversationId });
    }
  }

  leaveConversation(conversationId: string) {
    if (this.socket && this.isConnected) {
      console.log('🚪 MessagingService: Quitter conversation', { conversationId });
      this.socket.emit('leaveConversation', { conversationId });
    }
  }

  // Gestion de la frappe
  startTyping(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('startTyping', { conversationId });
    }
  }

  stopTyping(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('stopTyping', { conversationId });
    }
  }

  // Listeners
  onNewMessage(callback: (message: Message) => void) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  onMessageEdited(callback: (message: Message) => void) {
    this.editListeners.add(callback);
    return () => this.editListeners.delete(callback);
  }

  onMessageDeleted(callback: (messageId: string) => void) {
    this.deleteListeners.add(callback);
    return () => this.deleteListeners.delete(callback);
  }

  onTyping(callback: (event: TypingEvent) => void) {
    this.typingListeners.add(callback);
    return () => this.typingListeners.delete(callback);
  }

  onUserStatus(callback: (event: UserStatusEvent) => void) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  // Configuration
  setCurrentUser(user: User) {
    this.currentUser = user;
    console.log('👤 MessagingService: Utilisateur configuré', { userId: user.id, username: user.username });
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      hasSocket: !!this.socket,
      currentUser: this.currentUser?.username || 'Non défini'
    };
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 MessagingService: Déconnexion...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.messageListeners.clear();
    this.editListeners.clear();
    this.deleteListeners.clear();
    this.typingListeners.clear();
    this.statusListeners.clear();
  }
}

// Instance singleton
export const messagingService = new MessagingService();
