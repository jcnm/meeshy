/**
 * Service Socket.IO pour Meeshy
 * Gestion des connexions temps réel avec le serveur Gateway
 */

'use client';

import { io, Socket } from 'socket.io-client';
import { getWebSocketUrl } from '@/lib/config';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { logConversationIdDebug, getConversationIdType, getConversationApiId } from '@/utils/conversation-id-utils';
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

// Import des constantes d'événements depuis les types partagés
import { SERVER_EVENTS, CLIENT_EVENTS } from '@shared/types/socketio-events';

// Import des traductions
import enTranslations from '@/locales/en';
import frTranslations from '@/locales/fr';

class MeeshySocketIOService {
  private static instance: MeeshySocketIOService | null = null;
  
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isConnected = false;
  private isConnecting = false; // Nouvelle propriété pour éviter les connexions multiples
  private currentUser: User | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  /**
   * Fonction utilitaire pour obtenir la traduction selon la langue de l'utilisateur
   */
  private t(key: string): string {
    try {
      const userLang = typeof window !== 'undefined' ? localStorage.getItem('user_language') || 'en' : 'en';
      const translations = userLang === 'fr' ? frTranslations : enTranslations;
      
      const keys = key.split('.');
      let value: any = translations;
      for (const k of keys) {
        value = value?.[k];
      }
      return value || key;
    } catch {
      return key;
    }
  }

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

  // Amélioration: Gestion des traductions en batch et mise en cache
  private translationCache: Map<string, any> = new Map(); // Cache pour éviter les traductions redondantes
  private pendingTranslations: Map<string, Promise<any>> = new Map(); // Éviter les traductions simultanées
  private translationBatch: Map<string, any[]> = new Map(); // Traductions en lot par message
  private processedTranslationEvents: Set<string> = new Set(); // Déduplication des événements de traduction
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // ms - délai pour grouper les traductions

  // Callback pour récupérer un message par ID (fourni par le composant qui a la liste des messages)
  private getMessageByIdCallback: ((messageId: string) => Message | undefined) | null = null;

  constructor() {
    // La connexion sera initialisée quand l'utilisateur sera défini
  }

  /**
   * Définit le callback pour récupérer un message par ID
   * Ce callback sera utilisé pour reconstituer replyTo depuis les messages existants
   */
  public setGetMessageByIdCallback(callback: (messageId: string) => Message | undefined): void {
    this.getMessageByIdCallback = callback;
  }

