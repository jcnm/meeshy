/**
 * Service Socket.IO pour Meeshy
 * Gestion des connexions temps réel avec le serveur Gateway
 */

'use client';

import { io, Socket } from 'socket.io-client';
import { getWebSocketUrl } from '@/lib/runtime-urls';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
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

// Constantes d'événements Socket.IO (temporaire pour éviter les erreurs d'import)
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
  private conversationStatsListeners: Set<(data: { conversationId: string; stats: any }) => void> = new Set();
  private onlineStatsListeners: Set<(data: { conversationId: string; onlineUsers: any[]; updatedAt: Date }) => void> = new Set();

  constructor() {
    // La connexion sera initialisée quand l'utilisateur sera défini
  }

  /**
   * Initialise la connexion Socket.IO
   */
  private initializeConnection(): void {
    // Vérifier si le code s'exécute côté client
    if (typeof window === 'undefined') {
      logger.socketio.warn('MeeshySocketIOService: Exécution côté serveur, connexion ignorée');
      return;
    }

    // Empêcher les connexions multiples
    if (this.isConnecting || (this.socket && this.isConnected)) {
      logger.socketio.debug('MeeshySocketIOService: Connexion déjà en cours ou établie, ignorée');
      return;
    }

    // Vérifier que l'utilisateur est configuré avant de se connecter
    if (!this.currentUser) {
      logger.socketio.warn('MeeshySocketIOService: Aucun utilisateur configuré, connexion différée');
      this.isConnecting = false;
      return;
    }

    this.isConnecting = true;

    // Récupérer les tokens d'authentification
    const authToken = localStorage.getItem('auth_token');
    const sessionToken = localStorage.getItem('anonymous_session_token');
    
    logger.socketio.debug('MeeshySocketIOService: Vérification des tokens', {
      hasAuthToken: !!authToken,
      hasSessionToken: !!sessionToken,
      authTokenLength: authToken?.length,
      sessionTokenLength: sessionToken?.length,
      authTokenPreview: authToken ? authToken.substring(0, 30) + '...' : 'none',
      sessionTokenPreview: sessionToken ? sessionToken.substring(0, 30) + '...' : 'none'
    });
    
    // Vérifier qu'on a au moins un token
    if (!authToken && !sessionToken) {
      console.warn('🔒 MeeshySocketIOService: Aucun token d\'authentification trouvé');
      this.isConnecting = false;
      return;
    }

    const serverUrl = getWebSocketUrl();
    
    console.log('🔌 MeeshySocketIOService: Initialisation connexion Socket.IO...', {
      serverUrl,
      hasAuthToken: !!authToken,
      hasSessionToken: !!sessionToken,
      authTokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none',
      sessionTokenPreview: sessionToken ? sessionToken.substring(0, 20) + '...' : 'none'
    });

    try {
      // Préparer les headers d'authentification hybride
      const extraHeaders: Record<string, string> = {};
      
      if (authToken) {
        extraHeaders['Authorization'] = `Bearer ${authToken}`;
      }
      
      if (sessionToken) {
        extraHeaders['x-session-token'] = sessionToken;
      }

      this.socket = io(serverUrl, {
        extraHeaders,
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
      
      // L'authentification est maintenant gérée automatiquement via les headers
      // Pas besoin d'envoyer d'événement 'authenticate'
      console.log('🔐 MeeshySocketIOService: Authentification gérée automatiquement via headers');
      
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
    this.socket.on(SERVER_EVENTS.MESSAGE_NEW, (socketMessage) => {
      logger.socketio.debug('MeeshySocketIOService: Nouveau message reçu', {
        messageId: socketMessage.id,
        conversationId: socketMessage.conversationId
      });

      // Convertir en format Message standard
      const message: Message = this.convertSocketMessageToMessage(socketMessage);
      this.messageListeners.forEach(listener => listener(message));

      // Remonter les stats si incluses dans les métadonnées du message
      try {
        const meta = (socketMessage as any)?.meta;
        const conversationStats = meta?.conversationStats;
        if (conversationStats) {
          this.conversationStatsListeners.forEach(listener => listener({
            conversationId: socketMessage.conversationId,
            stats: conversationStats
          }));
        }
      } catch {}
    });

    this.socket.on(SERVER_EVENTS.MESSAGE_EDITED, (socketMessage) => {
      logger.socketio.debug('MeeshySocketIOService: Message modifié', {
        messageId: socketMessage.id
      });

      const message: Message = this.convertSocketMessageToMessage(socketMessage);
      this.editListeners.forEach(listener => listener(message));
    });

    this.socket.on(SERVER_EVENTS.MESSAGE_DELETED, (data) => {
      logger.socketio.debug('MeeshySocketIOService: Message supprimé', {
        messageId: data.messageId
      });

      this.deleteListeners.forEach(listener => listener(data.messageId));
    });

    this.socket.on(SERVER_EVENTS.MESSAGE_TRANSLATION, (data) => {
      logger.socketio.debug('MeeshySocketIOService: Traduction reçue', {
        messageId: data.messageId,
        translationsCount: data.translations.length
      });

      this.translationListeners.forEach(listener => listener(data));
    });

    // Événements de statistiques de conversation
    this.socket.on(SERVER_EVENTS.CONVERSATION_STATS as any, (data: any) => {
      this.conversationStatsListeners.forEach(listener => listener(data));
    });
    this.socket.on(SERVER_EVENTS.CONVERSATION_ONLINE_STATS as any, (data: any) => {
      this.onlineStatsListeners.forEach(listener => listener(data));
    });

    // Événements de frappe - gestion intelligente avec état
    this.socket.on(SERVER_EVENTS.TYPING_START, (event) => {
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

    this.socket.on(SERVER_EVENTS.TYPING_STOP, (event) => {
      console.log('⌨️ MeeshySocketIOService: Frappe arrêtée', { userId: event.userId, conversationId: event.conversationId });
      this.handleTypingStop(event);
    });

    // Événements de statut utilisateur
    this.socket.on(SERVER_EVENTS.USER_STATUS, (event) => {
      this.statusListeners.forEach(listener => listener(event));
    });

    // Événements d'erreur
    this.socket.on(SERVER_EVENTS.ERROR, (error) => {
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

    // Vérifier que le token est disponible (auth_token ou anonymous_session_token)
    const authToken = localStorage.getItem('auth_token');
    const anonymousToken = localStorage.getItem('anonymous_session_token');
    const token = authToken || anonymousToken;
    
    if (!token) {
      console.warn('🔒 MeeshySocketIOService: Token non disponible, connexion différée');
      // Attendre un peu et réessayer plusieurs fois
      let attempts = 0;
      const maxAttempts = 10;
      const retryInterval = setInterval(() => {
        attempts++;
        const retryAuthToken = localStorage.getItem('auth_token');
        const retryAnonymousToken = localStorage.getItem('anonymous_session_token');
        const retryToken = retryAuthToken || retryAnonymousToken;
        
        if (retryToken && this.currentUser) {
          console.log('✅ MeeshySocketIOService: Token trouvé, initialisation connexion...');
          clearInterval(retryInterval);
          this.initializeConnection();
        } else if (attempts >= maxAttempts) {
          console.error('❌ MeeshySocketIOService: Token toujours non disponible après', maxAttempts, 'tentatives');
          clearInterval(retryInterval);
        }
      }, 1000);
      return;
    }

    // Si déjà connecté, juste s'assurer que l'authentification est à jour
    if (this.socket && this.isConnected) {
      console.log('🔐 MeeshySocketIOService: Authentification déjà gérée via headers');
      // L'authentification est maintenant gérée automatiquement via les headers
      // Pas besoin d'envoyer d'événement 'authenticate'
    } else {
      // Initialiser la connexion
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
    this.socket.emit(CLIENT_EVENTS.CONVERSATION_JOIN, { conversationId });
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
    this.socket.emit(CLIENT_EVENTS.CONVERSATION_LEAVE, { conversationId });
  }

  /**
   * Envoie un message
   */
  public async sendMessage(conversationId: string, content: string, originalLanguage?: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        console.error('❌ MeeshySocketIOService: Socket non connecté');
        resolve(false);
        return;
      }

      if (!this.isConnected) {
        console.error('❌ MeeshySocketIOService: Socket connecté mais pas prêt');
        resolve(false);
        return;
      }

      // Vérifier l'état d'authentification
      const authToken = localStorage.getItem('auth_token');
      const sessionToken = localStorage.getItem('anonymous_session_token');
      
      console.log('🔍 MeeshySocketIOService: État avant envoi message', {
        socketId: this.socket.id,
        isConnected: this.isConnected,
        hasAuthToken: !!authToken,
        hasSessionToken: !!sessionToken,
        conversationId,
        contentLength: content.length,
        currentUser: this.currentUser?.id
      });

      console.log('📤 MeeshySocketIOService: Envoi message', {
        conversationId,
        contentLength: content.length,
        originalLanguage
      });

      const messageData = { 
        conversationId, 
        content,
        ...(originalLanguage && { originalLanguage })
      };

      this.socket.emit(CLIENT_EVENTS.MESSAGE_SEND, messageData, (response) => {
        console.log('📨 MeeshySocketIOService: Réponse envoi message', {
          response,
          hasResponse: !!response,
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : []
        });
        
        if (response?.success) {
          console.log('✅ MeeshySocketIOService: Message envoyé avec succès', response);
          resolve(true);
        } else {
          console.error('❌ MeeshySocketIOService: Erreur envoi message', {
            response,
            error: response?.error,
            hasError: !!response?.error
          });
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

      this.socket.emit(CLIENT_EVENTS.MESSAGE_EDIT, { messageId, content }, (response) => {
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

      this.socket.emit(CLIENT_EVENTS.MESSAGE_DELETE, { messageId }, (response) => {
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
    this.socket.emit(CLIENT_EVENTS.TYPING_START, { conversationId });
  }

  /**
   * Arrête l'indicateur de frappe
   */
  public stopTyping(conversationId: string): void {
    if (!this.socket) return;
    this.socket.emit(CLIENT_EVENTS.TYPING_STOP, { conversationId });
  }

  /**
   * Force une reconnexion (méthode publique)
   */
  public reconnect(): void {
    console.log('🔄 MeeshySocketIOService: Reconnexion forcée...');
    
    // Nettoyer la connexion actuelle
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // Réinitialiser la connexion si on a un utilisateur
    if (this.currentUser) {
      this.initializeConnection();
    } else {
      console.warn('🔒 MeeshySocketIOService: Aucun utilisateur configuré pour la reconnexion');
    }
  }  /**
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

  public onConversationStats(listener: (data: { conversationId: string; stats: any }) => void): () => void {
    this.conversationStatsListeners.add(listener);
    return () => this.conversationStatsListeners.delete(listener);
  }

  public onConversationOnlineStats(listener: (data: { conversationId: string; onlineUsers: any[]; updatedAt: Date }) => void): () => void {
    this.onlineStatsListeners.add(listener);
    return () => this.onlineStatsListeners.delete(listener);
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const url = typeof window !== 'undefined' ? getWebSocketUrl() : 'N/A (server-side)';
    
    return {
      isConnected: this.isConnected,
      hasSocket: !!this.socket,
      hasToken: !!token,
      url: url,
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
