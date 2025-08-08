/**
 * SERVICE DE MESSAGING WEBSOCKET NATIF POUR MEESHY
 * Com    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000').replace(/^http/, 'ws') + '/ws';
    const wsUrlWithAuth = `${wsUrl}?token=${encodeURIComponent(token)}`;tible avec @fastify/websocket
 */

'use client';

import { toast } from 'sonner';
import type { Message, User } from '@/types';

interface WebSocketMessage {
  type: 'new_message' | 'message_edited' | 'message_deleted' | 'user_typing' | 'user_status' | 'join_conversation' | 'leave_conversation';
  data: any;
  conversationId?: string;
  userId?: string;
  messageId?: string;
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

class NativeWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private currentUser: User | null = null;
  private messageListeners: Set<(message: Message) => void> = new Set();
  private editListeners: Set<(message: Message) => void> = new Set();
  private deleteListeners: Set<(messageId: string) => void> = new Set();
  private typingListeners: Set<(event: TypingEvent) => void> = new Set();
  private statusListeners: Set<(event: UserStatusEvent) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Ne pas se connecter automatiquement dans le constructeur
    // La connexion sera initialisée quand l'utilisateur sera défini
  }

  private initializeConnection() {
    // Vérifier si le code s'exécute côté client (navigateur)
    if (typeof window === 'undefined') {
      console.warn('🔒 NativeWebSocketService: Exécution côté serveur, connexion ignorée');
      return;
    }
    
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('🔒 NativeWebSocketService: Aucun token JWT trouvé');
      return;
    }

    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000').replace(/^http/, 'ws');
    const wsUrlWithAuth = `${wsUrl}/ws?token=${encodeURIComponent(token)}`;
    
    console.log('🔌 NativeWebSocketService: Initialisation connexion WebSocket...', {
      wsUrl: wsUrlWithAuth,
      hasToken: !!token,
      tokenPreview: token.substring(0, 20) + '...',
      userAgent: navigator.userAgent
    });

    try {
      this.ws = new WebSocket(wsUrlWithAuth);
      this.setupEventListeners();
    } catch (error) {
      console.error('❌ NativeWebSocketService: Erreur création WebSocket', error);
      this.scheduleReconnect();
    }
  }

  private setupEventListeners() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ NativeWebSocketService: WebSocket connecté');
      
      // S'authentifier et rejoindre la conversation globale
      if (this.currentUser) {
        this.send({
          type: 'join_conversation',
          conversationId: 'global_stream',
          data: { userId: this.currentUser.id }
        });
      }
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      console.log('❌ NativeWebSocketService: WebSocket fermé', { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean
      });
      
      // Codes d'erreur spécifiques
      if (event.code === 1006) {
        console.error('🔒 Connexion interrompue - Possible problème d\'authentification ou de réseau');
      } else if (event.code === 1002) {
        console.error('🔒 Erreur de protocole WebSocket');
      } else if (event.code === 1008) {
        console.error('🔒 Politique de sécurité violée');
      } else if (event.code === 1011) {
        console.error('🔒 Erreur de serveur');
      }
      
      // Si c'est une déconnexion anormale, recharger la page
      if (event.code !== 1000) { // 1000 = fermeture normale
        console.warn('🔄 NativeWebSocketService: Déconnexion anormale détectée, rechargement de la page dans 2s...');
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 2000);
      } else {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ NativeWebSocketService: Erreur WebSocket', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ NativeWebSocketService: Erreur parsing message', error);
      }
    };
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('📨 NativeWebSocketService: Message reçu', message);

    switch (message.type) {
      case 'new_message':
        this.messageListeners.forEach(listener => {
          try {
            listener(message.data);
          } catch (error) {
            console.error('❌ NativeWebSocketService: Erreur dans listener de message', error);
          }
        });
        
        // Notification toast si ce n'est pas notre message
        if (this.currentUser && message.data.senderId !== this.currentUser.id) {
          toast.info(`Nouveau message de ${message.data.sender?.firstName || 'Quelqu\'un'}`);
        }
        break;

      case 'message_edited':
        this.editListeners.forEach(listener => {
          try {
            listener(message.data);
          } catch (error) {
            console.error('❌ NativeWebSocketService: Erreur dans listener d\'édition', error);
          }
        });
        break;

      case 'message_deleted':
        this.deleteListeners.forEach(listener => {
          try {
            listener(message.messageId!);
          } catch (error) {
            console.error('❌ NativeWebSocketService: Erreur dans listener de suppression', error);
          }
        });
        break;

      case 'user_typing':
        this.typingListeners.forEach(listener => {
          try {
            listener(message.data);
          } catch (error) {
            console.error('❌ NativeWebSocketService: Erreur dans listener de frappe', error);
          }
        });
        break;

      case 'user_status':
        this.statusListeners.forEach(listener => {
          try {
            listener(message.data);
          } catch (error) {
            console.error('❌ NativeWebSocketService: Erreur dans listener de statut', error);
          }
        });
        break;
    }
  }

  private send(message: WebSocketMessage) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ NativeWebSocketService: Tentative d\'envoi sans connexion', message);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ NativeWebSocketService: Nombre maximal de tentatives de reconnexion atteint, rechargement de la page...');
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1000);
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Backoff exponentiel, max 30s
    this.reconnectAttempts++;

    console.log(`🔄 NativeWebSocketService: Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.initializeConnection();
    }, delay);
  }

  // API publique
  setCurrentUser(user: User) {
    this.currentUser = user;
    console.log('👤 NativeWebSocketService: Utilisateur configuré', { 
      userId: user.id, 
      username: user.username 
    });
    
    // Démarrer la connexion WebSocket maintenant que l'utilisateur est défini
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.initializeConnection();
    }
  }

  joinConversation(conversationId: string) {
    this.send({
      type: 'join_conversation',
      conversationId,
      data: { userId: this.currentUser?.id }
    });
  }

  leaveConversation(conversationId: string) {
    this.send({
      type: 'leave_conversation',
      conversationId,
      data: { userId: this.currentUser?.id }
    });
  }

  async sendMessage(conversationId: string, content: string): Promise<boolean> {
    try {
      this.send({
        type: 'new_message',
        conversationId,
        data: {
          content,
          senderId: this.currentUser?.id,
          conversationId
        }
      });
      return true;
    } catch (error) {
      console.error('❌ NativeWebSocketService: Erreur envoi message', error);
      return false;
    }
  }

  async editMessage(messageId: string, newContent: string): Promise<boolean> {
    try {
      this.send({
        type: 'message_edited',
        messageId,
        data: {
          id: messageId,
          content: newContent
        }
      });
      return true;
    } catch (error) {
      console.error('❌ NativeWebSocketService: Erreur édition message', error);
      return false;
    }
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      this.send({
        type: 'message_deleted',
        messageId,
        data: { id: messageId }
      });
      return true;
    } catch (error) {
      console.error('❌ NativeWebSocketService: Erreur suppression message', error);
      return false;
    }
  }

  startTyping(conversationId: string) {
    this.send({
      type: 'user_typing',
      conversationId,
      data: {
        userId: this.currentUser?.id,
        username: this.currentUser?.username,
        isTyping: true
      }
    });
  }

  stopTyping(conversationId: string) {
    this.send({
      type: 'user_typing',
      conversationId,
      data: {
        userId: this.currentUser?.id,
        username: this.currentUser?.username,
        isTyping: false
      }
    });
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

  // État et diagnostic
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      hasSocket: !!this.ws,
      currentUser: this.currentUser?.username || ''
    };
  }

  reconnect() {
    console.log('🔄 NativeWebSocketService: Reconnexion manuelle...');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.initializeConnection();
  }

  getConnectionDiagnostics() {
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000').replace(/^http/, 'ws');
    return {
      hasSocket: !!this.ws,
      isConnected: this.isConnected,
      socketState: this.ws?.readyState,
      socketStates: {
        CONNECTING: WebSocket.CONNECTING,
        OPEN: WebSocket.OPEN,
        CLOSING: WebSocket.CLOSING,
        CLOSED: WebSocket.CLOSED
      },
      url: `${wsUrl}/ws`,
      hasToken: !!localStorage.getItem('auth_token'),
      currentUser: this.currentUser?.username,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Déconnexion normale');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.currentUser = null;
    
    // Nettoyer les listeners
    this.messageListeners.clear();
    this.editListeners.clear();
    this.deleteListeners.clear();
    this.typingListeners.clear();
    this.statusListeners.clear();
    
    console.log('🧹 NativeWebSocketService: État de connexion nettoyé');
    
    // Recharger la page après nettoyage
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 500);
  }
}

// Instance singleton
export const nativeWebSocketService = new NativeWebSocketService();
