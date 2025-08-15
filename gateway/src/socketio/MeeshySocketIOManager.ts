/**
 * Gestionnaire Socket.IO pour Meeshy
 * Gestion des connexions, conversations et traductions en temps réel
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient } from '../../shared/prisma/client';
import { TranslationService, MessageData } from '../services/TranslationService';
import jwt from 'jsonwebtoken';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents,
  SocketIOMessage,
  SocketIOUser,
  TypingEvent,
  TranslationEvent
} from '../../shared/types/socketio-events';
import { CLIENT_EVENTS, SERVER_EVENTS } from '../../shared/types/socketio-events';
import { conversationStatsService } from '../services/ConversationStatsService';

export interface SocketUser {
  id: string;
  socketId: string;
  isAnonymous: boolean;
  language: string;
}

export interface TranslationNotification {
  messageId: string;
  translatedText: string;
  targetLanguage: string;
  confidenceScore: number;
}

export class MeeshySocketIOManager {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private prisma: PrismaClient;
  private translationService: TranslationService;
  
  // Mapping des utilisateurs connectés
  private connectedUsers: Map<string, SocketUser> = new Map();
  private socketToUser: Map<string, string> = new Map();
  
  // Statistiques
  private stats = {
    total_connections: 0,
    active_connections: 0,
    messages_processed: 0,
    translations_sent: 0,
    errors: 0
  };

  constructor(httpServer: HTTPServer, prisma: PrismaClient) {
    this.prisma = prisma;
    this.translationService = new TranslationService(prisma);
    
    // Initialiser Socket.IO avec les types shared
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      cors: {
        origin: '*',
        methods: ["GET", "POST"],
        allowedHeaders: ['authorization', 'content-type','websocket', 'polling'],
        credentials: true
      }
    });
    
    console.log('[GATEWAY] 🚀 MeeshySocketIOManager initialisé');
  }

  async initialize(): Promise<void> {
    try {
      // Initialiser le service de traduction
      await this.translationService.initialize();
      
      // Écouter les événements de traduction prêtes
      this.translationService.on('translationReady', this._handleTranslationReady.bind(this));
      
      // Configurer les événements Socket.IO
      this._setupSocketEvents();
      // Démarrer le ticker périodique des stats en ligne
      this._ensureOnlineStatsTicker();
      
      // Note: Les événements de traduction sont gérés via le singleton ZMQ
      
      console.log('[GATEWAY] ✅ MeeshySocketIOManager initialisé avec succès');
      
    } catch (error) {
      console.error('[GATEWAY] ❌ Erreur initialisation MeeshySocketIOManager:', error);
      throw error;
    }
  }

  private _setupSocketEvents(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Nouvelle connexion: ${socket.id}`);
      this.stats.total_connections++;
      this.stats.active_connections++;
      
      // Authentification automatique via le token envoyé dans socket.auth
      this._handleTokenAuthentication(socket);
      
      // Authentification manuelle (fallback)
      socket.on(CLIENT_EVENTS.AUTHENTICATE, async (data: { userId?: string; sessionToken?: string; language?: string }) => {
        await this._handleAuthentication(socket, data);
      });
      
      // Réception d'un nouveau message (avec ACK)
      socket.on(CLIENT_EVENTS.MESSAGE_SEND, async (data: {
        conversationId: string;
        content: string;
        originalLanguage?: string;
        messageType?: string;
        replyToId?: string;
      }, callback?: (response: { success: boolean; data?: { messageId: string }; error?: string }) => void) => {
        try {
          const result = await this._handleNewMessage(socket, data);
          if (callback && result?.messageId) {
            callback({ success: true, data: { messageId: result.messageId } });
          }
        } catch (e) {
          if (callback) {
            callback({ success: false, error: 'Failed to send message' });
          }
        }
      });
      
      // Demande de traduction spécifique
      socket.on(CLIENT_EVENTS.REQUEST_TRANSLATION, async (data: { messageId: string; targetLanguage: string }) => {
        await this._handleTranslationRequest(socket, data);
      });

      // Gestion des rooms conversation: join
      socket.on(CLIENT_EVENTS.CONVERSATION_JOIN, (data: { conversationId: string }) => {
        const room = `conversation_${data.conversationId}`;
        socket.join(room);
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
          socket.emit(SERVER_EVENTS.CONVERSATION_JOINED, { conversationId: data.conversationId, userId });
          // Pré-charger/rafraîchir les stats pour cette conversation et les envoyer au socket qui rejoint
          this._sendConversationStatsToSocket(socket, data.conversationId).catch(() => {});
        }
        console.log(`👥 Socket ${socket.id} rejoint ${room}`);
      });

      // Gestion des rooms conversation: leave
      socket.on(CLIENT_EVENTS.CONVERSATION_LEAVE, (data: { conversationId: string }) => {
        const room = `conversation_${data.conversationId}`;
        socket.leave(room);
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
          socket.emit(SERVER_EVENTS.CONVERSATION_LEFT, { conversationId: data.conversationId, userId });
        }
        console.log(`👥 Socket ${socket.id} quitte ${room}`);
      });
      
      // Déconnexion
      socket.on('disconnect', () => {
        this._handleDisconnection(socket);
      });
      
      // Événements de frappe
      socket.on(CLIENT_EVENTS.TYPING_START, (data: { conversationId: string }) => {
        this._handleTypingStart(socket, data);
      });
      
      socket.on(CLIENT_EVENTS.TYPING_STOP, (data: { conversationId: string }) => {
        this._handleTypingStop(socket, data);
      });
    });
  }

  private async _handleTokenAuthentication(socket: any): Promise<void> {
    try {
      // Essayer de récupérer le token depuis différentes sources
      let token = socket.auth?.token;
      
      // Si pas dans auth, essayer dans les headers
      if (!token && socket.handshake?.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      
      console.log(`🔍 Authentification pour socket ${socket.id}:`, {
        hasAuth: !!socket.auth,
        authKeys: socket.auth ? Object.keys(socket.auth) : [],
        tokenExists: !!token,
        tokenLength: token?.length,
        tokenPreview: token ? token.substring(0, 30) + '...' : 'none',
        hasAuthHeader: !!socket.handshake?.headers?.authorization,
        authHeaderPreview: socket.handshake?.headers?.authorization ? socket.handshake.headers.authorization.substring(0, 30) + '...' : 'none'
      });
      
      if (!token) {
        console.log(`⚠️ Aucun token fourni pour socket ${socket.id}`);
        return;
      }

      // Vérifier et décoder le token JWT
      const jwtSecret = process.env.JWT_SECRET || 'default-secret';
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      console.log(`🔐 Token JWT vérifié pour utilisateur: ${decoded.userId}`);

      // Récupérer l'utilisateur depuis la base de données
      const dbUser = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { 
          id: true, 
          username: true,
          systemLanguage: true 
        }
      });

      if (!dbUser) {
        console.log(`❌ Utilisateur ${decoded.userId} non trouvé en base`);
        socket.emit(SERVER_EVENTS.ERROR, { message: 'User not found' });
        return;
      }

      // Créer l'utilisateur Socket.IO
      const user: SocketUser = {
        id: dbUser.id,
        socketId: socket.id,
        isAnonymous: false,
        language: dbUser.systemLanguage
      };

      // Enregistrer l'utilisateur
      this.connectedUsers.set(user.id, user);
      this.socketToUser.set(socket.id, user.id);

      // Rejoindre les conversations de l'utilisateur
      await this._joinUserConversations(socket, user.id, false);

      // Rejoindre la room globale si elle existe (conversation 'any')
      try {
        socket.join(`conversation_any`);
        console.log(`👥 Utilisateur ${user.id} rejoint conversation globale 'any'`);
      } catch {}

      console.log(`✅ Utilisateur authentifié automatiquement: ${user.id}`);

    } catch (error) {
      console.error(`❌ Erreur authentification token:`, error);
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid token' });
    }
  }

  private async _handleAuthentication(socket: any, data: { userId?: string; sessionToken?: string; language?: string }) {
    try {
      let user: SocketUser | null = null;
      
      if (data.sessionToken) {
        // Vérifier si c'est un token JWT pour un utilisateur authentifié
        try {
          const jwtSecret = process.env.JWT_SECRET || 'default-secret';
          const decoded = jwt.verify(data.sessionToken, jwtSecret) as any;
          
          console.log(`🔐 Token JWT vérifié pour utilisateur: ${decoded.userId}`);
          
          // Récupérer l'utilisateur depuis la base de données
          const dbUser = await this.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { 
              id: true, 
              username: true,
              systemLanguage: true 
            }
          });

          if (dbUser) {
            user = {
              id: dbUser.id,
              socketId: socket.id,
              isAnonymous: false,
              language: data.language || dbUser.systemLanguage
            };
          } else {
            console.log(`❌ Utilisateur ${decoded.userId} non trouvé en base`);
          }
        } catch (jwtError) {
          console.log(`⚠️ Token JWT invalide, tentative comme sessionToken anonyme`);
          
          // Si ce n'est pas un JWT valide, essayer comme sessionToken anonyme
          const anonymousUser = await this.prisma.anonymousParticipant.findUnique({
            where: { sessionToken: data.sessionToken },
            select: { id: true }
          });
          
          if (anonymousUser) {
            user = {
              id: anonymousUser.id,
              socketId: socket.id,
              isAnonymous: true,
              language: data.language || 'fr'
            };
          }
        }
      } else if (data.userId) {
        // Utilisateur authentifié (fallback)
        const dbUser = await this.prisma.user.findUnique({
          where: { id: data.userId },
          select: { id: true, systemLanguage: true }
        });
        
        if (dbUser) {
          user = {
            id: dbUser.id,
            socketId: socket.id,
            isAnonymous: false,
            language: data.language || dbUser.systemLanguage
          };
        }
      }
      
      if (user) {
        // Enregistrer l'utilisateur
        this.connectedUsers.set(user.id, user);
        this.socketToUser.set(socket.id, user.id);
        
        // Rejoindre les conversations de l'utilisateur
        await this._joinUserConversations(socket, user.id, user.isAnonymous);

        // Rejoindre la room globale 'any'
        try {
          socket.join(`conversation_any`);
          console.log(`👥 Utilisateur ${user.id} rejoint conversation globale 'any'`);
        } catch {}
        
        socket.emit(SERVER_EVENTS.AUTHENTICATED, { success: true, user: { id: user.id, language: user.language } });
        console.log(`✅ Utilisateur authentifié: ${user.id} (${user.isAnonymous ? 'anonyme' : 'connecté'})`);
        
      } else {
        socket.emit(SERVER_EVENTS.AUTHENTICATED, { success: false, error: 'Authentication failed' });
        console.log(`❌ Échec authentification pour socket ${socket.id}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur authentification: ${error}`);
      socket.emit(SERVER_EVENTS.AUTHENTICATED, { success: false, error: 'Authentication error' });
    }
  }

  private async _joinUserConversations(socket: any, userId: string, isAnonymous: boolean) {
    try {
      let conversations: any[] = [];
      
      if (isAnonymous) {
        // Conversations pour participants anonymes
        conversations = await this.prisma.anonymousParticipant.findMany({
          where: { id: userId },
          select: { conversationId: true }
        });
      } else {
        // Conversations pour utilisateurs authentifiés
        conversations = await this.prisma.conversationMember.findMany({
          where: { userId: userId, isActive: true },
          select: { conversationId: true }
        });
      }
      
      // Rejoindre les rooms Socket.IO
      for (const conv of conversations) {
        socket.join(`conversation_${conv.conversationId}`);
        console.log(`👥 Utilisateur ${userId} rejoint conversation ${conv.conversationId}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur jointure conversations: ${error}`);
    }
  }

  private async _handleNewMessage(socket: any, data: {
    conversationId: string;
    content: string;
    originalLanguage?: string;
    messageType?: string;
    replyToId?: string;
  }): Promise<{ messageId: string }> {
    try {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { message: 'User not authenticated' });
        throw new Error('User not authenticated');
      }
      
      console.log(`📝 Nouveau message de ${userId} dans ${data.conversationId}: ${data.content.substring(0, 50)}...`);
      
      // Préparer les données du message
      const connectedUser = this.connectedUsers.get(userId);
      const messageData: MessageData = {
        conversationId: data.conversationId,
        content: data.content,
        // Utiliser ordre de priorité: payload -> langue socket utilisateur -> 'fr'
        originalLanguage: data.originalLanguage || connectedUser?.language || 'fr',
        messageType: data.messageType || 'text',
        replyToId: data.replyToId
      };
      
      // Déterminer le type d'expéditeur
      const user = this.connectedUsers.get(userId);
      if (user?.isAnonymous) {
        messageData.anonymousSenderId = userId;
      } else {
        messageData.senderId = userId;
      }
      
      // 1. SAUVEGARDER LE MESSAGE ET LIBÉRER LE CLIENT
      const result = await this.translationService.handleNewMessage(messageData);
      this.stats.messages_processed++;
      
      // 2. (Optionnel) Notifier l'état de sauvegarde — laissé pour compat rétro
      socket.emit(SERVER_EVENTS.MESSAGE_SENT, {
        messageId: result.messageId,
        status: result.status,
        timestamp: new Date().toISOString()
      });
      
      // 3. RÉCUPÉRER LE MESSAGE SAUVEGARDÉ ET LE DIFFUSER À TOUS (Y COMPRIS L'AUTEUR)
      const saved = await this.prisma.message.findUnique({
        where: { id: result.messageId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              role: true
            }
          }
        }
      });

      // 3.b Calculer/mettre à jour les statistiques de conversation (cache 1h) et les inclure en meta
      const updatedStats = await conversationStatsService.updateOnNewMessage(
        this.prisma,
        data.conversationId,
        (saved?.originalLanguage || messageData.originalLanguage || 'fr'),
        () => this.getConnectedUsers()
      );

      const messagePayload = {
        id: saved?.id || result.messageId,
        conversationId: data.conversationId,
        senderId: saved?.senderId || messageData.senderId,
        content: saved?.content || data.content,
        originalLanguage: saved?.originalLanguage || messageData.originalLanguage || 'fr',
        messageType: saved?.messageType || data.messageType || 'text',
        isEdited: Boolean(saved?.isEdited),
        isDeleted: Boolean(saved?.isDeleted),
        createdAt: saved?.createdAt || new Date(),
        updatedAt: saved?.updatedAt || new Date(),
        sender: saved?.sender
          ? {
              id: saved.sender.id,
              username: saved.sender.username,
              displayName: (saved.sender as any).displayName || saved.sender.username,
              avatar: (saved.sender as any).avatar,
              role: (saved.sender as any).role,
              // champs additionnels non critiques
              firstName: '',
              lastName: '',
              email: '',
              isOnline: false,
              lastSeen: new Date(),
              lastActiveAt: new Date(),
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          : undefined,
        meta: {
          conversationStats: updatedStats
        }
      } as any;

      this.io.to(`conversation_${data.conversationId}`).emit(SERVER_EVENTS.MESSAGE_NEW, messagePayload);
      // S'assurer que l'auteur reçoit aussi (au cas où il ne serait pas dans la room encore)
      socket.emit(SERVER_EVENTS.MESSAGE_NEW, messagePayload);
      
      console.log(`✅ Message ${result.messageId} sauvegardé et diffusé à la conversation ${data.conversationId}`);
      
      // 4. LES TRADUCTIONS SERONT TRAITÉES EN ASYNCHRONE PAR LE TRANSLATION SERVICE
      // ET LES RÉSULTATS SERONT ENVOYÉS VIA LES ÉVÉNEMENTS 'translationReady'
      
      return { messageId: result.messageId };
    } catch (error) {
      console.error(`❌ Erreur traitement message: ${error}`);
      this.stats.errors++;
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Failed to send message' });
      throw error;
    }
  }

  private async _handleTranslationRequest(socket: any, data: { messageId: string; targetLanguage: string }) {
    try {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) {
        socket.emit(SERVER_EVENTS.ERROR, { message: 'User not authenticated' });
        return;
      }
      
      console.log(`🌍 Demande de traduction: ${data.messageId} -> ${data.targetLanguage}`);
      
      // Récupérer la traduction (depuis le cache ou la base de données)
      const translation = await this.translationService.getTranslation(data.messageId, data.targetLanguage);
      
      if (translation) {
        socket.emit(SERVER_EVENTS.TRANSLATION_RECEIVED, {
          messageId: data.messageId,
          translatedText: translation.translatedText,
          targetLanguage: data.targetLanguage,
          confidenceScore: translation.confidenceScore
        });
        
        this.stats.translations_sent++;
        console.log(`✅ Traduction envoyée: ${data.messageId} -> ${data.targetLanguage}`);
        
      } else {
        socket.emit(SERVER_EVENTS.TRANSLATION_ERROR, {
          messageId: data.messageId,
          targetLanguage: data.targetLanguage,
          error: 'Translation not available'
        });
        
        console.log(`⚠️ Traduction non disponible: ${data.messageId} -> ${data.targetLanguage}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur demande traduction: ${error}`);
      this.stats.errors++;
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Failed to get translation' });
    }
  }

  private async _handleTranslationReady(data: { taskId: string; result: any; targetLanguage: string }) {
    try {
      const { result, targetLanguage } = data;
      
      console.log(`📤 [SocketIOManager] Envoi traduction aux clients: ${result.messageId} -> ${targetLanguage}`);
      console.log(`🔍 [SocketIOManager] Données de traduction:`, {
        messageId: result.messageId,
        translatedText: result.translatedText?.substring(0, 50) + '...',
        targetLanguage,
        confidenceScore: result.confidenceScore
      });
      
      // Récupérer les utilisateurs qui ont besoin de cette traduction
      const targetUsers = this._findUsersForLanguage(targetLanguage);
      let conversationIdForBroadcast: string | null = null;
      
      // Récupérer la conversation du message pour broadcast de room
      // (pour garantir réception côté front même si la langue ne matche pas strictement)
      // Cette info est aussi utile pour clients multi-langues
      try {
        const msg = await this.prisma.message.findUnique({
          where: { id: result.messageId },
          select: { conversationId: true }
        });
        conversationIdForBroadcast = msg?.conversationId || null;
      } catch {}
      
      // Envoyer la traduction aux utilisateurs concernés
      for (const user of targetUsers) {
        const userSocket = this.io.sockets.sockets.get(user.socketId);
        if (userSocket) {
          userSocket.emit('message:translation', {
            messageId: result.messageId,
            translations: [{
              messageId: result.messageId,
              sourceLanguage: 'auto',
              targetLanguage: targetLanguage,
              translatedContent: result.translatedText,
              translationModel: 'basic',
              cacheKey: `${result.messageId}_auto_${targetLanguage}`,
              cached: false,
              confidenceScore: result.confidenceScore
            }]
          });
          
          this.stats.translations_sent++;
        }
      }
      
      // Diffuser également dans la room de conversation (fallback efficace)
      if (conversationIdForBroadcast) {
        this.io.to(`conversation_${conversationIdForBroadcast}`).emit('message:translation', {
          messageId: result.messageId,
          translations: [{
            messageId: result.messageId,
            sourceLanguage: 'auto',
            targetLanguage: targetLanguage,
            translatedContent: result.translatedText,
            translationModel: 'basic',
            cacheKey: `${result.messageId}_auto_${targetLanguage}`,
            cached: false,
            confidenceScore: result.confidenceScore
          }]
        });
      }
      
      console.log(`✅ Traduction ${result.messageId} -> ${targetLanguage} envoyée à ${targetUsers.length} utilisateurs`);
      
    } catch (error) {
      console.error(`❌ Erreur envoi traduction: ${error}`);
      this.stats.errors++;
    }
  }

  private _findUsersForLanguage(targetLanguage: string): SocketUser[] {
    const targetUsers: SocketUser[] = [];
    
    for (const [userId, user] of this.connectedUsers) {
      if (user.language === targetLanguage) {
        targetUsers.push(user);
      }
    }
    
    return targetUsers;
  }

  private _handleDisconnection(socket: any) {
    const userId = this.socketToUser.get(socket.id);
    
    if (userId) {
      this.connectedUsers.delete(userId);
      this.socketToUser.delete(socket.id);
      
      console.log(`🔌 Déconnexion: ${userId} (socket: ${socket.id})`);
    }
    
    this.stats.active_connections--;
  }

  private _handleTypingStart(socket: any, data: { conversationId: string }) {
    const userId = this.socketToUser.get(socket.id);
    if (userId) {
      const user = this.connectedUsers.get(userId);
      socket.to(`conversation_${data.conversationId}`).emit('typing:start', {
        userId: userId,
        username: user?.id || 'unknown',
        conversationId: data.conversationId
      });
    }
  }

  private _handleTypingStop(socket: any, data: { conversationId: string }) {
    const userId = this.socketToUser.get(socket.id);
    if (userId) {
      const user = this.connectedUsers.get(userId);
      socket.to(`conversation_${data.conversationId}`).emit('typing:stop', {
        userId: userId,
        username: user?.id || 'unknown',
        conversationId: data.conversationId
      });
    }
  }

  // Envoi périodique des stats d'utilisateurs en ligne pour chaque conversation active
  private onlineStatsInterval: NodeJS.Timeout | null = null;

  private _ensureOnlineStatsTicker(): void {
    if (this.onlineStatsInterval) return;
    this.onlineStatsInterval = setInterval(async () => {
      try {
        const conversationIds = conversationStatsService.getActiveConversationIds();
        for (const conversationId of conversationIds) {
          const stats = await conversationStatsService.getOrCompute(
            this.prisma,
            conversationId,
            () => this.getConnectedUsers()
          );
          // n'envoyer que la partie utilisateurs en ligne à fréquence fixe
          this.io.to(`conversation_${conversationId}`).emit(SERVER_EVENTS.CONVERSATION_ONLINE_STATS, {
            conversationId,
            onlineUsers: stats.onlineUsers,
            updatedAt: stats.updatedAt
          } as any);
        }
      } catch {}
    }, 10000); // toutes les 10s par défaut
  }

  private async _sendConversationStatsToSocket(socket: any, conversationId: string): Promise<void> {
    this._ensureOnlineStatsTicker();
    const stats = await conversationStatsService.getOrCompute(
      this.prisma,
      conversationId,
      () => this.getConnectedUsers()
    );
    socket.emit(SERVER_EVENTS.CONVERSATION_STATS, { conversationId, stats } as any);
  }

  // Méthodes publiques pour les statistiques et la gestion
  getStats() {
    return {
      ...this.stats,
      connected_users: this.connectedUsers.size,
      translation_service_stats: this.translationService.getStats()
    };
  }

  /**
   * Déconnecte un utilisateur spécifique
   */
  disconnectUser(userId: string): boolean {
    const user = this.connectedUsers.get(userId);
    if (user) {
      const socket = this.io.sockets.sockets.get(user.socketId);
      if (socket) {
        socket.disconnect(true);
        console.log(`🔌 Utilisateur ${userId} déconnecté par admin`);
        return true;
      }
    }
    return false;
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   */
  sendToUser<K extends keyof ServerToClientEvents>(
    userId: string, 
    event: K, 
    ...args: Parameters<ServerToClientEvents[K]>
  ): boolean {
    const user = this.connectedUsers.get(userId);
    if (user) {
      const socket = this.io.sockets.sockets.get(user.socketId);
      if (socket) {
        socket.emit(event, ...args);
        return true;
      }
    }
    return false;
  }

  /**
   * Broadcast un message à tous les utilisateurs connectés
   */
  broadcast<K extends keyof ServerToClientEvents>(
    event: K, 
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    this.io.emit(event, ...args);
  }

  /**
   * Obtient la liste des utilisateurs connectés
   */
  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  async healthCheck(): Promise<boolean> {
    try {
      const translationHealth = await this.translationService.healthCheck();
      return translationHealth;
    } catch (error) {
      console.error(`❌ Health check échoué: ${error}`);
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.translationService.close();
      this.io.close();
      console.log('[GATEWAY] ✅ MeeshySocketIOManager fermé');
    } catch (error) {
      console.error(`❌ Erreur fermeture MeeshySocketIOManager: ${error}`);
    }
  }
}