  /**
   * Obtenir l'instance singleton du service Socket.IO
   */
  static getInstance(): MeeshySocketIOService {
    if (!MeeshySocketIOService.instance) {
      MeeshySocketIOService.instance = new MeeshySocketIOService();
    }
    return MeeshySocketIOService.instance;
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

    // Vérifier si on est sur une page publique (pas besoin de WebSocket)
    const currentPath = window.location.pathname;
    const publicPaths = ['/about', '/contact', '/privacy', '/terms', '/partners'];
    
    if (publicPaths.includes(currentPath)) {
      logger.socketio.debug('MeeshySocketIOService: Page publique détectée, connexion ignorée', { path: currentPath });
      return;
    }

    // Empêcher les connexions multiples
    if (this.isConnecting || (this.socket && this.isConnected)) {
      console.log('🔌 Connexion déjà active, ignorée');
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
    
    // Préparer les headers d'authentification hybride
    const extraHeaders: Record<string, string> = {};
    
    if (authToken) {
      extraHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    
    if (sessionToken) {
      extraHeaders['x-session-token'] = sessionToken;
    }
    
    console.log('🔌 MeeshySocketIOService: Initialisation connexion Socket.IO...', {
      serverUrl,
      hasAuthToken: !!authToken,
      hasSessionToken: !!sessionToken,
      authTokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none',
      sessionTokenPreview: sessionToken ? sessionToken.substring(0, 20) + '...' : 'none',
      extraHeaders
    });

    console.log('🔐 MeeshySocketIOService: Headers d\'authentification préparés', {
      extraHeaders,
      headerKeys: Object.keys(extraHeaders),
      hasAuthHeader: !!extraHeaders['Authorization'],
      hasSessionHeader: !!extraHeaders['x-session-token']
    });

    try {
      // Préparer les données d'authentification avec types de tokens précis
      const authData: any = {};
      
      // Token JWT pour utilisateurs authentifiés
      if (authToken) {
        authData.authToken = authToken;  // Token principal d'authentification
        authData.tokenType = 'jwt';      // Type de token explicite
      }
      
      // Session token pour utilisateurs anonymes
      if (sessionToken) {
        authData.sessionToken = sessionToken;
        authData.sessionType = 'anonymous';  // Type de session explicite
      }

      this.socket = io(serverUrl, {
        auth: authData,
        extraHeaders, // Garder aussi extraHeaders comme fallback
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000,
        path: '/socket.io/',
        forceNew: true
      });

      this.setupEventListeners();
      this.isConnecting = false;
    } catch (error) {
      console.error('Erreur création Socket.IO', error);
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
      // NE PAS mettre isConnected = true ici, attendre la confirmation d'authentification
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      console.log('Socket.IO connecté (en attente d\'authentification)', {
        socketId: this.socket?.id,
        transport: this.socket?.io.engine?.transport.name
      });
      
      // L'authentification est gérée automatiquement via les headers
      // Le backend doit émettre SERVER_EVENTS.AUTHENTICATED après validation
      console.log('⏳ En attente de confirmation d\'authentification...');
    });

    // CORRECTION: Écouter l'événement AUTHENTICATED du backend
    this.socket.on(SERVER_EVENTS.AUTHENTICATED, (response: any) => {
      if (response?.success) {
        this.isConnected = true;
        console.log('✅ Authentification confirmée par le serveur', {
          userId: response.user?.id,
          isAnonymous: response.user?.isAnonymous,
          language: response.user?.language
        });
        toast.success(this.t('common.websocket.connected'));
      } else {
        this.isConnected = false;
        console.error('❌ Authentification refusée par le serveur:', response?.error);
        toast.error(this.t('common.websocket.authenticationFailed') + ': ' + (response?.error || 'Erreur inconnue'));
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.isConnecting = false;
      console.warn('🔌 MeeshySocketIOService: Socket.IO déconnecté', { reason });
      
      // CORRECTION: Ne pas afficher de toast pour les déconnexions normales du client
      // "io client disconnect" = déconnexion volontaire (changement de page, multi-onglets, etc.)
      // "io server disconnect" = le serveur a forcé la déconnexion (onglet dupliqué détecté)
      if (reason === 'io server disconnect') {
        // Le serveur a forcé la déconnexion (connexion multiple détectée)
        // C'est normal quand on ouvre un deuxième onglet - pas besoin de toast d'erreur
        console.log('🔄 Déconnexion par le serveur (connexion multiple détectée)');
      } else if (reason !== 'io client disconnect' && reason !== 'transport close') {
        // Seulement afficher un toast pour les déconnexions inattendues
        toast.warning(this.t('common.websocket.connectionLostReconnecting'));
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
      console.log('📨 MeeshySocketIOService: Nouveau message reçu', {
        messageId: socketMessage.id,
        conversationId: socketMessage.conversationId,
        senderId: socketMessage.senderId,
        replyToId: socketMessage.replyToId,
        content: socketMessage.content?.substring(0, 50) + '...',
        receivedOnPage: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        listenersCount: this.messageListeners.size,
        timestamp: new Date().toISOString()
      });

      // Convertir en format Message standard
      const message: Message = this.convertSocketMessageToMessage(socketMessage);
      console.log('🔄 Broadcasting message to', this.messageListeners.size, 'listeners');
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

    this.socket.on(SERVER_EVENTS.MESSAGE_TRANSLATION, (data: any) => {
      // SUPPORT DES DEUX FORMATS: singulier (nouveau) et pluriel (ancien)
      // Format singulier: { translation: {...} } - Une traduction par événement (diffusion immédiate)
      // Format pluriel: { translations: [{...}] } - Toutes les traductions groupées (ancien format)
      
      let translations: any[];
      if (data.translation) {
        // NOUVEAU FORMAT SINGULIER (diffusion immédiate)
        translations = [data.translation];
      } else if (data.translations && Array.isArray(data.translations)) {
        // ANCIEN FORMAT PLURIEL (rétrocompatibilité)
        translations = data.translations;
      } else {
        console.warn('⚠️ [SOCKETIO-SERVICE] Format de traduction invalide:', data);
        return;
      }
      
      // Déduplication des événements basée sur messageId + timestamp de la traduction
      const firstTranslation = translations[0];
      const eventKey = `${data.messageId}_${firstTranslation?.id || firstTranslation?.targetLanguage || Date.now()}`;
      
      if (this.processedTranslationEvents.has(eventKey)) {
        console.log('🔄 [SOCKETIO-SERVICE] Événement de traduction déjà traité, ignoré:', eventKey);
        return;
      }
      
      this.processedTranslationEvents.add(eventKey);
      
      // Nettoyer les anciens événements (garder seulement les 100 derniers)
      if (this.processedTranslationEvents.size > 100) {
        const oldEvents = Array.from(this.processedTranslationEvents).slice(0, 50);
        oldEvents.forEach(oldEventKey => this.processedTranslationEvents.delete(oldEventKey));
      }
      
      console.group('🚀 [SOCKETIO-SERVICE] NOUVELLE TRADUCTION REÇUE');
      console.log('📥 [FRONTEND] Traduction reçue via Socket.IO:', {
        messageId: data.messageId,
        format: data.translation ? 'singulier (diffusion immédiate)' : 'pluriel (groupé)',
        translationsCount: translations.length,
        eventKey,
        firstTranslation: firstTranslation ? {
          id: firstTranslation.id,
          targetLanguage: firstTranslation.targetLanguage,
          translatedContent: firstTranslation.translatedContent?.substring(0, 50) + '...',
          confidenceScore: firstTranslation.confidenceScore,
          translationModel: firstTranslation.translationModel,
          cacheKey: firstTranslation.cacheKey,
          cached: firstTranslation.cached,
          createdAt: firstTranslation.createdAt
        } : null
      });
      
      logger.socketio.debug('MeeshySocketIOService: Traduction reçue', {
        messageId: data.messageId,
        format: data.translation ? 'singulier' : 'pluriel',
        translationsCount: translations.length,
        translations: translations
      });

      // Mise en cache de la traduction reçue
      if (translations && translations.length > 0) {
        console.log('🔄 [SOCKETIO-SERVICE] Mise en cache des traductions...');
        translations.forEach((translation, index) => {
          const cacheKey = `${data.messageId}_${translation.targetLanguage}`;
          this.translationCache.set(cacheKey, translation);
          console.log(`  ${index + 1}. Cache: ${cacheKey} → ${translation.translatedContent?.substring(0, 30)}...`);
        });
      }

      console.log(`📡 [SOCKETIO-SERVICE] Notification à ${this.translationListeners.size} listeners...`);
      // Notifier tous les listeners avec format normalisé (toujours pluriel pour cohérence interne)
      const normalizedData = {
        messageId: data.messageId,
        translations: translations
      };
      
      let listenerIndex = 0;
      this.translationListeners.forEach((listener) => {
        listenerIndex++;
        console.log(`  → Listener ${listenerIndex}: Envoi des données normalisées...`);
        listener(normalizedData);
      });
      
      console.groupEnd();
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
      console.error('❌ MeeshySocketIOService: Erreur serveur', {
        error,
        errorType: typeof error,
        errorKeys: error ? Object.keys(error) : [],
        errorMessage: error?.message,
        errorCode: error?.code,
        socketId: this.socket?.id,
        isConnected: this.isConnected,
        currentUser: this.currentUser?.id
      });
      
      // Vérifier l'état d'authentification au moment de l'erreur
      const authToken = localStorage.getItem('auth_token');
      const sessionToken = localStorage.getItem('anonymous_session_token');
      
      console.log('🔍 MeeshySocketIOService: État d\'authentification lors de l\'erreur', {
        hasAuthToken: !!authToken,
        hasSessionToken: !!sessionToken,
        authTokenLength: authToken?.length,
        sessionTokenLength: sessionToken?.length,
        authTokenPreview: authToken ? authToken.substring(0, 30) + '...' : 'none',
        sessionTokenPreview: sessionToken ? sessionToken.substring(0, 30) + '...' : 'none'
      });
      
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
    // Reconstituer replyTo depuis la liste des messages existants si replyToId est présent
    let replyTo: Message | undefined = undefined;
    if (socketMessage.replyToId && this.getMessageByIdCallback) {
      replyTo = this.getMessageByIdCallback(socketMessage.replyToId);
      if (replyTo) {
        console.log(`💬 [MESSAGES] Message réponse reconstitué depuis la liste: ${socketMessage.replyToId}`);
      } else {
        console.warn(`⚠️ [MESSAGES] Message ${socketMessage.replyToId} non trouvé dans la liste pour replyTo`);
      }
    } else if (socketMessage.replyToId && !this.getMessageByIdCallback) {
      console.warn(`⚠️ [MESSAGES] Callback getMessageById non défini, impossible de reconstituer replyTo`);
    }

    return {
      id: socketMessage.id,
      conversationId: socketMessage.conversationId,
      senderId: socketMessage.senderId || '',
      content: socketMessage.content,
      originalLanguage: socketMessage.originalLanguage || 'fr',
      messageType: socketMessage.messageType,
      timestamp: socketMessage.createdAt,
      createdAt: socketMessage.createdAt,
      updatedAt: socketMessage.updatedAt,
      isEdited: false,
      isDeleted: false,
      translations: [],
      // Utiliser le message depuis le cache si disponible
      replyTo: replyTo,
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
      console.warn('⚠️ MeeshySocketIOService: Nombre maximum de tentatives de reconnexion atteint (backend non disponible)');
      // toast.error('Impossible de se reconnecter. Veuillez recharger la page.'); // Désactivé temporairement
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
   * Rejoint une conversation (accepte soit un ID soit un objet conversation)
   */
  public joinConversation(conversationOrId: any): void {
    if (!this.socket) {
      console.warn('⚠️ MeeshySocketIOService: Socket non connecté, impossible de rejoindre la conversation');
      return;
    }

    try {
      // Déterminer si c'est un ID ou un objet conversation
      let conversationId: string;
      
      if (typeof conversationOrId === 'string') {
        // C'est un ID ou un identifiant - vérifier le type
        const idType = getConversationIdType(conversationOrId);
        if (idType === 'objectId') {
          // C'est déjà un ObjectId, l'utiliser directement
          conversationId = conversationOrId;
        } else if (idType === 'identifier') {
          // C'est un identifiant, le backend le résoudra automatiquement
          conversationId = conversationOrId;
        } else {
          throw new Error(`Invalid conversation identifier: ${conversationOrId}`);
        }
      } else {
        // C'est un objet conversation, extraire l'ID
        conversationId = getConversationApiId(conversationOrId);
      }
      
      console.log('🚪 MeeshySocketIOService: Rejoindre conversation', { 
        conversationOrId,
        conversationId,
        socketId: this.socket.id,
        isConnected: this.isConnected,
        currentUrl: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        timestamp: new Date().toISOString()
      });
      
      // Utiliser l'ID pour les communications WebSocket
      this.socket.emit(CLIENT_EVENTS.CONVERSATION_JOIN, { conversationId });
    } catch (error) {
      console.error('❌ MeeshySocketIOService: Erreur lors de l\'extraction de l\'ID conversation pour join:', error);
    }
  }

  /**
   * Quitte une conversation (accepte soit un ID soit un objet conversation)
   */
  public leaveConversation(conversationOrId: any): void {
    if (!this.socket) {
      console.warn('⚠️ MeeshySocketIOService: Socket non connecté, impossible de quitter la conversation');
      return;
    }

    try {
      // Déterminer si c'est un ID ou un objet conversation
      let conversationId: string;
      
      if (typeof conversationOrId === 'string') {
        // C'est un ID ou un identifiant - vérifier le type
        const idType = getConversationIdType(conversationOrId);
        if (idType === 'objectId') {
          // C'est déjà un ObjectId, l'utiliser directement
          conversationId = conversationOrId;
        } else if (idType === 'identifier') {
          // C'est un identifiant, le backend le résoudra automatiquement
          conversationId = conversationOrId;
        } else {
          throw new Error(`Invalid conversation identifier: ${conversationOrId}`);
        }
      } else {
        // C'est un objet conversation, extraire l'ID
        conversationId = getConversationApiId(conversationOrId);
      }

      console.log('🚪 MeeshySocketIOService: Quitter conversation', { 
        conversationOrId,
        conversationId
      });
      
      // Utiliser l'ID pour les communications WebSocket
      this.socket.emit(CLIENT_EVENTS.CONVERSATION_LEAVE, { conversationId });
    } catch (error) {
      console.error('❌ MeeshySocketIOService: Erreur lors de l\'extraction de l\'ID conversation pour leave:', error);
    }
  }

  /**
   * Envoie un message (accepte soit un ID soit un objet conversation)
   */
  public async sendMessage(conversationOrId: any, content: string, originalLanguage?: string, replyToId?: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.socket) {
        console.error('❌ MeeshySocketIOService: Socket non connecté');
        toast.error('Connexion WebSocket non initialisée');
        resolve(false);
        return;
      }

      if (!this.isConnected) {
        console.error('❌ MeeshySocketIOService: Socket connecté mais pas prêt');
        toast.error('Connexion WebSocket non établie');
        resolve(false);
        return;
      }

      // Vérifier l'état de la connexion
      if (this.socket.disconnected) {
        console.error('❌ MeeshySocketIOService: Socket déconnecté');
        toast.error('Connexion WebSocket perdue');
        resolve(false);
        return;
      }

      try {
        // Déterminer si c'est un ID ou un objet conversation
        let conversationId: string;
        
        if (typeof conversationOrId === 'string') {
          // C'est un ID ou un identifiant - vérifier le type
          const idType = getConversationIdType(conversationOrId);
          if (idType === 'objectId') {
            // C'est déjà un ObjectId, l'utiliser directement
            conversationId = conversationOrId;
          } else if (idType === 'identifier') {
            // C'est un identifiant, le backend le résoudra automatiquement
            conversationId = conversationOrId;
          } else {
            throw new Error(`Invalid conversation identifier: ${conversationOrId}`);
          }
        } else {
          // C'est un objet conversation, extraire l'ID
          conversationId = getConversationApiId(conversationOrId);
        }

        // Vérifier l'état d'authentification
        const authToken = localStorage.getItem('auth_token');
        const sessionToken = localStorage.getItem('anonymous_session_token');
        
        console.log('🔍 MeeshySocketIOService: État avant envoi message', {
          socketId: this.socket.id,
          isConnected: this.isConnected,
          hasAuthToken: !!authToken,
          hasSessionToken: !!sessionToken,
          replyToId: replyToId || 'none',
          conversationOrId,
          conversationId,
          contentLength: content.length,
          currentUser: this.currentUser?.id
        });

        console.log('📤 MeeshySocketIOService: Envoi message', {
          conversationOrId,
          conversationId,
          contentLength: content.length,
          originalLanguage,
          fromPage: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
          timestamp: new Date().toISOString()
        });

        // Utiliser l'ObjectId pour l'envoi au backend
        const messageData = { 
          conversationId, 
          content,
          ...(originalLanguage && { originalLanguage }),
          ...(replyToId && { replyToId })
        };

        // Ajouter un timeout pour éviter que la promesse reste en attente
        const timeout = setTimeout(() => {
          console.error('❌ MeeshySocketIOService: Timeout envoi message (10s)');
          toast.error('Timeout: Le serveur n\'a pas répondu à temps');
          resolve(false);
        }, 10000); // 10 secondes de timeout

        this.socket.emit(CLIENT_EVENTS.MESSAGE_SEND, messageData, (response: any) => {
          clearTimeout(timeout); // Annuler le timeout si on reçoit une réponse
          
          if (response?.success) {
            console.log('✅ MeeshySocketIOService: Message envoyé avec succès');
            resolve(true);
          } else {
            console.error('❌ MeeshySocketIOService: Erreur envoi message', {
              error: response?.error,
              message: response?.message,
              conversationId,
              response
            });
            
            const errorMsg = response?.message || response?.error || 'Erreur lors de l\'envoi du message';
            toast.error(`Erreur: ${errorMsg}`);
            resolve(false);
          }
        });
      
      } catch (error) {
        console.error('❌ MeeshySocketIOService: Erreur lors de l\'extraction de l\'ID conversation:', error);
        toast.error('Erreur lors de l\'extraction de l\'ID de conversation');
        resolve(false);
      }
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
   * Obtient l'instance Socket directe (pour usage avancé)
   */
  public getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
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
export const meeshySocketIOService = MeeshySocketIOService.getInstance();
