/**
 * Service WebSocket Simplifié pour Meeshy
 * 
 * PRINCIPE SIMPLE:
 * 1. Connexion globale dès qu'on a une session (auth ou anonyme)
 * 2. Join conversation quand on est sur une page de conversation
 * 3. Leave conversation quand on change de page/conversation
 * 4. Reconnexion automatique
 * 
 * APPROCHE UNIFORME: Même logique partout (/, /chat, /conversations)
 */

'use client';

import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import type { 
  Message, 
  User,
  ServerToClientEvents,
  ClientToServerEvents,
  TranslationEvent,
  TypingEvent,
  UserStatusEvent
} from '@/types';
import { SERVER_EVENTS, CLIENT_EVENTS } from '@shared/types/socketio-events';

class WebSocketService {
  private static instance: WebSocketService | null = null;
  
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isAuthenticated = false;
  
  // Listeners
  private messageListeners: Set<(message: Message) => void> = new Set();
  private translationListeners: Set<(data: TranslationEvent) => void> = new Set();
  private typingListeners: Set<(event: TypingEvent) => void> = new Set();
  private statusListeners: Set<(event: UserStatusEvent) => void> = new Set();

  private constructor() {
    // Initialisation au chargement si token disponible
    if (typeof window !== 'undefined') {
      setTimeout(() => this.autoConnect(), 100);
    }
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * ÉTAPE 1: Connexion automatique si token disponible
   * → Connexion globale pour toute la plateforme
   */
  private autoConnect(): void {
    const authToken = localStorage.getItem('auth_token');
    const sessionToken = localStorage.getItem('anonymous_session_token');
    
    if (!authToken && !sessionToken) {
      console.log('🔒 [WS] Pas de token, connexion différée');
      return;
    }
    
    if (this.socket?.connected) {
      console.log('✅ [WS] Déjà connecté');
      return;
    }
    
    this.connect();
  }

  /**
   * ÉTAPE 2: Créer et connecter le socket
   */
  private connect(): void {
    const authToken = localStorage.getItem('auth_token');
    const sessionToken = localStorage.getItem('anonymous_session_token');
    
    console.log('🔌 [WS] Connexion au WebSocket...');
    
    // Déterminer l'URL du gateway
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsUrl = isLocalhost ? 'ws://localhost:3000' : 'wss://gate.meeshy.me';
    
    // Préparer auth
    const auth: any = {};
    if (authToken) {
      auth.authToken = authToken;
      auth.tokenType = 'jwt';
    }
    if (sessionToken) {
      auth.sessionToken = sessionToken;
      auth.sessionType = 'anonymous';
    }
    
    // Créer socket SANS auto-connect
    this.socket = io(wsUrl, {
      auth,
      transports: ['websocket', 'polling'],
      reconnection: true,
      autoConnect: false,
      path: '/socket.io/'
    });
    
    // Configurer listeners AVANT de connecter
    this.setupListeners();
    
    // Connecter
    this.socket.connect();
  }

  /**
   * ÉTAPE 3: Configurer les listeners
   */
  private setupListeners(): void {
    if (!this.socket) return;
    
    // Connexion
    this.socket.on('connect', () => {
      console.log('✅ [WS] Connecté, socket ID:', this.socket?.id);
    });
    
    // Authentification
    this.socket.on(SERVER_EVENTS.AUTHENTICATED, (response: any) => {
      if (response?.success) {
        this.isAuthenticated = true;
        console.log('✅ [WS] Authentifié:', response.user?.id);
        toast.success('Connexion établie');
      } else {
        console.error('❌ [WS] Auth échouée:', response?.error);
        toast.error('Échec authentification');
      }
    });
    
    // Déconnexion
    this.socket.on('disconnect', (reason) => {
      this.isAuthenticated = false;
      console.log('🔌 [WS] Déconnecté:', reason);
      
      // Reconnexion auto après 2s
      if (reason !== 'io client disconnect') {
        setTimeout(() => this.reconnect(), 2000);
      }
    });
    
    // Nouveaux messages
    this.socket.on(SERVER_EVENTS.MESSAGE_NEW, (message: any) => {
      console.log('📨 [WS] Nouveau message:', message.id);
      this.messageListeners.forEach(listener => listener(message));
    });
    
    // Traductions
    this.socket.on(SERVER_EVENTS.MESSAGE_TRANSLATION, (data: any) => {
      console.log('🌐 [WS] Traduction reçue:', data.messageId);
      this.translationListeners.forEach(listener => listener(data));
    });
    
    // Frappe
    this.socket.on(SERVER_EVENTS.TYPING_START, (event: TypingEvent) => {
      this.typingListeners.forEach(listener => listener({ ...event, isTyping: true } as any));
    });
    
    this.socket.on(SERVER_EVENTS.TYPING_STOP, (event: TypingEvent) => {
      this.typingListeners.forEach(listener => listener({ ...event, isTyping: false } as any));
    });
    
    // Statut utilisateurs
    this.socket.on(SERVER_EVENTS.USER_STATUS, (event: UserStatusEvent) => {
      this.statusListeners.forEach(listener => listener(event));
    });
    
    // Erreurs
    this.socket.on(SERVER_EVENTS.ERROR, (error: any) => {
      console.error('❌ [WS] Erreur:', error);
    });
  }

  /**
   * ÉTAPE 4: Rejoindre une conversation
   * → Appelé quand on arrive sur une page de conversation
   */
  public joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ [WS] Socket non connecté, join impossible');
      return;
    }
    
