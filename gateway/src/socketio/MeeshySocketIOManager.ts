/**
 * Gestionnaire Socket.IO pour Meeshy
 * Gestion des connexions, conversations et traductions en temps réel
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient } from '../../shared/prisma/client';
import { TranslationService, MessageData } from '../services/TranslationService';
import { MaintenanceService } from '../services/maintenance.service';
import { MessagingService } from '../services/MessagingService';
import { MessageNotificationService } from '../services/MessageNotificationService';
import { UnifiedNotificationService } from '../services/UnifiedNotificationService';
import jwt from 'jsonwebtoken';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents,
  SocketIOMessage,
  SocketIOUser,
  SocketIOResponse,
  TypingEvent,
  TranslationEvent
} from '../../shared/types/socketio-events';
import { CLIENT_EVENTS, SERVER_EVENTS } from '../../shared/types/socketio-events';
import { conversationStatsService } from '../services/ConversationStatsService';
import type { MessageRequest, MessageResponse } from '../../shared/types/messaging';
import type { Message } from '../../shared/types/index';

export interface SocketUser {
  id: string;
  socketId: string;
  isAnonymous: boolean;
  language: string;
  sessionToken?: string; // Pour les utilisateurs anonymes
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
  private maintenanceService: MaintenanceService;
  private messagingService: MessagingService;
  private messageNotificationService: MessageNotificationService;
  private unifiedNotificationService: UnifiedNotificationService;
  
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
    this.maintenanceService = new MaintenanceService(prisma);
    this.messagingService = new MessagingService(prisma, this.translationService);
    this.messageNotificationService = new MessageNotificationService(prisma, this);
    this.unifiedNotificationService = new UnifiedNotificationService(prisma, this);
    
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
    
    console.log('[GATEWAY] 🚀 MeeshySocketIOManager initialisé avec MessagingService');
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
      
      // Démarrer les tâches de maintenance
      console.log('[GATEWAY] 🚀 Tentative de démarrage des tâches de maintenance...');
      try {
        console.log('[GATEWAY] 🔧 MaintenanceService instance:', !!this.maintenanceService);
        await this.maintenanceService.startMaintenanceTasks();
        console.log('[GATEWAY] ✅ Tâches de maintenance démarrées avec succès');
      } catch (error) {
        console.error('[GATEWAY] ❌ Erreur lors du démarrage des tâches de maintenance:', error);
        console.error('[GATEWAY] ❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      }
      
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
      
      // Réception d'un nouveau message (avec ACK) - PHASE 3.1: MessagingService Integration
      socket.on(CLIENT_EVENTS.MESSAGE_SEND, async (data: {
        conversationId: string;
        content: string;
        originalLanguage?: string;
        messageType?: string;
        replyToId?: string;
      }, callback?: (response: SocketIOResponse<{ messageId: string }>) => void) => {
        try {
          const userId = this.socketToUser.get(socket.id);
          if (!userId) {
            const errorResponse: SocketIOResponse<{ messageId: string }> = {
              success: false,
              error: 'User not authenticated'
            };
            
            if (callback) callback(errorResponse);
            socket.emit('error', { message: 'User not authenticated' });
            return;
          }

          // Récupérer les informations de l'utilisateur pour déterminer s'il est anonyme
          const user = this.connectedUsers.get(userId);
          const isAnonymous = user?.isAnonymous || false;

          // Pour les utilisateurs anonymes, récupérer le nom d'affichage depuis la base de données
          let anonymousDisplayName: string | undefined;
          if (isAnonymous) {
            try {
              // Utiliser le sessionToken stocké dans l'objet utilisateur
              const userSessionToken = user?.sessionToken;
              if (!userSessionToken) {
                console.error('SessionToken manquant pour utilisateur anonyme:', userId);
                anonymousDisplayName = 'Anonymous User';
              } else {
                const anonymousUser = await this.prisma.anonymousParticipant.findUnique({
                  where: { sessionToken: userSessionToken },
                  select: { username: true, firstName: true, lastName: true }
                });
              
                if (anonymousUser) {
                  // Construire le nom d'affichage à partir du prénom/nom ou username
                  const fullName = `${anonymousUser.firstName || ''} ${anonymousUser.lastName || ''}`.trim();
                  anonymousDisplayName = fullName || anonymousUser.username || 'Anonymous User';
                } else {
                  anonymousDisplayName = 'Anonymous User';
                }
              }
            } catch (error) {
              console.error('Erreur lors de la récupération du nom anonyme:', error);
              anonymousDisplayName = 'Anonymous User';
            }
          }

          // Mapper les données vers le format MessageRequest
          const messageRequest: MessageRequest = {
            conversationId: data.conversationId,
            content: data.content,
            originalLanguage: data.originalLanguage,
            messageType: data.messageType || 'text',
            replyToId: data.replyToId,
            isAnonymous: isAnonymous,
            anonymousDisplayName: anonymousDisplayName,
            metadata: {
              source: 'websocket',
              socketId: socket.id,
              clientTimestamp: Date.now()
            }
          };

          console.log(`📝 [WEBSOCKET] Nouveau message via MessagingService de ${userId} dans ${data.conversationId}`);

          // PHASE 3.1.1: Extraction des tokens d'authentification pour détection robuste
          const jwtToken = this.extractJWTToken(socket);
          const sessionToken = this.extractSessionToken(socket);

          console.log(`🔐 [AUTH] Type détecté: ${jwtToken ? 'JWT' : sessionToken ? 'Session' : 'Unknown'}`);
          console.log(`🔐 [AUTH] Token details:`, {
            hasJWT: !!jwtToken,
            hasSession: !!sessionToken,
            jwtPreview: jwtToken ? jwtToken.substring(0, 20) + '...' : 'none',
            sessionPreview: sessionToken ? sessionToken.substring(0, 20) + '...' : 'none',
            socketAuth: socket.handshake?.auth,
            socketHeaders: {
              authorization: socket.handshake?.headers?.authorization ? 'present' : 'missing',
              sessionToken: socket.handshake?.headers?.['x-session-token'] ? 'present' : 'missing'
            }
          });

          // PHASE 3.1: Utilisation du MessagingService unifié avec contexte d'auth
          const response: MessageResponse = await this.messagingService.handleMessage(
            messageRequest, 
            userId, 
            true,
            jwtToken,
            sessionToken
          );

          // Réponse via callback - typage strict SocketIOResponse
          if (callback) {
            if (response.success && response.data) {
              const socketResponse: SocketIOResponse<{ messageId: string }> = { 
                success: true, 
                data: { messageId: response.data.id } 
              };
              callback(socketResponse);
            } else {
              const socketResponse: SocketIOResponse<{ messageId: string }> = {
                success: false,
                error: response.error || 'Failed to send message'
              };
              callback(socketResponse);
            }
          }

          // Broadcast temps réel vers tous les clients de la conversation (y compris l'auteur)
          if (response.success && response.data) {
            await this._broadcastNewMessage(response.data, data.conversationId);
          }

          this.stats.messages_processed++;
          
        } catch (error: any) {
          console.error('[WEBSOCKET] Erreur envoi message:', error);
          this.stats.errors++;

          if (callback) {
            const errorResponse: SocketIOResponse<{ messageId: string }> = {
              success: false,
              error: 'Failed to send message'
            };
            callback(errorResponse);
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
      // Debug complet de socket.handshake
      console.log(`🔍 DEBUG socket.handshake pour ${socket.id}:`, {
        hasHandshake: !!socket.handshake,
        headers: socket.handshake?.headers,
        allHeaders: Object.keys(socket.handshake?.headers || {}),
        auth: socket.handshake?.auth,
        query: socket.handshake?.query,
        address: socket.handshake?.address
      });

      // Récupérer les tokens depuis différentes sources avec types précis
      const authToken = socket.handshake?.headers?.authorization?.replace('Bearer ', '') || 
                       socket.handshake?.auth?.authToken;
      const sessionToken = socket.handshake?.headers?.['x-session-token'] as string || 
                          socket.handshake?.auth?.sessionToken;
      
      // Récupérer les types de tokens pour validation précise
      const tokenType = socket.handshake?.auth?.tokenType;
      const sessionType = socket.handshake?.auth?.sessionType;
      
      console.log(`🔍 Authentification hybride pour socket ${socket.id}:`, {
        hasAuthToken: !!authToken,
        hasSessionToken: !!sessionToken,
        tokenType: tokenType || 'unknown',
        sessionType: sessionType || 'unknown',
        authTokenLength: authToken?.length,
        sessionTokenLength: sessionToken?.length,
        authTokenPreview: authToken ? authToken.substring(0, 30) + '...' : 'none',
        sessionTokenPreview: sessionToken ? sessionToken.substring(0, 30) + '...' : 'none'
      });

      // Tentative d'authentification avec Bearer token (utilisateur authentifié)
      if (authToken && (!tokenType || tokenType === 'jwt')) {
        try {
          const jwtSecret = process.env.JWT_SECRET || 'default-secret';
          const decoded = jwt.verify(authToken, jwtSecret) as any;
          
          console.log(`🔐 Token JWT vérifié pour utilisateur: ${decoded.userId} (type: ${tokenType || 'jwt'})`);

          // Récupérer l'utilisateur depuis la base de données
          const dbUser = await this.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { 
              id: true, 
              username: true,
              systemLanguage: true,
              isActive: true
            }
          });

          if (dbUser && dbUser.isActive) {
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

            // Mettre à jour l'état en ligne dans la base de données
            await this.maintenanceService.updateUserOnlineStatus(user.id, true);

            // Rejoindre les conversations de l'utilisateur
            await this._joinUserConversations(socket, user.id, false);

            // Rejoindre la room globale si elle existe (conversation "meeshy")
            try {
              socket.join(`conversation_any`);
              console.log(`👥 Utilisateur authentifié ${user.id} rejoint conversation globale "meeshy"`);
            } catch {}

            console.log(`✅ Utilisateur authentifié automatiquement: ${user.id}`);
            return; // Authentification réussie
          } else {
            console.log(`❌ Utilisateur ${decoded.userId} non trouvé ou inactif`);
          }
        } catch (jwtError) {
          console.log(`⚠️ Token JWT invalide, tentative avec session token`);
        }
      }

      // Tentative d'authentification avec session token (participant anonyme)
      if (sessionToken && (!sessionType || sessionType === 'anonymous')) {
        console.log(`🔍 Tentative d'authentification session token (type: ${sessionType || 'anonymous'})`);
        
        const participant = await this.prisma.anonymousParticipant.findUnique({
          where: { sessionToken },
          include: {
            shareLink: {
              select: { 
                id: true,
                linkId: true,
                isActive: true,
                expiresAt: true
              }
            }
          }
        });

        if (participant && participant.isActive && participant.shareLink.isActive) {
          // Vérifier l'expiration du lien
          if (!participant.shareLink.expiresAt || participant.shareLink.expiresAt > new Date()) {
            console.log(`✅ Session token valide pour participant anonyme: ${participant.id}`);
            
            // Créer l'utilisateur Socket.IO anonyme
            const user: SocketUser = {
              id: participant.id,
              socketId: socket.id,
              isAnonymous: true,
              language: participant.language,
              sessionToken: participant.sessionToken
            };

            // Enregistrer l'utilisateur anonyme
            this.connectedUsers.set(user.id, user);
            this.socketToUser.set(socket.id, user.id);

            // Rejoindre la conversation spécifique du lien de partage
            try {
              const conversationRoom = `conversation_${participant.shareLink.id}`;
              socket.join(conversationRoom);
              console.log(`👥 Participant anonyme ${user.id} rejoint conversation ${conversationRoom}`);
            } catch {}

            console.log(`✅ Participant anonyme authentifié automatiquement: ${user.id}`);
            return; // Authentification anonyme réussie
          } else {
            console.log(`❌ Lien de partage expiré pour participant ${participant.id}`);
          }
        } else {
          console.log(`❌ Participant anonyme non trouvé ou inactif pour session token`);
        }
      }

      // Aucune authentification valide trouvée
      console.log(`⚠️ Aucune authentification valide pour socket ${socket.id}`);
      socket.emit(SERVER_EVENTS.ERROR, { 
        message: 'Authentification requise. Veuillez fournir un Bearer token ou un x-session-token valide.' 
      });

    } catch (error) {
      console.error(`❌ Erreur authentification hybride:`, error);
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Erreur d\'authentification' });
    }
  }

  private async _handleAuthentication(socket: any, data: { userId?: string; sessionToken?: string; language?: string }) {
    try {
      let user: SocketUser | null = null;
      
      if (data.sessionToken) {
        // Tentative d'authentification avec Bearer token (utilisateur authentifié)
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
              systemLanguage: true,
              isActive: true
            }
          });

          if (dbUser && dbUser.isActive) {
            user = {
              id: dbUser.id,
              socketId: socket.id,
              isAnonymous: false,
              language: data.language || dbUser.systemLanguage
            };
            console.log(`✅ Utilisateur authentifié: ${user.id}`);
          } else {
            console.log(`❌ Utilisateur ${decoded.userId} non trouvé ou inactif`);
          }
        } catch (jwtError) {
          console.log(`⚠️ Token JWT invalide, tentative comme sessionToken anonyme`);
          
          // Si ce n'est pas un JWT valide, essayer comme sessionToken anonyme
          const anonymousUser = await this.prisma.anonymousParticipant.findUnique({
            where: { sessionToken: data.sessionToken },
            include: {
              shareLink: {
                select: { 
                  id: true,
                  linkId: true,
                  isActive: true,
                  expiresAt: true
                }
              }
            }
          });
          
          if (anonymousUser && anonymousUser.isActive && anonymousUser.shareLink.isActive) {
            // Vérifier l'expiration du lien
            if (!anonymousUser.shareLink.expiresAt || anonymousUser.shareLink.expiresAt > new Date()) {
              user = {
                id: anonymousUser.id,
                socketId: socket.id,
                isAnonymous: true,
                language: data.language || anonymousUser.language || 'fr'
              };
              console.log(`✅ Participant anonyme authentifié: ${user.id}`);
            } else {
              console.log(`❌ Lien de partage expiré pour participant ${anonymousUser.id}`);
            }
          } else {
            console.log(`❌ Participant anonyme non trouvé ou inactif`);
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

        // Rejoindre la room globale "meeshy"
        try {
          socket.join(`conversation_any`);
          console.log(`👥 Utilisateur ${user.id} rejoint conversation globale "meeshy"`);
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

      // Support pour anonymousSender si présent
      if (saved?.anonymousSenderId) {
        (messagePayload as any).anonymousSenderId = saved.anonymousSenderId;
        // Inclure l'objet anonymousSender complet si disponible
        if ((saved as any).anonymousSender) {
          (messagePayload as any).anonymousSender = {
            id: (saved as any).anonymousSender.id,
            username: (saved as any).anonymousSender.username,
            firstName: (saved as any).anonymousSender.firstName,
            lastName: (saved as any).anonymousSender.lastName,
            language: (saved as any).anonymousSender.language
          };
        }
      }

      this.io.to(`conversation_${data.conversationId}`).emit(SERVER_EVENTS.MESSAGE_NEW, messagePayload);
      // S'assurer que l'auteur reçoit aussi (au cas où il ne serait pas dans la room encore)
      socket.emit(SERVER_EVENTS.MESSAGE_NEW, messagePayload);
      
      console.log(`✅ Message ${result.messageId} sauvegardé et diffusé à la conversation ${data.conversationId}`);
      
      // 4. ENVOYER LES NOTIFICATIONS DE MESSAGE
      const senderId = saved?.senderId || saved?.anonymousSenderId;
      const isAnonymousSender = !!saved?.anonymousSenderId;
      if (senderId) {
        // Envoyer les notifications en asynchrone pour ne pas bloquer
        setImmediate(async () => {
          try {
            await this.messageNotificationService.sendMessageNotification(
              result.messageId,
              data.conversationId,
              senderId,
              isAnonymousSender
            );
          } catch (error) {
            console.error(`❌ Erreur envoi notification message ${result.messageId}:`, error);
          }
        });
      }
      
      // 5. LES TRADUCTIONS SERONT TRAITÉES EN ASYNCHRONE PAR LE TRANSLATION SERVICE
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
      
      // Envoyer les notifications de traduction pour les utilisateurs non connectés
      if (conversationIdForBroadcast) {
        setImmediate(async () => {
          try {
            // Construire les traductions pour les trois langues de base
            const translations: { fr?: string; en?: string; es?: string } = {};
            if (targetLanguage === 'fr') {
              translations.fr = result.translatedText;
            } else if (targetLanguage === 'en') {
              translations.en = result.translatedText;
            } else if (targetLanguage === 'es') {
              translations.es = result.translatedText;
            }
            
            // Envoyer la notification de traduction
            await this.messageNotificationService.sendTranslationNotification(
              result.messageId,
              conversationIdForBroadcast,
              translations
            );
          } catch (error) {
            console.error(`❌ Erreur envoi notification traduction ${result.messageId}:`, error);
          }
        });
      }
      
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

  private async _handleDisconnection(socket: any) {
    const userId = this.socketToUser.get(socket.id);
    
    if (userId) {
      this.connectedUsers.delete(userId);
      this.socketToUser.delete(socket.id);
      
      // Mettre à jour l'état en ligne/hors ligne dans la base de données
      await this.maintenanceService.updateUserOnlineStatus(userId, false);
      
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

  /**
   * PHASE 3.1: Broadcast d'un nouveau message via MessagingService
   * Remplace l'ancienne logique de broadcast dans _handleNewMessage
   */
  private async _broadcastNewMessage(message: Message, conversationId: string): Promise<void> {
    try {
      // Récupérer les stats de conversation mises à jour
      const updatedStats = await conversationStatsService.updateOnNewMessage(
        this.prisma,
        conversationId,
        message.originalLanguage || 'fr',
        () => this.getConnectedUsers()
      );

      // Construire le payload de message pour broadcast - compatible avec les types existants
      const messagePayload = {
        id: message.id,
        conversationId: conversationId,
        senderId: message.senderId || undefined,
        content: message.content,
        originalLanguage: message.originalLanguage || 'fr',
        messageType: message.messageType || 'text',
        isEdited: Boolean(message.isEdited),
        isDeleted: Boolean(message.isDeleted),
        createdAt: message.createdAt || new Date(),
        updatedAt: message.updatedAt || new Date(),
        sender: message.sender ? {
          id: message.sender.id,
          username: message.sender.username,
          firstName: (message.sender as any).firstName || '',
          lastName: (message.sender as any).lastName || '',
          email: (message.sender as any).email || '',
          displayName: (message.sender as any).displayName || message.sender.username,
          avatar: (message.sender as any).avatar,
          role: (message.sender as any).role || 'USER',
          isOnline: false,
          lastSeen: new Date(),
          lastActiveAt: new Date(),
          systemLanguage: (message.sender as any).systemLanguage || 'fr',
          regionalLanguage: (message.sender as any).regionalLanguage || 'fr',
          autoTranslateEnabled: (message.sender as any).autoTranslateEnabled ?? true,
          translateToSystemLanguage: (message.sender as any).translateToSystemLanguage ?? true,
          translateToRegionalLanguage: (message.sender as any).translateToRegionalLanguage ?? false,
          useCustomDestination: (message.sender as any).useCustomDestination ?? false,
          isActive: (message.sender as any).isActive ?? true,
          createdAt: (message.sender as any).createdAt || new Date(),
          updatedAt: (message.sender as any).updatedAt || new Date()
        } : undefined,
        meta: {
          conversationStats: updatedStats
        }
      };

      // Support pour anonymousSender si présent
      if (message.anonymousSenderId) {
        (messagePayload as any).anonymousSenderId = message.anonymousSenderId;
        // Inclure l'objet anonymousSender complet si disponible
        if ((message as any).anonymousSender) {
          (messagePayload as any).anonymousSender = {
            id: (message as any).anonymousSender.id,
            username: (message as any).anonymousSender.username,
            firstName: (message as any).anonymousSender.firstName,
            lastName: (message as any).anonymousSender.lastName,
            language: (message as any).anonymousSender.language
          };
        }
      }

      // Broadcast vers tous les clients de la conversation
      this.io.to(`conversation_${conversationId}`).emit(SERVER_EVENTS.MESSAGE_NEW, messagePayload);
      
      console.log(`✅ [PHASE 3.1] Message ${message.id} broadcasté vers conversation ${conversationId}`);
      
      // Envoyer les notifications de message pour les utilisateurs non connectés à la conversation
      const senderId = message.anonymousSenderId || message.senderId;
      const isAnonymousSender = !!message.anonymousSenderId;
      if (senderId) {
        setImmediate(async () => {
          try {
            await this.messageNotificationService.sendMessageNotification(
              message.id,
              conversationId,
              senderId,
              isAnonymousSender
            );
          } catch (error) {
            console.error(`❌ Erreur envoi notification message ${message.id}:`, error);
          }
        });
      }
      
    } catch (error) {
      console.error('[PHASE 3.1] Erreur broadcast message:', error);
    }
  }

  /**
   * PHASE 3.1.1: Extraction du JWT Token depuis le socket
   */
  private extractJWTToken(socket: any): string | undefined {
    return socket.handshake?.headers?.authorization?.replace('Bearer ', '') || 
           socket.handshake?.auth?.authToken || 
           socket.auth?.token;
  }

  /**
   * PHASE 3.1.1: Extraction du Session Token depuis le socket  
   */
  private extractSessionToken(socket: any): string | undefined {
    return socket.handshake?.headers?.['x-session-token'] || 
           socket.handshake?.auth?.sessionToken || 
           socket.auth?.sessionToken;
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
   * Vérifie si un utilisateur est connecté
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }


  /**
   * Vérifie si un utilisateur est dans une salle de conversation
   */
  isUserInConversationRoom(userId: string, conversationId: string): boolean {
    const user = this.connectedUsers.get(userId);
    if (user) {
      const socket = this.io.sockets.sockets.get(user.socketId);
      if (socket) {
        return socket.rooms.has(`conversation:${conversationId}`);
      }
    }
    return false;
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
