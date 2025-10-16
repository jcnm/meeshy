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
  
  // CORRECTION: Mémoriser la conversation active pour auto-join après reconnexion
  private currentConversationId: string | null = null;

  /**
   * Fonction utilitaire pour obtenir la traduction selon la langue de l'utilisateur
   * Utilise la même clé localStorage que le système i18n principal
   */
  private t(key: string): string {
    try {
      // Utiliser la clé correcte: meeshy-i18n-language (définie dans i18n-utils.ts)
      const userLang = typeof window !== 'undefined' 
        ? (localStorage.getItem('meeshy-i18n-language') || 'en')
        : 'en';
      
      // Les imports contiennent TOUS les namespaces: { common, auth, websocket, ... }
      const allTranslations = userLang === 'fr' ? frTranslations : enTranslations;
      
      // La clé est au format "namespace.path.to.value" (ex: "websocket.connected")
      const keys = key.split('.');
      let value: any = allTranslations;
      
      // Naviguer dans la structure complète
      // Note: Les fichiers JSON ont une double imbrication (namespace.namespace.key)
      // Ex: websocket.json = { websocket: { connected: "..." } }
      // Donc allTranslations.websocket = { websocket: { connected: "..." } }
      for (const k of keys) {
        value = value?.[k];
      }
      
      // Si pas trouvé, essayer avec la double imbrication du namespace
      // Ex: websocket.connected → websocket.websocket.connected
      if (!value && keys.length >= 2) {
        const namespace = keys[0];
        value = (allTranslations as any)?.[namespace]?.[namespace];
        for (let i = 1; i < keys.length; i++) {
          value = value?.[keys[i]];
        }
      }
      
      return value || key;
    } catch (error) {
      console.error('[MeeshySocketIOService] Erreur traduction:', error);
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
    // CORRECTION CRITIQUE: Le constructeur ne doit s'exécuter QU'UNE SEULE FOIS
    // Protection contre React StrictMode qui monte les composants 2 fois en dev
    if (MeeshySocketIOService.instance) {
      console.warn('⚠️ [CONSTRUCTOR] Instance singleton déjà existante, skip initialisation');
      return MeeshySocketIOService.instance;
    }
    
    // CORRECTION: Initialiser automatiquement si des tokens sont disponibles
    // MAIS SEULEMENT si c'est la première instance (singleton)
    if (typeof window !== 'undefined') {
      // Attendre un peu que le DOM soit prêt
      setTimeout(() => {
        this.ensureConnection();
      }, 1000);
    }
  }
  
  /**
   * Assure qu'une connexion est établie
   * CORRECTION CRITIQUE: Initialise automatiquement si tokens disponibles
   * Protection contre les connexions multiples en mode React StrictMode
   */
  private ensureConnection(): void {
    // Si déjà connecté ou en cours, ne rien faire
    if (this.socket && (this.isConnected || this.isConnecting || this.socket.connected)) {
      console.log('🔒 [ENSURE] Connexion déjà active, skip initialisation');
      return;
    }
    
    // Protection contre les appels multiples rapides
    if (this.isConnecting) {
      console.log('🔒 [ENSURE] Connexion en cours, skip initialisation');
      return;
    }
    
    // Vérifier si tokens disponibles
    const hasAuthToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token');
    const hasSessionToken = typeof window !== 'undefined' && !!localStorage.getItem('anonymous_session_token');
    
    if (hasAuthToken || hasSessionToken) {
      console.log('🔄 [ENSURE] Initialisation automatique de la connexion...');
      this.initializeConnection();
    }
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
   * CORRECTION: S'assurer qu'une seule instance existe JAMAIS
   */
  static getInstance(): MeeshySocketIOService {
    if (!MeeshySocketIOService.instance) {
      console.log('🏗️ [SINGLETON] Création nouvelle instance MeeshySocketIOService');
      MeeshySocketIOService.instance = new MeeshySocketIOService();
    } else {
      console.log('🔄 [SINGLETON] Réutilisation instance existante MeeshySocketIOService');
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
    // Vérifier à la fois notre flag interne ET l'état réel de Socket.IO
    if (this.isConnecting || (this.socket && (this.isConnected || this.socket.connected))) {
      console.log('🔌 Connexion déjà active, ignorée', {
        isConnecting: this.isConnecting,
        hasSocket: !!this.socket,
        internalIsConnected: this.isConnected,
        socketIoConnected: this.socket?.connected,
        socketId: this.socket?.id
      });
      return;
    }

    // CORRECTION: Vérifier que soit un utilisateur soit un token est disponible
    const hasAuthToken = !!localStorage.getItem('auth_token');
    const hasSessionToken = !!localStorage.getItem('anonymous_session_token');
    
    if (!hasAuthToken && !hasSessionToken) {
      console.warn('🔒 MeeshySocketIOService: Aucun token configuré, connexion impossible');
      this.isConnecting = false;
      return;
    }
    
    // Pas besoin de currentUser si on a un token valide
    // Le backend authentifiera via le token dans les headers
    console.log('✓ Token disponible, connexion possible', {
      hasAuthToken,
      hasSessionToken,
      hasCurrentUser: !!this.currentUser
    });

    // CORRECTION CRITIQUE: Ne nettoyer QUE si le socket est connecté ou en erreur
    // Évite de fermer un socket en cours de connexion (problème avec React StrictMode)
    if (this.socket) {
      const socketState = {
        connected: this.socket.connected,
        disconnected: this.socket.disconnected,
        connecting: !this.socket.connected && !this.socket.disconnected
      };
      
      console.log('🔍 MeeshySocketIOService: Socket existant détecté', socketState);
      
      // Ne nettoyer QUE si connecté ou déconnecté (pas si en cours de connexion)
      if (socketState.connected || socketState.disconnected) {
        console.log('🧹 Nettoyage socket existant (état stable)');
        try {
          this.socket.removeAllListeners();
          if (socketState.connected) {
            this.socket.disconnect();
          }
          this.socket = null;
        } catch (e) {
          console.warn('⚠️ Erreur lors du nettoyage:', e);
        }
      } else {
        console.log('⏳ Socket en cours de connexion, réutilisation...');
        return; // Réutiliser le socket en cours de connexion
      }
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

      // CORRECTION CRITIQUE: Créer le socket avec autoConnect: false
      // pour configurer les listeners AVANT la connexion
      this.socket = io(serverUrl, {
        auth: authData,
        extraHeaders, // Garder aussi extraHeaders comme fallback
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000,
        path: '/socket.io/',
        forceNew: false,
        autoConnect: false // ⚠️ DÉSACTIVÉ pour configurer les listeners d'abord
      });

      console.log('🔧 [INIT] Socket créé, configuration des listeners...');
      
      // CORRECTION CRITIQUE: Configurer les listeners AVANT de connecter
      this.setupEventListeners();
      
      console.log('🔌 [INIT] Listeners configurés, connexion en cours...');
      
      // CORRECTION CRITIQUE: Connecter manuellement APRÈS avoir configuré les listeners
      this.socket.connect();
      
      console.log('✅ [INIT] Connexion initiée', {
        socketId: this.socket.id,
        connected: this.socket.connected
      });
      
      this.isConnecting = false;
    } catch (error) {
      console.error('Erreur création Socket.IO', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Rejoint automatiquement la dernière conversation active après authentification
   * CORRECTION CRITIQUE: Permet d'envoyer des messages sans avoir à rejoindre manuellement
   */
  private _autoJoinLastConversation(): void {
    console.log('');
    console.log('🔄 ═══════════════════════════════════════════════════════');
    console.log('🔄  AUTO-JOIN CONVERSATION');
    console.log('🔄 ═══════════════════════════════════════════════════════');
    
    // Vérifier si une conversation est mémorisée
    if (this.currentConversationId) {
      console.log('  ✓ Conversation mémorisée:', this.currentConversationId);
      console.log('  🚪 Rejoindre automatiquement...');
      
      // Rejoindre la conversation mémorisée
      this.joinConversation(this.currentConversationId);
      
      console.log('  ✅ Auto-join effectué (mémorisée)');
      console.log('🔄 ═══════════════════════════════════════════════════════');
      console.log('');
      return;
    }
    
    console.log('  ℹ️ Aucune conversation mémorisée');
    
    // Essayer de détecter la conversation depuis l'URL
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      console.log('  🔍 Path actuel:', path);
      
      // CORRECTION CRITIQUE: Gérer les pages spéciales
      
      // 1. Page d'accueil "/" → Conversation globale "meeshy"
      if (path === '/' || path === '') {
        console.log('  🏠 Page d\'accueil détectée → Conversation globale "meeshy"');
        this.joinConversation('meeshy');
        console.log('  ✅ Auto-join effectué (page accueil)');
        console.log('🔄 ═══════════════════════════════════════════════════════');
        console.log('');
        return;
      }
      
      // 2. Page chat anonyme "/chat" → Récupérer conversation du share link
      if (path === '/chat' || path.startsWith('/chat?')) {
        console.log('  💬 Page chat anonyme détectée');
        
        // Récupérer le sessionToken anonyme
        const sessionToken = localStorage.getItem('anonymous_session_token');
        if (sessionToken) {
          console.log('  ✓ Session token anonyme trouvé');
          
          // Le conversationId est stocké dans le localStorage par le chat anonyme
          const chatData = localStorage.getItem('anonymous_chat_data');
          if (chatData) {
            try {
              const parsedData = JSON.parse(chatData);
              const conversationId = parsedData.conversationId || parsedData.conversation?.id;
              
              if (conversationId) {
                console.log('  🎯 Conversation anonyme détectée:', conversationId);
                this.joinConversation(conversationId);
                console.log('  ✅ Auto-join effectué (chat anonyme)');
                console.log('🔄 ═══════════════════════════════════════════════════════');
                console.log('');
                return;
              }
            } catch (e) {
              console.warn('  ⚠️ Erreur parsing anonymous_chat_data:', e);
            }
          }
          
          console.log('  ℹ️ Conversation anonyme pas encore chargée');
        } else {
          console.log('  ℹ️ Pas de session anonyme active');
        }
      }
      
      // 3. Pages conversations avec ID: /conversations/:id ou /chat/:id
      const conversationMatch = path.match(/\/(conversations|chat)\/([^\/\?]+)/);
      if (conversationMatch && conversationMatch[2]) {
        const detectedConversationId = conversationMatch[2];
        console.log('  🎯 Conversation détectée depuis URL:', detectedConversationId);
        
        // Rejoindre la conversation détectée
        this.joinConversation(detectedConversationId);
        
        console.log('  ✅ Auto-join effectué (URL avec ID)');
        console.log('🔄 ═══════════════════════════════════════════════════════');
        console.log('');
        return;
      }
      
      console.log('  ℹ️ Aucune conversation détectée pour cette page');
    }
    
    console.log('🔄 ═══════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Configure les gestionnaires d'événements Socket.IO
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Événements de connexion
    this.socket.on('connect', () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔌 [CONNECT] Socket.IO CONNECTÉ - En attente d\'authentification');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  📊 État de connexion:', {
        socketId: this.socket?.id,
        transport: this.socket?.io.engine?.transport.name,
        socketConnected: this.socket?.connected,
        isConnected: this.isConnected,
        isConnecting: this.isConnecting,
        timestamp: new Date().toISOString()
      });
      console.log('  ⏳ Attente de l\'événement SERVER_EVENTS.AUTHENTICATED...');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      
      // NE PAS mettre isConnected = true ici, attendre la confirmation d'authentification
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // CORRECTION: Timeout de sécurité si AUTHENTICATED n'arrive pas dans les 5 secondes
      // Augmenté de 3s à 5s pour éviter le mode fallback prématuré
      setTimeout(() => {
        if (!this.isConnected && this.socket?.connected) {
          console.log('');
          console.log('⚠️ ═══════════════════════════════════════════════════════');
          console.log('⚠️  TIMEOUT: AUTHENTICATED non reçu après 5s');
          console.log('⚠️ ═══════════════════════════════════════════════════════');
          console.log('  📊 État actuel:', {
            hasSocket: !!this.socket,
            socketConnected: this.socket?.connected,
            isConnected: this.isConnected,
            socketId: this.socket?.id
          });
          console.log('  ⚠️ Problème d\'authentification probable');
          console.log('  → Le backend devrait envoyer SERVER_EVENTS.AUTHENTICATED');
          console.log('⚠️ ═══════════════════════════════════════════════════════');
          console.log('');
          
          // NE PAS activer le mode fallback - déconnecter et attendre
          // Le problème vient probablement de tokens invalides
          this.socket?.disconnect();
          console.warn('⚠️ [INIT] Déconnexion forcée après timeout authentification');
        }
      }, 5000);
    });

    // CORRECTION: Écouter l'événement AUTHENTICATED du backend
    this.socket.on(SERVER_EVENTS.AUTHENTICATED, (response: any) => {
      console.log('');
      console.log('🎉 ═══════════════════════════════════════════════════════');
      console.log('🎉  ÉVÉNEMENT AUTHENTICATED REÇU');
      console.log('🎉 ═══════════════════════════════════════════════════════');
      console.log('  📦 Response:', response);
      console.log('  ✓ Success:', response?.success);
      console.log('  👤 User:', response?.user);
      console.log('🎉 ═══════════════════════════════════════════════════════');
      console.log('');
      
      if (response?.success) {
        this.isConnected = true;
        console.log('✅ ═══════════════════════════════════════════════════════');
        console.log('✅  AUTHENTIFICATION CONFIRMÉE PAR LE SERVEUR');
        console.log('✅ ═══════════════════════════════════════════════════════');
        console.log('  👤 User ID:', response.user?.id);
        console.log('  🔒 Is Anonymous:', response.user?.isAnonymous);
        console.log('  🌍 Language:', response.user?.language);
        console.log('  🔌 Socket ID:', this.socket?.id);
        console.log('  📊 isConnected:', this.isConnected);
        console.log('  📊 socket.connected:', this.socket?.connected);
        console.log('✅ ═══════════════════════════════════════════════════════');
        console.log('');
        
        // CORRECTION CRITIQUE: Rejoindre automatiquement la dernière conversation active
        this._autoJoinLastConversation();
        
        toast.success(this.t('websocket.connected'));
      } else {
        this.isConnected = false;
        console.log('');
        console.log('❌ ═══════════════════════════════════════════════════════');
        console.log('❌  AUTHENTIFICATION REFUSÉE PAR LE SERVEUR');
        console.log('❌ ═══════════════════════════════════════════════════════');
        console.log('  ⚠️ Error:', response?.error);
        console.log('  📊 isConnected:', this.isConnected);
        console.log('❌ ═══════════════════════════════════════════════════════');
        console.log('');
        toast.error(this.t('websocket.authenticationFailed') + ': ' + (response?.error || 'Erreur inconnue'));
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.isConnecting = false;
      console.warn('🔌 MeeshySocketIOService: Socket.IO déconnecté', { 
        reason,
        socketId: this.socket?.id,
        currentUser: this.currentUser?.username,
        timestamp: new Date().toISOString()
      });
      
      // CORRECTION CRITIQUE: Ne PAS reconnecter automatiquement si :
      // 1. Déconnexion volontaire (io client disconnect)
      // 2. Première connexion jamais établie (isConnected n'a jamais été true)
      const shouldReconnect = reason !== 'io client disconnect';
      const wasNeverConnected = this.reconnectAttempts === 0 && reason === 'io server disconnect';
      
      if (wasNeverConnected) {
        // Première connexion échouée - probablement un problème d'authentification
        console.warn('⚠️ [INIT] Première connexion refusée par le serveur');
        console.warn('  → Pas de reconnexion automatique (attente setCurrentUser)');
        return; // Ne PAS reconnecter, attendre que l'app initialise correctement
      }
      
      if (reason === 'io server disconnect') {
        // Le serveur a forcé la déconnexion (souvent connexion multiple ou redémarrage)
        console.log('🔄 Déconnexion par le serveur - Reconnexion automatique dans 2s...');
        toast.warning(this.t('websocket.serverDisconnectedReconnecting'));
        
        // Reconnexion automatique après délai
        if (shouldReconnect) {
          setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
              console.log('🔄 Tentative de reconnexion automatique après déconnexion serveur...');
              this.reconnect();
            }
          }, 2000);
        }
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Problème réseau ou serveur indisponible
        console.log('🔄 Erreur transport - Reconnexion automatique dans 3s...');
        toast.warning(this.t('websocket.connectionLostReconnecting'));
        
        if (shouldReconnect) {
          setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
              console.log('🔄 Tentative de reconnexion automatique après erreur transport...');
              this.reconnect();
            }
          }, 3000);
        }
      } else if (shouldReconnect) {
        // Autres déconnexions inattendues
        console.log(`🔄 Déconnexion inattendue (${reason}) - Reconnexion automatique dans 2s...`);
        toast.warning(this.t('websocket.connectionLostReconnecting'));
        
        setTimeout(() => {
          if (!this.isConnected && !this.isConnecting) {
            console.log('🔄 Tentative de reconnexion automatique après déconnexion...');
            this.reconnect();
          }
        }, 2000);
      } else {
        // Déconnexion volontaire (changement de page, etc.)
        console.log('✓ Déconnexion volontaire, pas de reconnexion automatique');
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
    // CORRECTION CRITIQUE: Utiliser replyTo depuis le backend si disponible
    // Sinon fallback sur la reconstitution depuis le cache local
    let replyTo: Message | undefined = undefined;
    
    if (socketMessage.replyTo) {
      // Le backend a fourni l'objet complet replyTo
      console.log(`💬 [MESSAGES] Message réponse fourni par le backend: ${socketMessage.replyTo.id}`);
      replyTo = this.convertSocketMessageToMessage(socketMessage.replyTo);
    } else if (socketMessage.replyToId && this.getMessageByIdCallback) {
      // Fallback: Reconstituer depuis la liste locale
      replyTo = this.getMessageByIdCallback(socketMessage.replyToId);
      if (replyTo) {
        console.log(`💬 [MESSAGES] Message réponse reconstitué depuis la liste locale: ${socketMessage.replyToId}`);
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
      // Utiliser le message depuis le backend ou le cache local
      replyTo: replyTo,
      // CORRECTION: Inclure les attachments depuis le backend
      attachments: socketMessage.attachments || [],
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
   * CORRECTION: Simplifié pour utiliser ensureConnection()
   */
  public setCurrentUser(user: User): void {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 [SET_USER] Configuration utilisateur');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  👤 User ID:', user.id);
    console.log('  👤 Username:', user.username);
    console.log('  📊 État avant:', {
      hasSocket: !!this.socket,
      isConnected: this.isConnected,
      isConnecting: this.isConnecting
    });
    
    this.currentUser = user;

    // Vérifier que le token est disponible
    const authToken = localStorage.getItem('auth_token');
    const anonymousToken = localStorage.getItem('anonymous_session_token');
    const token = authToken || anonymousToken;
    
    console.log('  🔑 Tokens:', {
      hasAuthToken: !!authToken,
      hasSessionToken: !!anonymousToken
    });
    
    if (!token) {
      console.warn('  🔒 Token non disponible, attente avec retry...');
      
      // Attendre un peu et réessayer
      let attempts = 0;
      const maxAttempts = 5; // Réduit de 10 à 5
      const retryInterval = setInterval(() => {
        attempts++;
        const retryAuthToken = localStorage.getItem('auth_token');
        const retryAnonymousToken = localStorage.getItem('anonymous_session_token');
        const retryToken = retryAuthToken || retryAnonymousToken;
        
        console.log(`  🔄 Tentative ${attempts}/${maxAttempts} de récupération token...`);
        
        if (retryToken && this.currentUser) {
          console.log('  ✅ Token trouvé, initialisation connexion...');
          clearInterval(retryInterval);
          this.ensureConnection();
        } else if (attempts >= maxAttempts) {
          console.error('  ❌ Token toujours non disponible après', maxAttempts, 'tentatives');
          clearInterval(retryInterval);
        }
      }, 500); // Réduit de 1000ms à 500ms pour être plus rapide
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      return;
    }

    console.log('  ✓ Token disponible');
    console.log('  🔄 Appel ensureConnection()...');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    // CORRECTION: Utiliser ensureConnection() pour gérer intelligemment la connexion
    this.ensureConnection();
  }

  /**
   * Force un auto-join manuel (appelé quand les données de conversation sont disponibles)
   * Utile pour /chat quand anonymous_chat_data est chargé après l'authentification
   */
  public triggerAutoJoin(): void {
    console.log('🔄 [TRIGGER] Auto-join manuel déclenché');
    this._autoJoinLastConversation();
  }

  /**
   * Rejoint une conversation (accepte soit un ID soit un objet conversation)
   * CORRECTION: Assure que la connexion est établie et attend si nécessaire
   */
  public joinConversation(conversationOrId: any): void {
    // CORRECTION: S'assurer que la connexion est établie
    this.ensureConnection();
    
    if (!this.socket) {
      console.warn('⚠️ MeeshySocketIOService: Socket non connecté, join différé');
      
      // Mémoriser la conversation pour l'auto-join après connexion
      try {
        let conversationId: string;
        if (typeof conversationOrId === 'string') {
          conversationId = conversationOrId;
        } else {
          conversationId = getConversationApiId(conversationOrId);
        }
        
        this.currentConversationId = conversationId;
        console.log('  💾 Conversation mémorisée pour auto-join:', conversationId);
      } catch (error) {
        console.error('  ❌ Erreur mémorisation conversation:', error);
      }
      
      return;
    }
    
    // CORRECTION: Attendre que le socket soit réellement connecté
    if (!this.socket.connected) {
      console.warn('⚠️ Socket non encore connecté, join différé');
      
      // Mémoriser pour auto-join après authentification
      try {
        let conversationId: string;
        if (typeof conversationOrId === 'string') {
          conversationId = conversationOrId;
        } else {
          conversationId = getConversationApiId(conversationOrId);
        }
        
        this.currentConversationId = conversationId;
        console.log('  💾 Conversation mémorisée pour auto-join:', conversationId);
      } catch (error) {
        console.error('  ❌ Erreur mémorisation conversation:', error);
      }
      
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
      
      // CORRECTION: Mémoriser la conversation active pour auto-join après reconnexion
      this.currentConversationId = conversationId;
      
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
      
      // CORRECTION: Effacer la conversation mémorisée si on quitte la conversation active
      if (this.currentConversationId === conversationId) {
        this.currentConversationId = null;
        console.log('  🗑️ Conversation mémorisée effacée');
      }
      
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
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📤 [SEND_MESSAGE] Tentative d\'envoi de message');
      console.log('═══════════════════════════════════════════════════════');
      
      // CORRECTION CRITIQUE: S'assurer que la connexion est établie
      this.ensureConnection();
      
      if (!this.socket) {
        console.log('  ❌ ÉCHEC: Socket non initialisé');
        console.log('  🔍 Diagnostic:', {
          hasSocket: !!this.socket,
          isConnected: this.isConnected,
          isConnecting: this.isConnecting,
          hasCurrentUser: !!this.currentUser,
          currentUser: this.currentUser?.username || 'N/A'
        });
        console.log('');
        console.log('  🔄 Tentative d\'initialisation forcée...');
        
        // Dernière tentative: forcer l'initialisation
        const hasAuthToken = !!localStorage.getItem('auth_token');
        const hasSessionToken = !!localStorage.getItem('anonymous_session_token');
        
        if (hasAuthToken || hasSessionToken) {
          console.log('  ✓ Token disponible, initialisation forcée...');
          this.initializeConnection();
          
          // Attendre que le socket se crée
          await new Promise(wait => setTimeout(wait, 500));
          
          // Vérifier si le socket est maintenant créé
          if (!this.socket) {
            console.log('  ❌ Socket toujours non créé après initialisation');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
            toast.error('Impossible d\'initialiser la connexion WebSocket');
            resolve(false);
            return;
          }
          
          console.log('  ✅ Socket créé avec succès');
        } else {
          console.log('  ❌ Aucun token disponible');
          console.log('═══════════════════════════════════════════════════════');
          console.log('');
          toast.error('Veuillez vous connecter pour envoyer des messages');
          resolve(false);
          return;
        }
      }

      // CORRECTION CRITIQUE: Vérifier l'état RÉEL du socket
      const socketConnected = this.socket.connected === true;
      const socketDisconnected = this.socket.disconnected === true;
      
      console.log('  📊 État actuel:');
      console.log('    ├─ socket.connected:', socketConnected);
      console.log('    ├─ socket.disconnected:', socketDisconnected);
      console.log('    ├─ isConnected (flag):', this.isConnected);
      console.log('    ├─ socketId:', this.socket.id);
      console.log('    └─ currentUser:', this.currentUser?.username || 'N/A');
      
      if (!socketConnected || socketDisconnected) {
        console.log('');
        console.log('  ❌ ÉCHEC: Socket déconnecté');
        console.log('  🔄 Tentative de reconnexion immédiate...');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        
        // Tenter une reconnexion immédiate
        this.reconnect();
        
        toast.error('Connexion WebSocket perdue. Reconnexion en cours...');
        resolve(false);
        return;
      }

      // Vérification de l'authentification (moins critique que l'état du socket)
      if (!this.isConnected) {
        console.log('  ⚠️ WARNING: Flag isConnected=false mais socket connecté');
        console.log('  → Tentative d\'envoi quand même...');
      } else {
        console.log('  ✓ Authentification OK');
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

        console.log('');
        console.log('  📝 Données du message:');
        console.log('    ├─ Conversation ID:', conversationId);
        console.log('    ├─ Content length:', content.length);
        console.log('    ├─ Original language:', originalLanguage || 'N/A');
        console.log('    ├─ Reply to ID:', replyToId || 'N/A');
        console.log('    └─ Timestamp:', new Date().toISOString());

        // Utiliser l'ObjectId pour l'envoi au backend
        const messageData = { 
          conversationId, 
          content,
          ...(originalLanguage && { originalLanguage }),
          ...(replyToId && { replyToId })
        };

        console.log('');
        console.log('  📡 Émission événement MESSAGE_SEND...');
        console.log('    └─ Event:', CLIENT_EVENTS.MESSAGE_SEND);

        // Ajouter un timeout pour éviter que la promesse reste en attente
        const timeout = setTimeout(() => {
          console.log('');
          console.log('  ❌ TIMEOUT: Aucune réponse après 10s');
          console.log('═══════════════════════════════════════════════════════');
          console.log('');
          toast.error('Timeout: Le serveur n\'a pas répondu à temps');
          resolve(false);
        }, 10000); // 10 secondes de timeout

        this.socket.emit(CLIENT_EVENTS.MESSAGE_SEND, messageData, (response: any) => {
          clearTimeout(timeout); // Annuler le timeout si on reçoit une réponse
          
          console.log('');
          console.log('  📥 RÉPONSE REÇUE du serveur:');
          console.log('    ├─ Success:', response?.success);
          console.log('    ├─ Error:', response?.error || 'N/A');
          console.log('    └─ Data:', response?.data);
          
          if (response?.success) {
            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║  ✅ MESSAGE ENVOYÉ AVEC SUCCÈS                                ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log(`  📨 Message ID: ${response?.data?.messageId || 'N/A'}`);
            console.log(`  🔌 Socket ID: ${this.socket?.id}`);
            console.log(`  ⏰ Timestamp: ${new Date().toISOString()}`);
            console.log('');
            resolve(true);
          } else {
            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║  ❌ ERREUR ENVOI MESSAGE                                      ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log(`  ⚠️ Error: ${response?.error || 'Unknown error'}`);
            console.log(`  💬 Message: ${response?.message || 'N/A'}`);
            console.log(`  🔌 Socket ID: ${this.socket?.id}`);
            console.log('');
            
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
   * Envoie un message avec des attachments
   */
  public async sendMessageWithAttachments(
    conversationOrId: any, 
    content: string, 
    attachmentIds: string[],
    originalLanguage?: string, 
    replyToId?: string
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.socket) {
        console.error('❌ MeeshySocketIOService: Socket non connecté');
        toast.error('Connexion WebSocket non initialisée');
        resolve(false);
        return;
      }

      if (!this.isConnected && !this.socket.connected) {
        console.error('❌ MeeshySocketIOService: Socket pas connecté');
        toast.error('Connexion WebSocket non établie');
        resolve(false);
        return;
      }

      if (this.socket.disconnected) {
        console.error('❌ MeeshySocketIOService: Socket déconnecté');
        toast.error('Connexion WebSocket perdue');
        resolve(false);
        return;
      }

      try {
        // Déterminer l'ID de conversation
        let conversationId: string;
        
        if (typeof conversationOrId === 'string') {
          const idType = getConversationIdType(conversationOrId);
          if (idType === 'objectId') {
            conversationId = conversationOrId;
          } else if (idType === 'identifier') {
            conversationId = conversationOrId;
          } else {
            throw new Error(`Invalid conversation identifier: ${conversationOrId}`);
          }
        } else {
          conversationId = getConversationApiId(conversationOrId);
        }

        console.log('📤📎 MeeshySocketIOService: Envoi message avec attachments', {
          conversationId,
          contentLength: content.length,
          attachmentCount: attachmentIds.length,
          originalLanguage,
          replyToId: replyToId || 'none',
          timestamp: new Date().toISOString()
        });

        // Utiliser l'ObjectId pour l'envoi au backend
        const messageData = { 
          conversationId, 
          content,
          attachmentIds,
          originalLanguage: originalLanguage || 'fr',
          replyToId
        };

        // Émettre l'événement avec callback
        this.socket.emit(CLIENT_EVENTS.MESSAGE_SEND_WITH_ATTACHMENTS, messageData, (response: any) => {
          if (response?.success) {
            console.log('✅ MeeshySocketIOService: Message avec attachments envoyé', {
              messageId: response?.data?.messageId,
              attachmentCount: attachmentIds.length
            });
            resolve(true);
          } else {
            console.error('❌ MeeshySocketIOService: Erreur envoi message avec attachments', {
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
        console.error('❌ MeeshySocketIOService: Erreur lors de l\'envoi message avec attachments:', error);
        toast.error('Erreur lors de l\'envoi du message');
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
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 [RECONNECT] Tentative de reconnexion');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  📊 État actuel:', {
      hasSocket: !!this.socket,
      socketConnected: this.socket?.connected,
      socketDisconnected: this.socket?.disconnected,
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      socketId: this.socket?.id
    });
    
    // CORRECTION CRITIQUE 1: Ne PAS reconnecter si déjà en cours
    if (this.isConnecting) {
      console.log('  ⏳ Reconnexion déjà en cours, ignorée');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      return;
    }
    
    // CORRECTION CRITIQUE 2: Vérifier l'état RÉEL du socket
    const actuallyConnected = this.socket?.connected === true && this.isConnected;
    
    // IMPORTANT: Ne PAS reconnecter si déjà connecté ET authentifié
    if (this.socket && actuallyConnected) {
      console.log('  ✅ Socket déjà connectée et authentifiée');
      console.log('    ├─ isConnected:', this.isConnected);
      console.log('    ├─ socket.connected:', this.socket.connected);
      console.log('    └─ socketId:', this.socket.id);
      console.log('  → Reconnexion ignorée');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      return; // Ne rien faire si déjà OK
    }
    
    // CORRECTION CRITIQUE 3: Ne nettoyer QUE si déconnecté (pas si en cours)
    if (this.socket) {
      const socketState = {
        connected: this.socket.connected,
        disconnected: this.socket.disconnected,
        connecting: !this.socket.connected && !this.socket.disconnected
      };
      
      if (socketState.disconnected) {
        console.log('  🧹 Nettoyage socket déconnectée');
        try {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        } catch (e) {
          console.warn('  ⚠️ Erreur nettoyage:', e);
        }
      } else if (socketState.connecting) {
        console.log('  ⏳ Socket en cours de connexion, attente...');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        return; // Ne pas interrompre une connexion en cours
      } else if (socketState.connected) {
        console.log('  ℹ️ Socket connecté mais non authentifié, réinitialisation...');
        try {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        } catch (e) {
          console.warn('  ⚠️ Erreur nettoyage:', e);
        }
      }
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // CORRECTION: Vérifier tokens même si currentUser est null
    const hasAuthToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token');
    const hasSessionToken = typeof window !== 'undefined' && !!localStorage.getItem('anonymous_session_token');
    
    console.log('  🔑 Vérification authentification:');
    console.log('    ├─ Current User:', this.currentUser?.username || 'N/A');
    console.log('    ├─ Auth Token:', hasAuthToken ? 'Présent' : 'Absent');
    console.log('    └─ Session Token:', hasSessionToken ? 'Présent' : 'Absent');
    
    if (this.currentUser || hasAuthToken || hasSessionToken) {
      console.log('  🔄 Initialisation de la connexion...');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      this.initializeConnection();
    } else {
      console.log('  ❌ Aucune authentification disponible');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      toast.warning('Veuillez vous reconnecter pour utiliser le chat en temps réel');
    }
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
   * CORRECTION: Vérifier l'état réel du socket, pas seulement le flag interne
   */
  public getConnectionStatus(): {
    isConnected: boolean;
    hasSocket: boolean;
    currentUser: string;
  } {
    // IMPORTANT: Vérifier AUSSI l'état réel du socket (socket.connected)
    // car this.isConnected peut être désynchronisé
    const socketConnected = this.socket?.connected === true;
    const actuallyConnected = this.isConnected && socketConnected;
    
    // CORRECTION: Synchroniser automatiquement si désynchronisé
    if (this.isConnected !== socketConnected) {
      console.warn('⚠️ [SYNC] État isConnected désynchronisé avec socket.connected', {
        isConnected: this.isConnected,
        socketConnected: socketConnected,
        fixing: 'Synchronisation automatique...'
      });
      
      // Synchroniser avec l'état réel du socket
      this.isConnected = socketConnected;
    }
    
    return {
      isConnected: actuallyConnected,
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
    
    // CORRECTION: Nettoyer aussi la conversation mémorisée
    this.currentConversationId = null;
  }
}

// Instance singleton
export const meeshySocketIOService = MeeshySocketIOService.getInstance();