    console.log('🚪 [WS] Join conversation:', conversationId);
    this.socket.emit(CLIENT_EVENTS.CONVERSATION_JOIN, { conversationId });
  }

  /**
   * ÉTAPE 5: Quitter une conversation
   * → Appelé quand on quitte la page de conversation
   */
  public leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      return;
    }
    
    console.log('🚪 [WS] Leave conversation:', conversationId);
    this.socket.emit(CLIENT_EVENTS.CONVERSATION_LEAVE, { conversationId });
  }

  /**
   * ÉTAPE 6: Envoyer un message
   */
  public async sendMessage(conversationId: string, content: string, language: string, replyToId?: string): Promise<boolean> {
    if (!this.socket?.connected) {
      console.error('❌ [WS] Socket non connecté');
      toast.error('Connexion perdue, reconnexion...');
      this.reconnect();
      return false;
    }
    
    return new Promise((resolve) => {
      console.log('📤 [WS] Envoi message:', { conversationId, language });
      
      const timeout = setTimeout(() => {
        console.error('❌ [WS] Timeout envoi message');
        resolve(false);
      }, 10000);
      
      this.socket!.emit(CLIENT_EVENTS.MESSAGE_SEND, {
        conversationId,
        content,
        originalLanguage: language,
        replyToId
      }, (response: any) => {
        clearTimeout(timeout);
        
        if (response?.success) {
          console.log('✅ [WS] Message envoyé:', response.data?.messageId);
          resolve(true);
        } else {
          console.error('❌ [WS] Échec envoi:', response?.error);
          toast.error(response?.error || 'Échec envoi message');
          resolve(false);
        }
      });
    });
  }

  /**
   * ÉTAPE 7: Reconnexion
   */
  public reconnect(): void {
    console.log('🔄 [WS] Reconnexion...');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }
    
    this.isAuthenticated = false;
    this.connect();
  }

  /**
   * ÉTAPE 8: Frappe
   */
  public startTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit(CLIENT_EVENTS.TYPING_START, { conversationId });
  }

  public stopTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit(CLIENT_EVENTS.TYPING_STOP, { conversationId });
  }

  /**
   * ÉTAPE 9: Listeners
   */
  public onNewMessage(listener: (message: Message) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onTranslation(listener: (data: TranslationEvent) => void): () => void {
    this.translationListeners.add(listener);
    return () => this.translationListeners.delete(listener);
  }

  public onTyping(listener: (event: TypingEvent) => void): () => void {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  public onUserStatus(listener: (event: UserStatusEvent) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * ÉTAPE 10: État
   */
  public isConnected(): boolean {
    return this.socket?.connected === true && this.isAuthenticated;
  }

  public getConnectionStatus() {
    return {
      isConnected: this.isConnected(),
      socketId: this.socket?.id,
      authenticated: this.isAuthenticated
    };
  }
}

// Export singleton
export const webSocketService = WebSocketService.getInstance();

