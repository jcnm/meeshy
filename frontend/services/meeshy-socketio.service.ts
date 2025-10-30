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

// Auth Manager
import { authManager } from './auth-manager.service';

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
  private reactionAddedListeners: Set<(data: any) => void> = new Set();
  private reactionRemovedListeners: Set<(data: any) => void> = new Set();

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
      return MeeshySocketIOService.instance;
    }
    
    // OPTIMISATION: Ne PAS initialiser automatiquement dans le constructeur
    // La connexion sera établie uniquement quand nécessaire (lazy loading)
    // Cela évite de ralentir le chargement initial de la page
  }
  
  /**
   * Assure qu'une connexion est établie
   * CORRECTION CRITIQUE: Initialise automatiquement si tokens disponibles
   * Protection contre les connexions multiples en mode React StrictMode
   */
  private ensureConnection(): void {
    // Si déjà connecté ou en cours, ne rien faire
    if (this.socket && (this.isConnected || this.isConnecting || this.socket.connected)) {
      return;
    }
    
    // Protection contre les appels multiples rapides
    if (this.isConnecting) {
      return;
    }
    
    // Vérifier si tokens disponibles
    const hasAuthToken = typeof window !== 'undefined' && !!authManager.getAuthToken();
    const hasSessionToken = typeof window !== 'undefined' && !!authManager.getAnonymousSession()?.token;
    
    if (hasAuthToken || hasSessionToken) {
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
   * OPTIMISATION: Pas de logs pour un chargement instantané
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
      logger.warn('[SOCKETIO]', 'Exécution côté serveur, connexion ignorée');
      return;
    }

    // Vérifier si on est sur une page publique (pas besoin de WebSocket)
    const currentPath = window.location.pathname;
    const publicPaths = ['/about', '/contact', '/privacy', '/terms', '/partners'];
    
    if (publicPaths.includes(currentPath)) {
      logger.debug('[SOCKETIO]', 'Page publique détectée, connexion ignorée', { path: currentPath });
      return;
    }

    // Empêcher les connexions multiples
    // Vérifier à la fois notre flag interne ET l'état réel de Socket.IO
    if (this.isConnecting || (this.socket && (this.isConnected || this.socket.connected))) {
      return;
    }

    // CORRECTION: Vérifier que soit un utilisateur soit un token est disponible
    const hasAuthToken = !!authManager.getAuthToken();
    const hasSessionToken = !!authManager.getAnonymousSession()?.token;
    
    if (!hasAuthToken && !hasSessionToken) {
      this.isConnecting = false;
      return;
    }

    // CORRECTION CRITIQUE: Ne nettoyer QUE si le socket est connecté ou en erreur
    // Évite de fermer un socket en cours de connexion (problème avec React StrictMode)
    if (this.socket) {
      const socketState = {
        connected: this.socket.connected,
        disconnected: this.socket.disconnected,
        connecting: !this.socket.connected && !this.socket.disconnected
      };
      
      // Ne nettoyer QUE si connecté ou déconnecté (pas si en cours de connexion)
      if (socketState.connected || socketState.disconnected) {
        try {
          this.socket.removeAllListeners();
          if (socketState.connected) {
            this.socket.disconnect();
          }
          this.socket = null;
        } catch (e) {
          console.warn('⚠️ Erreur lors du nettoyage socket:', e);
        }
      } else {
        return; // Réutiliser le socket en cours de connexion
      }
    }

    this.isConnecting = true;

    // Récupérer les tokens d'authentification
    const authToken = authManager.getAuthToken();
    const sessionToken = authManager.getAnonymousSession()?.token;
    
    // Vérifier qu'on a au moins un token
    if (!authToken && !sessionToken) {
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
      
      // CORRECTION CRITIQUE: Configurer les listeners AVANT de connecter
      this.setupEventListeners();
      
      // CORRECTION CRITIQUE: Connecter manuellement APRÈS avoir configuré les listeners
      this.socket.connect();
      
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
    // Vérifier si une conversation est mémorisée
    if (this.currentConversationId) {
      // Rejoindre la conversation mémorisée
      this.joinConversation(this.currentConversationId);
      return;
    }
    
    // Essayer de détecter la conversation depuis l'URL
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      
      // CORRECTION CRITIQUE: Gérer les pages spéciales
      
      // 1. Page d'accueil "/" → Conversation globale "meeshy"
      if (path === '/' || path === '') {
        this.joinConversation('meeshy');
        return;
      }
      
      // 2. Page chat anonyme "/chat" → Récupérer conversation du share link
      if (path === '/chat' || path.startsWith('/chat?')) {
        // Récupérer le sessionToken anonyme
        const sessionToken = authManager.getAnonymousSession()?.token;
        if (sessionToken) {
          // Le conversationId est stocké dans le localStorage par le chat anonyme
          const chatData = localStorage.getItem('anonymous_chat_data');
          if (chatData) {
            try {
              const parsedData = JSON.parse(chatData);
              const conversationId = parsedData.conversationId || parsedData.conversation?.id;
              
              if (conversationId) {
                this.joinConversation(conversationId);
                return;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
      
      // 3. Pages conversations avec ID: /conversations/:id ou /chat/:id
      const conversationMatch = path.match(/\/(conversations|chat)\/([^\/\?]+)/);
      if (conversationMatch && conversationMatch[2]) {
        const detectedConversationId = conversationMatch[2];
        // Rejoindre la conversation détectée
        this.joinConversation(detectedConversationId);
        return;
      }
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
      
      // CORRECTION: Timeout de sécurité si AUTHENTICATED n'arrive pas dans les 5 secondes
      setTimeout(() => {
        if (!this.isConnected && this.socket?.connected) {
          // NE PAS activer le mode fallback - déconnecter et attendre
          // Le problème vient probablement de tokens invalides
          this.socket?.disconnect();
        }
      }, 5000);
    });

    // CORRECTION: Écouter l'événement AUTHENTICATED du backend
    this.socket.on(SERVER_EVENTS.AUTHENTICATED, (response: any) => {
      if (response?.success) {
        this.isConnected = true;
        
        // CORRECTION CRITIQUE: Rejoindre automatiquement la dernière conversation active
        this._autoJoinLastConversation();
        
        // Toast retiré pour éviter les notifications intrusives
      } else {
        this.isConnected = false;
        toast.error(this.t('websocket.authenticationFailed') + ': ' + (response?.error || 'Erreur inconnue'));
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.isConnecting = false;
      
      // CORRECTION CRITIQUE: Ne PAS reconnecter automatiquement si :
      // 1. Déconnexion volontaire (io client disconnect)
      // 2. Première connexion jamais établie (isConnected n'a jamais été true)
      const shouldReconnect = reason !== 'io client disconnect';
      const wasNeverConnected = this.reconnectAttempts === 0 && reason === 'io server disconnect';
      
      if (wasNeverConnected) {
        // Première connexion échouée - probablement un problème d'authentification
        return; // Ne PAS reconnecter, attendre que l'app initialise correctement
      }
      
      if (reason === 'io server disconnect') {
        // Le serveur a forcé la déconnexion (souvent connexion multiple ou redémarrage)
        // Toast supprimé pour éviter les notifications intrusives
        
        // Reconnexion automatique après délai
        if (shouldReconnect) {
          setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
              this.reconnect();
            }
          }, 2000);
        }
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Problème réseau ou serveur indisponible
        // Toast supprimé pour éviter les notifications intrusives
        
        if (shouldReconnect) {
          setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
              this.reconnect();
            }
          }, 3000);
        }
      } else if (shouldReconnect) {
        // Autres déconnexions inattendues
        // Toast supprimé pour éviter les notifications intrusives
        
        setTimeout(() => {
          if (!this.isConnected && !this.isConnecting) {
            this.reconnect();
          }
        }, 2000);
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
      logger.debug('[SOCKETIO]', 'Message modifié', {
        messageId: socketMessage.id
      });

      const message: Message = this.convertSocketMessageToMessage(socketMessage);
      this.editListeners.forEach(listener => listener(message));
    });

    this.socket.on(SERVER_EVENTS.MESSAGE_DELETED, (data) => {
      logger.debug('[SOCKETIO]', 'Message supprimé', {
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
        return;
      }
      
      // Déduplication des événements basée sur messageId + timestamp de la traduction
      const firstTranslation = translations[0];
      const eventKey = `${data.messageId}_${firstTranslation?.id || firstTranslation?.targetLanguage || Date.now()}`;
      
      if (this.processedTranslationEvents.has(eventKey)) {
        return;
      }
      
      this.processedTranslationEvents.add(eventKey);
      
      // Nettoyer les anciens événements (garder seulement les 100 derniers)
      if (this.processedTranslationEvents.size > 100) {
        const oldEvents = Array.from(this.processedTranslationEvents).slice(0, 50);
        oldEvents.forEach(oldEventKey => this.processedTranslationEvents.delete(oldEventKey));
      }
      

      // Mise en cache de la traduction reçue
      if (translations && translations.length > 0) {
        translations.forEach((translation) => {
          const cacheKey = `${data.messageId}_${translation.targetLanguage}`;
          this.translationCache.set(cacheKey, translation);
        });
      }

      // Notifier tous les listeners avec format normalisé (toujours pluriel pour cohérence interne)
      const normalizedData = {
        messageId: data.messageId,
        translations: translations
      };
      
      this.translationListeners.forEach((listener) => {
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

    // Événements de réactions
    this.socket.on(SERVER_EVENTS.REACTION_ADDED, (data: any) => {
      console.log('🎉 [SOCKETIO] REACTION_ADDED reçu:', {
        messageId: data.messageId,
        emoji: data.emoji,
        userId: data.userId,
        action: data.action,
        aggregation: data.aggregation,
        listenersCount: this.reactionAddedListeners.size,
        hasListeners: this.reactionAddedListeners.size > 0,
        socketConnected: this.socket?.connected
      });
      
      logger.debug('[SOCKETIO]', 'Réaction ajoutée', {
        messageId: data.messageId,
        emoji: data.emoji,
        userId: data.userId
      });
      
      if (this.reactionAddedListeners.size === 0) {
        console.warn('⚠️ [SOCKETIO] Aucun listener pour REACTION_ADDED!');
      }
      
      let listenerIndex = 0;
      this.reactionAddedListeners.forEach((listener) => {
        listenerIndex++;
        console.log(`📢 [SOCKETIO] Appel du listener ${listenerIndex}/${this.reactionAddedListeners.size}`);
        listener(data);
      });
      
      console.log('✅ [SOCKETIO] REACTION_ADDED dispatché à tous les listeners');
    });

    this.socket.on(SERVER_EVENTS.REACTION_REMOVED, (data: any) => {
      console.log('🗑️ [SOCKETIO] REACTION_REMOVED reçu:', {
        messageId: data.messageId,
        emoji: data.emoji,
        userId: data.userId,
        action: data.action,
        aggregation: data.aggregation,
        listenersCount: this.reactionRemovedListeners.size
      });
      
      logger.debug('[SOCKETIO]', 'Réaction supprimée', {
        messageId: data.messageId,
        emoji: data.emoji,
        userId: data.userId
      });
      
      this.reactionRemovedListeners.forEach(listener => listener(data));
    });

    // Événement de confirmation de join conversation
    this.socket.on(SERVER_EVENTS.CONVERSATION_JOINED, (data: { conversationId: string; userId: string }) => {
      // CRITIQUE: Mettre à jour currentConversationId avec l'ObjectId normalisé du backend
      // Le backend normalise tous les IDs (identifier → ObjectId) avant de joindre les rooms
      // et avant de broadcaster les événements. Tous les clients DOIVENT utiliser cet ObjectId.
      // L'INVARIANT est l'ObjectId MongoDB (24 caractères hex).
      if (data.conversationId) {
        this.currentConversationId = data.conversationId;
      }
    });

    // Événements de frappe - réception immédiate sans timeout automatique
    this.socket.on(SERVER_EVENTS.TYPING_START, (event) => {
      // Ajouter l'utilisateur à la liste des tapeurs pour cette conversation
      if (!this.typingUsers.has(event.conversationId)) {
        this.typingUsers.set(event.conversationId, new Set());
      }
      this.typingUsers.get(event.conversationId)!.add(event.userId);
      
      // Nettoyer le timeout précédent s'il existe (fallback de sécurité uniquement)
      const timeoutKey = `${event.conversationId}:${event.userId}`;
      if (this.typingTimeouts.has(timeoutKey)) {
        clearTimeout(this.typingTimeouts.get(timeoutKey)!);
      }
      
      // Timeout de sécurité de 15 secondes uniquement pour éviter les indicateurs bloqués
      // En temps normal, l'indicateur doit disparaître à réception de TYPING_STOP
      const timeout = setTimeout(() => {
        this.handleTypingStop(event);
      }, 15000);
      this.typingTimeouts.set(timeoutKey, timeout);
      
      // Notifier les listeners avec isTyping = true
      this.typingListeners.forEach(listener => listener({ ...event, isTyping: true } as any));
    });

    this.socket.on(SERVER_EVENTS.TYPING_STOP, (event) => {
      // Ajouter un délai de 3 secondes avant de cacher l'indicateur
      // pour que l'indicateur reste visible après la dernière frappe
      const timeoutKey = `${event.conversationId}:${event.userId}`;
      
      // Nettoyer le timeout précédent s'il existe
      if (this.typingTimeouts.has(timeoutKey)) {
        clearTimeout(this.typingTimeouts.get(timeoutKey)!);
      }
      
      // Attendre 3 secondes avant de cacher l'indicateur
      const timeout = setTimeout(() => {
        this.handleTypingStop(event);
      }, 3000);
      
      this.typingTimeouts.set(timeoutKey, timeout);
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
    
    // 1. D'abord vérifier si le backend envoie déjà replyTo complet
    if ((socketMessage as any).replyTo) {
      const replyToMsg = (socketMessage as any).replyTo;
      const replyToSender = replyToMsg.sender;
      const replyToAnonymousSender = replyToMsg.anonymousSender;
      
      // Construire le sender pour replyTo (gérer utilisateurs authentifiés ET anonymes)
      let replyToFinalSender;
      if (replyToSender) {
        replyToFinalSender = {
          id: String(replyToSender.id || 'unknown'),
          username: String(replyToSender.username || 'Unknown'),
          displayName: String(replyToSender.displayName || replyToSender.username || 'Unknown'),
          firstName: String(replyToSender.firstName || ''),
          lastName: String(replyToSender.lastName || ''),
          email: String(replyToSender.email || ''),
          phoneNumber: '',
          role: 'USER' as const,
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: false,
          avatar: replyToSender.avatar,
          lastSeen: new Date(),
          createdAt: new Date(),
          lastActiveAt: new Date(),
          isActive: true,
          updatedAt: new Date()
        };
      } else if (replyToAnonymousSender) {
        const displayName = `${String(replyToAnonymousSender.firstName || '')} ${String(replyToAnonymousSender.lastName || '')}`.trim() || 
                           String(replyToAnonymousSender.username) || 
                           'Utilisateur anonyme';
        replyToFinalSender = {
          id: String(replyToAnonymousSender.id || 'unknown'),
          username: String(replyToAnonymousSender.username || 'Anonymous'),
          displayName: displayName,
          firstName: String(replyToAnonymousSender.firstName || ''),
          lastName: String(replyToAnonymousSender.lastName || ''),
          email: '',
          phoneNumber: '',
          role: 'USER' as const,
          systemLanguage: String(replyToAnonymousSender.language || 'fr'),
          regionalLanguage: String(replyToAnonymousSender.language || 'fr'),
          autoTranslateEnabled: false,
          translateToSystemLanguage: false,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: false,
          avatar: undefined,
          lastSeen: new Date(),
          createdAt: new Date(),
          lastActiveAt: new Date(),
          isActive: true,
          updatedAt: new Date()
        };
      } else {
        replyToFinalSender = {
          id: String(replyToMsg.senderId || replyToMsg.anonymousSenderId || 'unknown'),
          username: 'Unknown',
          displayName: 'Utilisateur Inconnu',
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: '',
          role: 'USER' as const,
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
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
        };
      }
      
      replyTo = {
        id: String(replyToMsg.id),
        content: String(replyToMsg.content),
        senderId: String(replyToMsg.senderId || replyToMsg.anonymousSenderId || ''),
        conversationId: String(replyToMsg.conversationId),
        originalLanguage: String(replyToMsg.originalLanguage || 'fr'),
        messageType: String(replyToMsg.messageType || 'text') as any,
        createdAt: new Date(replyToMsg.createdAt),
        timestamp: new Date(replyToMsg.createdAt),
        sender: replyToFinalSender,
        translations: [],
        isEdited: false,
        isDeleted: false,
        updatedAt: new Date(replyToMsg.updatedAt || replyToMsg.createdAt),
      };
    }
    // 2. Sinon, essayer de reconstituer depuis la liste locale
    else if (socketMessage.replyToId && this.getMessageByIdCallback) {
      // Reconstituer depuis la liste locale
      replyTo = this.getMessageByIdCallback(socketMessage.replyToId);
    }

    // Définir le sender par défaut UNE SEULE FOIS (pour les cas d'échec)
    const defaultSender = {
      id: socketMessage.senderId || (socketMessage as any).anonymousSenderId || 'unknown',
      username: 'Utilisateur inconnu',
      firstName: '',
      lastName: '',
      displayName: 'Utilisateur inconnu',
      email: '',
      phoneNumber: '',
      role: 'USER' as const,
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
    };
    
    // Construire l'objet sender en gérant les utilisateurs anonymes
    let sender;
    if (socketMessage.sender) {
      // Utilisateur authentifié
      sender = socketMessage.sender;
    } else if ((socketMessage as any).anonymousSender) {
      // Utilisateur anonyme - construire un objet sender à partir de anonymousSender
      const anonymousSender = (socketMessage as any).anonymousSender;
      const displayName = `${anonymousSender.firstName || ''} ${anonymousSender.lastName || ''}`.trim() || 
                         anonymousSender.username || 
                         'Utilisateur anonyme';
      sender = {
        id: anonymousSender.id || defaultSender.id,
        username: anonymousSender.username || 'Anonymous',
        firstName: anonymousSender.firstName || '',
        lastName: anonymousSender.lastName || '',
        displayName: displayName,
        email: '',
        phoneNumber: '',
        role: 'USER' as const,
        systemLanguage: anonymousSender.language || 'fr',
        regionalLanguage: anonymousSender.language || 'fr',
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
      };
    } else {
      // Cas d'échec : utiliser le sender par défaut
      sender = defaultSender;
    }

    // Transformer les attachments si présents
    const attachments = Array.isArray((socketMessage as any).attachments)
      ? (socketMessage as any).attachments.map((att: any) => ({
          id: String(att.id || ''),
          messageId: socketMessage.id,
          fileName: String(att.fileName || ''),
          originalName: String(att.originalName || att.fileName || ''),
          fileUrl: String(att.fileUrl || ''),
          mimeType: String(att.mimeType || ''),
          fileSize: Number(att.fileSize) || 0,
          thumbnailUrl: att.thumbnailUrl ? String(att.thumbnailUrl) : undefined,
          width: att.width ? Number(att.width) : undefined,
          height: att.height ? Number(att.height) : undefined,
          duration: att.duration ? Number(att.duration) : undefined,
          uploadedBy: String(att.uploadedBy || socketMessage.senderId || (socketMessage as any).anonymousSenderId || ''),
          isAnonymous: Boolean(att.isAnonymous),
          createdAt: String(att.createdAt || new Date().toISOString()),
        }))
      : [];

    return {
      id: socketMessage.id,
      conversationId: socketMessage.conversationId,
      senderId: socketMessage.senderId || (socketMessage as any).anonymousSenderId || '',
      content: socketMessage.content,
      originalLanguage: socketMessage.originalLanguage || 'fr',
      messageType: socketMessage.messageType,
      timestamp: socketMessage.createdAt,
      createdAt: socketMessage.createdAt,
      updatedAt: socketMessage.updatedAt,
      isEdited: false,
      isDeleted: false,
      translations: [],
      replyTo: replyTo,
      sender: sender,
      attachments: attachments.length > 0 ? attachments : undefined
    } as Message;
  }

  /**
   * Programme une tentative de reconnexion
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Backoff exponentiel
    this.reconnectAttempts++;

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
    this.currentUser = user;

    // Vérifier que le token est disponible
    const authToken = authManager.getAuthToken();
    const anonymousToken = authManager.getAnonymousSession()?.token;
    const token = authToken || anonymousToken;
    
    if (!token) {
      // OPTIMISATION: Retry très rapide et limité
      let attempts = 0;
      const maxAttempts = 3; // Réduit à 3 tentatives
      const retryInterval = setInterval(() => {
        attempts++;
        const retryAuthToken = authManager.getAuthToken();
        const retryAnonymousToken = authManager.getAnonymousSession()?.token;
        const retryToken = retryAuthToken || retryAnonymousToken;
        
        if (retryToken && this.currentUser) {
          clearInterval(retryInterval);
          this.ensureConnection();
        } else if (attempts >= maxAttempts) {
          clearInterval(retryInterval);
        }
      }, 200); // Réduit à 200ms pour être plus rapide
      
      return;
    }

    // CORRECTION: Utiliser ensureConnection() pour gérer intelligemment la connexion
    this.ensureConnection();
  }

  /**
   * Force un auto-join manuel (appelé quand les données de conversation sont disponibles)
   * Utile pour /chat quand anonymous_chat_data est chargé après l'authentification
   */
  public triggerAutoJoin(): void {
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
      // Mémoriser la conversation pour l'auto-join après connexion
      try {
        let conversationId: string;
        if (typeof conversationOrId === 'string') {
          conversationId = conversationOrId;
        } else {
          conversationId = getConversationApiId(conversationOrId);
        }
        
        this.currentConversationId = conversationId;
      } catch (error) {
        // Ignore error
      }
      
      return;
    }
    
    // CORRECTION: Attendre que le socket soit réellement connecté
    if (!this.socket.connected) {
      // Mémoriser pour auto-join après authentification
      try {
        let conversationId: string;
        if (typeof conversationOrId === 'string') {
          conversationId = conversationOrId;
        } else {
          conversationId = getConversationApiId(conversationOrId);
        }
        
        this.currentConversationId = conversationId;
      } catch (error) {
        // Ignore error
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
      
      // CORRECTION: Effacer la conversation mémorisée si on quitte la conversation active
      if (this.currentConversationId === conversationId) {
        this.currentConversationId = null;
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
      // CORRECTION CRITIQUE: S'assurer que la connexion est établie
      this.ensureConnection();
      
      if (!this.socket) {
        // Dernière tentative: forcer l'initialisation
        const hasAuthToken = !!authManager.getAuthToken();
        const hasSessionToken = !!authManager.getAnonymousSession()?.token;
        
        if (hasAuthToken || hasSessionToken) {
          this.initializeConnection();
          
          // Attendre que le socket se crée
          await new Promise(wait => setTimeout(wait, 500));
          
          // Vérifier si le socket est maintenant créé
          if (!this.socket) {
            toast.error('Impossible d\'initialiser la connexion WebSocket');
            resolve(false);
            return;
          }
        } else {
          toast.error('Veuillez vous connecter pour envoyer des messages');
          resolve(false);
          return;
        }
      }

      // CORRECTION CRITIQUE: Vérifier l'état RÉEL du socket
      const socketConnected = this.socket.connected === true;
      const socketDisconnected = this.socket.disconnected === true;

      if (!socketConnected || socketDisconnected) {
        // Tenter une reconnexion immédiate et attendre
        console.log('🔄 [sendMessage] Connexion perdue, tentative de reconnexion...');
        toast.info('Connexion perdue. Reconnexion en cours...');

        this.reconnect();

        // Attendre jusqu'à 5 secondes pour la reconnexion
        let reconnected = false;
        for (let i = 0; i < 10; i++) {
          await new Promise(wait => setTimeout(wait, 500));

          if (this.socket && this.socket.connected) {
            reconnected = true;
            console.log('✅ [sendMessage] Reconnexion réussie, envoi du message...');
            toast.success('Reconnecté ! Envoi du message...');
            break;
          }
        }

        if (!reconnected) {
          console.error('❌ [sendMessage] Échec de la reconnexion après 5 secondes');
          toast.error('Impossible de se reconnecter. Veuillez réessayer.');
          resolve(false);
          return;
        }
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

        // Utiliser l'ObjectId pour l'envoi au backend
        const messageData = { 
          conversationId, 
          content,
          ...(originalLanguage && { originalLanguage }),
          ...(replyToId && { replyToId })
        };

        // Ajouter un timeout pour éviter que la promesse reste en attente
        const timeout = setTimeout(() => {
          toast.error('Timeout: Le serveur n\'a pas répondu à temps');
          resolve(false);
        }, 10000); // 10 secondes de timeout

        this.socket.emit(CLIENT_EVENTS.MESSAGE_SEND, messageData, (response: any) => {
          clearTimeout(timeout); // Annuler le timeout si on reçoit une réponse
          
          if (response?.success) {
            resolve(true);
          } else {
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
      // S'assurer que la connexion est établie
      this.ensureConnection();

      if (!this.socket) {
        // Dernière tentative: forcer l'initialisation
        const hasAuthToken = !!authManager.getAuthToken();
        const hasSessionToken = !!authManager.getAnonymousSession()?.token;

        if (hasAuthToken || hasSessionToken) {
          this.initializeConnection();

          // Attendre que le socket se crée
          await new Promise(wait => setTimeout(wait, 500));

          if (!this.socket) {
            toast.error('Impossible d\'initialiser la connexion WebSocket');
            resolve(false);
            return;
          }
        } else {
          toast.error('Veuillez vous connecter pour envoyer des messages');
          resolve(false);
          return;
        }
      }

      // Vérifier l'état RÉEL du socket
      const socketConnected = this.socket.connected === true;
      const socketDisconnected = this.socket.disconnected === true;

      if (!socketConnected || socketDisconnected) {
        // Tenter une reconnexion immédiate et attendre
        console.log('🔄 [sendMessageWithAttachments] Connexion perdue, tentative de reconnexion...');
        toast.info('Connexion perdue. Reconnexion en cours...');

        this.reconnect();

        // Attendre jusqu'à 5 secondes pour la reconnexion
        let reconnected = false;
        for (let i = 0; i < 10; i++) {
          await new Promise(wait => setTimeout(wait, 500));

          if (this.socket && this.socket.connected) {
            reconnected = true;
            console.log('✅ [sendMessageWithAttachments] Reconnexion réussie, envoi du message...');
            toast.success('Reconnecté ! Envoi du message...');
            break;
          }
        }

        if (!reconnected) {
          console.error('❌ [sendMessageWithAttachments] Échec de la reconnexion après 5 secondes');
          toast.error('Impossible de se reconnecter. Veuillez réessayer.');
          resolve(false);
          return;
        }
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
            resolve(true);
          } else {
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

      this.socket.emit(CLIENT_EVENTS.MESSAGE_EDIT, { messageId, content }, (response) => {
        if (response?.success) {
          resolve(true);
        } else {
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

      this.socket.emit(CLIENT_EVENTS.MESSAGE_DELETE, { messageId }, (response) => {
        if (response?.success) {
          resolve(true);
        } else {
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
    if (!this.socket) {
      console.warn('[MeeshySocketIO] ⚠️ startTyping: socket non disponible');
      return;
    }
    this.socket.emit(CLIENT_EVENTS.TYPING_START, { conversationId });
  }

  /**
   * Arrête l'indicateur de frappe
   */
  public stopTyping(conversationId: string): void {
    if (!this.socket) {
      console.warn('[MeeshySocketIO] ⚠️ stopTyping: socket non disponible');
      return;
    }
    this.socket.emit(CLIENT_EVENTS.TYPING_STOP, { conversationId });
  }

  /**
   * Force une reconnexion (méthode publique)
   */
  public reconnect(): void {
    // CORRECTION CRITIQUE 1: Ne PAS reconnecter si déjà en cours
    if (this.isConnecting) {
      return;
    }
    
    // CORRECTION CRITIQUE 2: Vérifier l'état RÉEL du socket
    const actuallyConnected = this.socket?.connected === true && this.isConnected;
    
    // IMPORTANT: Ne PAS reconnecter si déjà connecté ET authentifié
    if (this.socket && actuallyConnected) {
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
        try {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        } catch (e) {
          // Ignore cleanup errors
        }
      } else if (socketState.connecting) {
        return; // Ne pas interrompre une connexion en cours
      } else if (socketState.connected) {
        try {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // CORRECTION: Vérifier tokens même si currentUser est null
    const hasAuthToken = typeof window !== 'undefined' && !!authManager.getAuthToken();
    const hasSessionToken = typeof window !== 'undefined' && !!authManager.getAnonymousSession()?.token;
    
    if (this.currentUser || hasAuthToken || hasSessionToken) {
      this.initializeConnection();
    } else {
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
    return () => {
      this.typingListeners.delete(listener);
    };
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

  public onReactionAdded(listener: (data: any) => void): () => void {
    this.reactionAddedListeners.add(listener);
    return () => this.reactionAddedListeners.delete(listener);
  }

  public onReactionRemoved(listener: (data: any) => void): () => void {
    this.reactionRemovedListeners.add(listener);
    return () => this.reactionRemovedListeners.delete(listener);
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
   * Obtient l'ID de conversation actuel normalisé (ObjectId)
   * Retourne l'ObjectId normalisé reçu du backend via CONVERSATION_JOINED.
   * Le backend normalise tous les IDs (identifier → ObjectId) pour garantir que
   * tous les clients utilisent le même ObjectId pour les rooms et événements Socket.IO.
   * L'INVARIANT est l'ObjectId MongoDB (24 caractères hex).
   */
  public getCurrentConversationId(): string | null {
    return this.currentConversationId;
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
    const token = typeof window !== 'undefined' ? authManager.getAuthToken() : null;
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

// Fonction pour obtenir le service de manière lazy (pas d'instanciation au chargement du module)
// OPTIMISATION: Évite le log "🏗️ [SINGLETON] Création..." au chargement initial de la page
export const getSocketIOService = (): MeeshySocketIOService => {
  return MeeshySocketIOService.getInstance();
};

// Export pour compatibilité avec le code existant
// Utilise un Proxy pour lazy loading - l'instance n'est créée qu'au premier accès
export const meeshySocketIOService = new Proxy({} as MeeshySocketIOService, {
  get: (target, prop) => {
    const instance = MeeshySocketIOService.getInstance();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});
