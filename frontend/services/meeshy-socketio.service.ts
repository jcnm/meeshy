/**
 * Service Socket.IO pour Meeshy
 * Gestion des connexions temps réel avec le serveur Gateway
 */

'use client';

import { io, Socket } from 'socket.io-client';
import { getWebSocketUrl } from '@/lib/runtime-urls';
import { toast } from 'sonner';
import type { 
  Message, 
  User,
  SocketIOMessage,
  TypingEvent,
  UserStatusEvent,
  TranslationEvent,
  ServerToClientEvents,
  ClientToServerEvents,
  SocketIOResponse
} from '@/types';

class MeeshySocketIOService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isConnected = false;
  private isConnecting = false; // Nouvelle propriété pour éviter les connexions multiples
  private currentUser: User | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Suivi des utilisateurs en train de taper par conversation
  private typingUsers: Map<string, Set<string>> = new Map(); // conversationId -> Set<userId>
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // userId -> timeout

  // Event listeners
  private messageListeners: Set<(message: Message) => void> = new Set();
  private editListeners: Set<(message: Message) => void> = new Set();
  private deleteListeners: Set<(messageId: string) => void> = new Set();
  private translationListeners: Set<(data: TranslationEvent) => void> = new Set();
  private typingListeners: Set<(event: TypingEvent) => void> = new Set();
  private statusListeners: Set<(event: UserStatusEvent) => void> = new Set();

  constructor() {
    // La connexion sera initialisée quand l'utilisateur sera défini
  }

  /**
   * Initialise la connexion Socket.IO
   */
  private initializeConnection(): void {
    // Vérifier si le code s'exécute côté client
    if (typeof window === 'undefined') {
      console.warn('🔒 MeeshySocketIOService: Exécution côté serveur, connexion ignorée');
      return;
    }

    // Empêcher les connexions multiples
    if (this.isConnecting || (this.socket && this.isConnected)) {
      console.log('🔒 MeeshySocketIOService: Connexion déjà en cours ou établie, ignorée');
      return;
    }

    this.isConnecting = true;

    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('🔒 MeeshySocketIOService: Aucun token JWT trouvé');
      this.isConnecting = false;
      return;
    }

    const serverUrl = getWebSocketUrl();
    
    console.log('🔌 MeeshySocketIOService: Initialisation connexion Socket.IO...', {
      serverUrl,
      hasToken: !!token,
      tokenPreview: token.substring(0, 20) + '...'
    });

    try {
      this.socket = io(serverUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      this.setupEventListeners();
      this.isConnecting = false;
    } catch (error) {
      console.error('❌ MeeshySocketIOService: Erreur création Socket.IO', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Configure les gestionnaires d'événements Socket.IO
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Événements de connexion
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      console.log('✅ MeeshySocketIOService: Socket.IO connecté', {
        socketId: this.socket?.id,
        transport: this.socket?.io.engine?.transport.name
      });
      
      // Toast de connexion uniquement, pas pour chaque message
      toast.success('Connexion établie', { duration: 2000 });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.isConnecting = false;
      console.warn('🔌 MeeshySocketIOService: Socket.IO déconnecté', { reason });
      
      if (reason === 'io server disconnect') {
        // Le serveur a forcé la déconnexion, ne pas reconnecter automatiquement
        toast.error('Déconnecté par le serveur');
      } else {
        toast.warning('Connexion perdue, reconnexion...');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ MeeshySocketIOService: Erreur connexion Socket.IO', error);
      this.isConnected = false;
      this.isConnecting = false;
      this.scheduleReconnect();
    });

    // Événements de messages
    this.socket.on('message:new', (socketMessage) => {
      console.log('📨 MeeshySocketIOService: Nouveau message reçu', {
        messageId: socketMessage.id,
        conversationId: socketMessage.conversationId
      });

      // Convertir en format Message standard
      const message: Message = this.convertSocketMessageToMessage(socketMessage);
      this.messageListeners.forEach(listener => listener(message));
    });

    this.socket.on('message:edited', (socketMessage) => {
      console.log('✏️ MeeshySocketIOService: Message modifié', {
        messageId: socketMessage.id
      });

      const message: Message = this.convertSocketMessageToMessage(socketMessage);
      this.editListeners.forEach(listener => listener(message));
    });

    this.socket.on('message:deleted', (data) => {
      console.log('🗑️ MeeshySocketIOService: Message supprimé', {
        messageId: data.messageId
      });

      this.deleteListeners.forEach(listener => listener(data.messageId));
    });

    this.socket.on('message:translation', (data) => {
      console.log('🌐 MeeshySocketIOService: Traduction reçue', {
        messageId: data.messageId,
        translationsCount: data.translations.length
      });

      this.translationListeners.forEach(listener => listener(data));
    });

    // Événements de frappe - gestion intelligente avec état
    this.socket.on('typing:start', (event) => {
      console.log('⌨️ MeeshySocketIOService: Frappe commencée', { userId: event.userId, conversationId: event.conversationId });
      
      // Ajouter l'utilisateur à la liste des tapeurs pour cette conversation
      if (!this.typingUsers.has(event.conversationId)) {
        this.typingUsers.set(event.conversationId, new Set());
      }
      this.typingUsers.get(event.conversationId)!.add(event.userId);
      
      // Nettoyer le timeout précédent s'il existe
      const timeoutKey = `${event.conversationId}:${event.userId}`;
      if (this.typingTimeouts.has(timeoutKey)) {
        clearTimeout(this.typingTimeouts.get(timeoutKey)!);
      }
      
      // Auto-arrêt après 5 secondes
      const timeout = setTimeout(() => {
        this.handleTypingStop(event);
      }, 5000);
      this.typingTimeouts.set(timeoutKey, timeout);
      
      // Notifier les listeners avec isTyping = true
      this.typingListeners.forEach(listener => listener({ ...event, isTyping: true } as any));
    });

    this.socket.on('typing:stop', (event) => {
      console.log('⌨️ MeeshySocketIOService: Frappe arrêtée', { userId: event.userId, conversationId: event.conversationId });
      this.handleTypingStop(event);
    });

    // Événements de statut utilisateur
    this.socket.on('user:status', (event) => {
      this.statusListeners.forEach(listener => listener(event));
    });

    // Événements d'erreur
    this.socket.on('error', (error) => {
      console.error('❌ MeeshySocketIOService: Erreur serveur', error);
      toast.error(error.message || 'Erreur serveur');
    });
  }

  /**
   * Gère l'arrêt de frappe d'un utilisateur
   */
  private handleTypingStop(event: TypingEvent): void {
    const timeoutKey = `${event.conversationId}:${event.userId}`;
    
    // Nettoyer le timeout
    if (this.typingTimeouts.has(timeoutKey)) {
      clearTimeout(this.typingTimeouts.get(timeoutKey)!);
      this.typingTimeouts.delete(timeoutKey);
    }
    
    // Retirer l'utilisateur de la liste des tapeurs
    if (this.typingUsers.has(event.conversationId)) {
      this.typingUsers.get(event.conversationId)!.delete(event.userId);
      
      // Nettoyer la conversation si plus personne ne tape
      if (this.typingUsers.get(event.conversationId)!.size === 0) {
        this.typingUsers.delete(event.conversationId);
      }
    }
    
    // Notifier les listeners avec isTyping = false
    this.typingListeners.forEach(listener => listener({ ...event, isTyping: false } as any));
  }

  /**
   * Convertit un message Socket.IO en Message standard
   */
  private convertSocketMessageToMessage(socketMessage: SocketIOMessage): Message {
    return {
      id: socketMessage.id,
      conversationId: socketMessage.conversationId,
      senderId: socketMessage.senderId || '',
      content: socketMessage.content,
      originalLanguage: socketMessage.originalLanguage,
      messageType: socketMessage.messageType,
      isEdited: socketMessage.isEdited,
      isDeleted: socketMessage.isDeleted,
      createdAt: socketMessage.createdAt,
      updatedAt: socketMessage.updatedAt,
      sender: socketMessage.sender || {
        id: socketMessage.senderId || '',
        username: 'Utilisateur inconnu',
        firstName: '',
        lastName: '',
        displayName: 'Utilisateur inconnu',
        email: '',
        phoneNumber: '',
        role: 'USER',
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        customDestinationLanguage: undefined,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: false,
        avatar: undefined,
        lastSeen: new Date(),
        createdAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true,
        updatedAt: new Date()
      }
    };
  }

  /**
   * Programme une tentative de reconnexion
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ MeeshySocketIOService: Nombre maximum de tentatives de reconnexion atteint');
      toast.error('Impossible de se reconnecter. Veuillez recharger la page.');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Backoff exponentiel
    this.reconnectAttempts++;

    console.log(`⏰ MeeshySocketIOService: Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isConnected) {
        this.initializeConnection();
      }
    }, delay);
  }

  /**
   * Définit l'utilisateur actuel et initialise la connexion
   */
  public setCurrentUser(user: User): void {
    this.currentUser = user;
    console.log('🔧 MeeshySocketIOService: Utilisateur configuré', {
      userId: user.id,
      username: user.username
    });

    if (!this.socket || !this.isConnected) {
      this.initializeConnection();
    }
  }

  /**
   * Rejoint une conversation
   */
  public joinConversation(conversationId: string): void {
    if (!this.socket) {
      console.warn('⚠️ MeeshySocketIOService: Socket non connecté, impossible de rejoindre la conversation');
      return;
    }

    console.log('🚪 MeeshySocketIOService: Rejoindre conversation', { conversationId });
    this.socket.emit('conversation:join', { conversationId });
  }

  /**
   * Quitte une conversation
   */
  public leaveConversation(conversationId: string): void {
    if (!this.socket) {
      console.warn('⚠️ MeeshySocketIOService: Socket non connecté, impossible de quitter la conversation');
      return;
    }

    console.log('🚪 MeeshySocketIOService: Quitter conversation', { conversationId });
    this.socket.emit('conversation:leave', { conversationId });
  }

  /**
   * Envoie un message
   */
  public async sendMessage(conversationId: string, content: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        console.error('❌ MeeshySocketIOService: Socket non connecté');
        resolve(false);
        return;
      }

      console.log('📤 MeeshySocketIOService: Envoi message', {
        conversationId,
        contentLength: content.length
      });

      this.socket.emit('message:send', { conversationId, content }, (response) => {
        if (response?.success) {
          console.log('✅ MeeshySocketIOService: Message envoyé avec succès', response);
          resolve(true);
        } else {
          console.error('❌ MeeshySocketIOService: Erreur envoi message', response);
          toast.error(response?.error || 'Erreur lors de l\'envoi du message');
          resolve(false);
        }
      });
    });
  }

  /**
   * Modifie un message
   */
  public async editMessage(messageId: string, content: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        console.error('❌ MeeshySocketIOService: Socket non connecté');
        resolve(false);
        return;
      }

      console.log('✏️ MeeshySocketIOService: Modification message', { messageId });

      this.socket.emit('message:edit', { messageId, content }, (response) => {
        if (response?.success) {
          console.log('✅ MeeshySocketIOService: Message modifié avec succès');
          resolve(true);
        } else {
          console.error('❌ MeeshySocketIOService: Erreur modification message', response);
          toast.error(response?.error || 'Erreur lors de la modification du message');
          resolve(false);
        }
      });
    });
  }

  /**
   * Supprime un message
   */
  public async deleteMessage(messageId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        console.error('❌ MeeshySocketIOService: Socket non connecté');
        resolve(false);
        return;
      }

      console.log('🗑️ MeeshySocketIOService: Suppression message', { messageId });

      this.socket.emit('message:delete', { messageId }, (response) => {
        if (response?.success) {
          console.log('✅ MeeshySocketIOService: Message supprimé avec succès');
          resolve(true);
        } else {
          console.error('❌ MeeshySocketIOService: Erreur suppression message', response);
          toast.error(response?.error || 'Erreur lors de la suppression du message');
          resolve(false);
        }
      });
    });
  }

  /**
   * Démarre l'indicateur de frappe
   */
  public startTyping(conversationId: string): void {
    if (!this.socket) return;
    this.socket.emit('typing:start', { conversationId });
  }

  /**
   * Arrête l'indicateur de frappe
   */
  public stopTyping(conversationId: string): void {
    if (!this.socket) return;
    this.socket.emit('typing:stop', { conversationId });
  }

  /**
   * Force la reconnexion
   */
  public reconnect(): void {
    console.log('🔄 MeeshySocketIOService: Reconnexion forcée');
    this.socket?.disconnect();
    this.reconnectAttempts = 0;
    this.initializeConnection();
  }

  /**
   * Gestionnaires d'événements
   */
  public onNewMessage(listener: (message: Message) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onMessageEdited(listener: (message: Message) => void): () => void {
    this.editListeners.add(listener);
    return () => this.editListeners.delete(listener);
  }

  public onMessageDeleted(listener: (messageId: string) => void): () => void {
    this.deleteListeners.add(listener);
    return () => this.deleteListeners.delete(listener);
  }

  public onTranslation(listener: (data: TranslationEvent) => void): () => void {
    this.translationListeners.add(listener);
    return () => this.translationListeners.delete(listener);
  }

  public onTyping(listener: (event: TypingEvent) => void): () => void {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  public onTypingStart(listener: (event: TypingEvent) => void): () => void {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  public onTypingStop(listener: (event: TypingEvent) => void): () => void {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  public onUserStatus(listener: (event: UserStatusEvent) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Obtient le statut de connexion
   */
  public getConnectionStatus(): {
    isConnected: boolean;
    hasSocket: boolean;
    currentUser: string;
  } {
    return {
      isConnected: this.isConnected,
      hasSocket: !!this.socket,
      currentUser: this.currentUser?.username || 'Non défini'
    };
  }

  /**
   * Obtient des diagnostics de connexion
   */
  public getConnectionDiagnostics(): any {
    return {
      isConnected: this.isConnected,
      hasSocket: !!this.socket,
      socketId: this.socket?.id,
      transport: this.socket?.io.engine?.transport.name,
      reconnectAttempts: this.reconnectAttempts,
      currentUser: this.currentUser?.username,
      listenersCount: {
        message: this.messageListeners.size,
        edit: this.editListeners.size,
        delete: this.deleteListeners.size,
        translation: this.translationListeners.size,
        typing: this.typingListeners.size,
        status: this.statusListeners.size
      }
    };
  }

  /**
   * Nettoie les ressources
   */
  public cleanup(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Nettoyer tous les timeouts de frappe
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
    this.typingUsers.clear();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.messageListeners.clear();
    this.editListeners.clear();
    this.deleteListeners.clear();
    this.translationListeners.clear();
    this.typingListeners.clear();
    this.statusListeners.clear();

    this.isConnected = false;
    this.currentUser = null;
  }
}

// Instance singleton
export const meeshySocketIOService = new MeeshySocketIOService();
