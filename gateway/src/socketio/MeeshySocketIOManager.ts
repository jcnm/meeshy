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
import { CallEventsHandler } from './CallEventsHandler';
import { CallService } from '../services/CallService';
import { AttachmentService } from '../services/AttachmentService';
import { validateMessageLength } from '../config/message-limits';
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
  private callEventsHandler: CallEventsHandler;
  private callService: CallService;

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

    // Créer l'AttachmentService pour le cleanup automatique
    const attachmentService = new AttachmentService(prisma);
    this.maintenanceService = new MaintenanceService(prisma, attachmentService);

    this.messagingService = new MessagingService(prisma, this.translationService);
    this.callEventsHandler = new CallEventsHandler(prisma);
    this.callService = new CallService(prisma);

    // CORRECTION: Configurer le callback de broadcast pour le MaintenanceService
    this.maintenanceService.setStatusBroadcastCallback(
      (userId: string, isOnline: boolean, isAnonymous: boolean) => {
        this._broadcastUserStatus(userId, isOnline, isAnonymous);
      }
    );

    // Initialiser Socket.IO avec les types shared
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      cors: {
        origin: '*',
        methods: ["GET", "POST"],
        allowedHeaders: ['authorization', 'content-type', 'x-session-token', 'websocket', 'polling'],
        credentials: true
      },
      // CORRECTION CRITIQUE: Configuration timeouts pour détecter déconnexions abruptes
      pingTimeout: 10000,  // 10s - Temps d'attente pour le pong avant de considérer la connexion morte
      pingInterval: 25000, // 25s - Intervalle entre les pings (par défaut)
      connectTimeout: 45000, // 45s - Timeout pour la connexion initiale
      // Autoriser reconnexion rapide
      allowEIO3: true
    });

    console.log('[GATEWAY] 🚀 MeeshySocketIOManager initialisé avec MessagingService et CallEventsHandler');
  }

  /**
   * Normalise l'identifiant de conversation pour créer une room cohérente
   * Résout identifier/ObjectId vers l'identifier canonique
   */
  private async normalizeConversationId(conversationId: string): Promise<string> {
    try {
      // Si c'est un ObjectId MongoDB (24 caractères hex)
      if (/^[0-9a-fA-F]{24}$/.test(conversationId)) {
        // C'est déjà un ObjectId, le retourner directement
        console.log(`🔄 [NORMALIZE] ObjectId ${conversationId} → ${conversationId} (invariant)`);
        return conversationId;
      }
      
      // C'est un identifier, chercher l'ObjectId correspondant
      const conversation = await this.prisma.conversation.findUnique({
        where: { identifier: conversationId },
        select: { id: true, identifier: true }
      });
      
      if (conversation) {
        console.log(`🔄 [NORMALIZE] Identifier ${conversationId} → ObjectId ${conversation.id}`);
        return conversation.id; // Retourner l'ObjectId
      }
      
      // Si non trouvé, retourner tel quel (peut-être un ObjectId invalide ou identifier inconnu)
      console.log(`⚠️ [NORMALIZE] Conversation non trouvée pour: ${conversationId}, retour tel quel`);
      return conversationId;
    } catch (error) {
      console.error('❌ [NORMALIZE] Erreur normalisation:', error);
      // En cas d'erreur, retourner l'identifiant original
      return conversationId;
    }
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
          console.log(`📨 [MESSAGE_SEND] Réception message de socket ${socket.id}`);
          console.log(`  ├─ Conversation: ${data.conversationId}`);
          console.log(`  ├─ Content length: ${data.content?.length || 0}`);
          console.log(`  └─ Socket mappings: socketToUser has ${this.socketToUser.size} entries`);

          const userId = this.socketToUser.get(socket.id);
          console.log(`  └─ UserId trouvé: ${userId || 'NULL'}`);

          if (!userId) {
            console.error(`❌ [MESSAGE_SEND] Socket ${socket.id} non authentifié`);
            console.error(`  └─ Sockets connectés:`, Array.from(this.socketToUser.keys()).slice(0, 5));

            const errorResponse: SocketIOResponse<{ messageId: string }> = {
              success: false,
              error: 'User not authenticated'
            };

            if (callback) callback(errorResponse);
            socket.emit('error', { message: 'User not authenticated' });
            return;
          }

          console.log(`✓ [MESSAGE_SEND] UserId ${userId} authentifié pour socket ${socket.id}`);

          // Validation de la longueur du message
          const validation = validateMessageLength(data.content);
          if (!validation.isValid) {
            const errorResponse: SocketIOResponse<{ messageId: string }> = {
              success: false,
              error: validation.error || 'Message invalide'
            };
            
            if (callback) callback(errorResponse);
            socket.emit('error', { message: validation.error || 'Message invalide' });
            console.warn(`⚠️ [WEBSOCKET] Message rejeté pour ${userId}: ${validation.error}`);
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
          if (response.success && response.data?.id) {
            // Récupérer le message depuis la base de données pour le broadcast
            const message = await this.prisma.message.findUnique({
              where: { id: response.data.id },
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    firstName: true,
                    lastName: true
                  }
                },
                anonymousSender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true
                  }
                },
                attachments: true,
                replyTo: {
                  include: {
                    sender: {
                      select: {
                        id: true,
                        username: true,
                        displayName: true,
                        firstName: true,
                        lastName: true
                      }
                    },
                    anonymousSender: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true
                      }
                    }
                  }
                }
              }
            });

            if (message) {
              // Ajouter le champ timestamp requis par le type Message
              const messageWithTimestamp = {
                ...message,
                timestamp: message.createdAt
              } as any; // Cast temporaire pour éviter les conflits de types
              // FIX: Utiliser message.conversationId (déjà normalisé en base) au lieu de data.conversationId (peut être un identifier)
              await this._broadcastNewMessage(messageWithTimestamp, message.conversationId, socket);
            }
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
      
      // Envoi de message avec attachments
      socket.on(CLIENT_EVENTS.MESSAGE_SEND_WITH_ATTACHMENTS, async (data: {
        conversationId: string;
        content: string;
        originalLanguage?: string;
        attachmentIds: string[];
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

          // Validation de la longueur du message (si du contenu texte est présent)
          if (data.content && data.content.trim()) {
            const validation = validateMessageLength(data.content);
            if (!validation.isValid) {
              const errorResponse: SocketIOResponse<{ messageId: string }> = {
                success: false,
                error: validation.error || 'Message invalide'
              };
              
              if (callback) callback(errorResponse);
              socket.emit('error', { message: validation.error || 'Message invalide' });
              console.warn(`⚠️ [WEBSOCKET] Message avec attachments rejeté pour ${userId}: ${validation.error}`);
              return;
            }
          }

          // Vérifier que les attachments existent et appartiennent à l'utilisateur
          const attachmentService = new (await import('../services/AttachmentService')).AttachmentService(this.prisma);
          
          for (const attachmentId of data.attachmentIds) {
            const attachment = await attachmentService.getAttachment(attachmentId);
            if (!attachment) {
              const errorResponse: SocketIOResponse<{ messageId: string }> = {
                success: false,
                error: `Attachment ${attachmentId} not found`
              };
              if (callback) callback(errorResponse);
              return;
            }
            
            // Vérifier que l'attachment appartient à l'utilisateur
            if (attachment.uploadedBy !== userId) {
              const errorResponse: SocketIOResponse<{ messageId: string }> = {
                success: false,
                error: `Attachment ${attachmentId} does not belong to user`
              };
              if (callback) callback(errorResponse);
              return;
            }
          }

          // Récupérer les informations de l'utilisateur pour déterminer s'il est anonyme
          const user = this.connectedUsers.get(userId);
          const isAnonymous = user?.isAnonymous || false;

          let anonymousDisplayName: string | undefined;
          if (isAnonymous) {
            try {
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

          // Créer le message via MessagingService
          const messageRequest: MessageRequest = {
            conversationId: data.conversationId,
            content: data.content,
            originalLanguage: data.originalLanguage,
            messageType: 'text', // Peut être déduit des attachments
            replyToId: data.replyToId,
            isAnonymous: isAnonymous,
            anonymousDisplayName: anonymousDisplayName,
            // IMPORTANT: Inclure les attachmentIds pour la validation
            attachments: data.attachmentIds.map(id => ({ id } as any)),
            metadata: {
              source: 'websocket',
              socketId: socket.id,
              clientTimestamp: Date.now()
            }
          };

          console.log(`📎 [WEBSOCKET] Nouveau message avec ${data.attachmentIds.length} attachments de ${userId} dans ${data.conversationId}`);

          const jwtToken = this.extractJWTToken(socket);
          const sessionToken = this.extractSessionToken(socket);

          const response: MessageResponse = await this.messagingService.handleMessage(
            messageRequest, 
            userId, 
            true,
            jwtToken,
            sessionToken
          );

          // Associer les attachments au message
          if (response.success && response.data?.id) {
            await attachmentService.associateAttachmentsToMessage(data.attachmentIds, response.data.id);
          }

          // Réponse via callback
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
          if (response.success && response.data?.id) {
            // Récupérer le message depuis la base de données avec les attachments ET replyTo
            const message = await this.prisma.message.findUnique({
              where: { id: response.data.id },
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    firstName: true,
                    lastName: true
                  }
                },
                anonymousSender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true
                  }
                },
                attachments: true,
                replyTo: {
                  include: {
                    sender: {
                      select: {
                        id: true,
                        username: true,
                        displayName: true,
                        firstName: true,
                        lastName: true
                      }
                    },
                    anonymousSender: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true
                      }
                    }
                  }
                }
              }
            });
            
            if (message) {
              console.log(`📤 [BROADCAST] Envoi message avec ${message.attachments?.length || 0} attachments et replyTo:`, {
                hasReplyTo: !!(message as any).replyTo,
                replyToId: message.replyToId
              });

              // Utiliser la méthode _broadcastNewMessage pour un formatting cohérent
              const messageWithTimestamp = {
                ...message,
                timestamp: message.createdAt
              } as any;
              // FIX: Utiliser message.conversationId (déjà normalisé en base) au lieu de data.conversationId (peut être un identifier)
              await this._broadcastNewMessage(messageWithTimestamp, message.conversationId, socket);
            }
          }
        } catch (error: any) {
          console.error('❌ [WEBSOCKET] Erreur envoi message avec attachments:', error);
          
          if (callback) {
            const errorResponse: SocketIOResponse<{ messageId: string }> = {
              success: false,
              error: 'Failed to send message with attachments'
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
      socket.on(CLIENT_EVENTS.CONVERSATION_JOIN, async (data: { conversationId: string }) => {
        const normalizedId = await this.normalizeConversationId(data.conversationId);
        const room = `conversation_${normalizedId}`;
        socket.join(room);
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
          socket.emit(SERVER_EVENTS.CONVERSATION_JOINED, { 
            conversationId: normalizedId,
            userId 
          });
          // Pré-charger/rafraîchir les stats - utiliser l'ID original pour Prisma
          this._sendConversationStatsToSocket(socket, data.conversationId).catch(() => {});
        }
        console.log(`👥 Socket ${socket.id} rejoint ${room} (original: ${data.conversationId} → normalized: ${normalizedId})`);
      });

      // Gestion des rooms conversation: leave
      socket.on(CLIENT_EVENTS.CONVERSATION_LEAVE, async (data: { conversationId: string }) => {
        const normalizedId = await this.normalizeConversationId(data.conversationId);
        const room = `conversation_${normalizedId}`;
        socket.leave(room);
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
          socket.emit(SERVER_EVENTS.CONVERSATION_LEFT, { 
            conversationId: normalizedId,
            userId 
          });
        }
        console.log(`👥 Socket ${socket.id} quitte ${room} (original: ${data.conversationId})`);
      });

      // Setup video/audio call events (Phase 1A: P2P MVP)
      // CVE-004: Pass getUserInfo to provide isAnonymous flag
      this.callEventsHandler.setupCallEvents(
        socket,
        this.io,
        (socketId: string) => this.socketToUser.get(socketId),
        (socketId: string) => {
          const userId = this.socketToUser.get(socketId);
          if (!userId) return undefined;
          const user = this.connectedUsers.get(userId);
          if (!user) return undefined;
          return { id: user.id, isAnonymous: user.isAnonymous };
        }
      );

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

      // ===== ÉVÉNEMENTS DE RÉACTIONS =====
      
      // Ajouter une réaction
      socket.on(CLIENT_EVENTS.REACTION_ADD, async (data: {
        messageId: string;
        emoji: string;
      }, callback?: (response: SocketIOResponse<any>) => void) => {
        await this._handleReactionAdd(socket, data, callback);
      });

      // Retirer une réaction
      socket.on(CLIENT_EVENTS.REACTION_REMOVE, async (data: {
        messageId: string;
        emoji: string;
      }, callback?: (response: SocketIOResponse<any>) => void) => {
        await this._handleReactionRemove(socket, data, callback);
      });

      // Demander la synchronisation des réactions d'un message
      socket.on(CLIENT_EVENTS.REACTION_REQUEST_SYNC, async (messageId: string, callback?: (response: SocketIOResponse<any>) => void) => {
        await this._handleReactionSync(socket, messageId, callback);
      });
    });
  }

  private async _handleTokenAuthentication(socket: any): Promise<void> {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🔐 DÉBUT AUTHENTIFICATION SOCKET                             ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`  🆔 Socket ID: ${socket.id}`);
    console.log(`  ⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('');
    
    try {
      // Debug complet de socket.handshake
      console.log('  📋 DONNÉES HANDSHAKE:');
      console.log('  ├─ Has Handshake:', !!socket.handshake);
      console.log('  ├─ Available Headers:', Object.keys(socket.handshake?.headers || {}));
      console.log('  ├─ Auth Object:', socket.handshake?.auth);
      console.log('  ├─ Query Params:', socket.handshake?.query);
      console.log('  └─ Client Address:', socket.handshake?.address);
      console.log('');

      // Récupérer les tokens depuis différentes sources avec types précis
      const authToken = socket.handshake?.headers?.authorization?.replace('Bearer ', '') || 
                       socket.handshake?.auth?.authToken ||
                       socket.handshake?.auth?.token; // Support pour socket.handshake.auth.token
      const sessionToken = socket.handshake?.headers?.['x-session-token'] as string || 
                          socket.handshake?.auth?.sessionToken;
      
      // Récupérer les types de tokens pour validation précise
      const tokenType = socket.handshake?.auth?.tokenType;
      const sessionType = socket.handshake?.auth?.sessionType;
      
      console.log('  🔑 EXTRACTION DES TOKENS:');
      console.log('  ├─ JWT Token:', {
        found: !!authToken,
        type: tokenType || 'unknown',
        length: authToken?.length || 0,
        preview: authToken ? authToken.substring(0, 30) + '...' : 'N/A',
        source: authToken ? (socket.handshake?.headers?.authorization ? 'header' : 'auth') : 'none'
      });
      console.log('  └─ Session Token:', {
        found: !!sessionToken,
        type: sessionType || 'unknown',
        length: sessionToken?.length || 0,
        preview: sessionToken ? sessionToken.substring(0, 30) + '...' : 'N/A',
        source: sessionToken ? (socket.handshake?.headers?.['x-session-token'] ? 'header' : 'auth') : 'none'
      });
      console.log('');

      // Tentative d'authentification avec Bearer token (utilisateur authentifié)
      if (authToken && (!tokenType || tokenType === 'jwt')) {
        console.log('  🔐 TENTATIVE AUTHENTIFICATION JWT...');
        try {
          const jwtSecret = process.env.JWT_SECRET || 'default-secret';
          const decoded = jwt.verify(authToken, jwtSecret) as any;
          
          console.log('  ✓ Token JWT vérifié avec succès');
          console.log('    ├─ User ID:', decoded.userId);
          console.log('    └─ Token Type:', tokenType || 'jwt');

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
            console.log('  ✓ Utilisateur trouvé en base de données');
            console.log('    ├─ Username:', dbUser.username);
            console.log('    ├─ Language:', dbUser.systemLanguage);
            console.log('    └─ Active:', dbUser.isActive);
            
            // Créer l'utilisateur Socket.IO
            const user: SocketUser = {
              id: dbUser.id,
              socketId: socket.id,
              isAnonymous: false,
              language: dbUser.systemLanguage
            };

            // CORRECTION CRITIQUE: Gérer les connexions multiples (même utilisateur, plusieurs onglets)
            const existingUser = this.connectedUsers.get(user.id);
            if (existingUser && existingUser.socketId !== socket.id) {
              // Déconnecter l'ancienne socket
              const oldSocket = this.io.sockets.sockets.get(existingUser.socketId);
              if (oldSocket) {
                console.log(`  🔄 Déconnexion ancienne socket ${existingUser.socketId}`);
                oldSocket.disconnect(true);
              }
              this.socketToUser.delete(existingUser.socketId);
            }

            // Enregistrer l'utilisateur
            this.connectedUsers.set(user.id, user);
            this.socketToUser.set(socket.id, user.id);

            // Mettre à jour l'état en ligne dans la base de données et broadcaster
            await this.maintenanceService.updateUserOnlineStatus(user.id, true, true);

            // Rejoindre les conversations de l'utilisateur
            await this._joinUserConversations(socket, user.id, false);

            // Rejoindre la room globale si elle existe (conversation "meeshy")
            try {
              socket.join(`conversation_any`);
              console.log(`  👥 Rejoint conversation globale "meeshy"`);
            } catch {}

            // CORRECTION CRITIQUE: Émettre l'événement AUTHENTICATED IMMÉDIATEMENT
            console.log('');
            console.log('  📤 ÉMISSION ÉVÉNEMENT AUTHENTICATED...');
            const authResponse = { 
              success: true, 
              user: { id: user.id, language: user.language, isAnonymous: false } 
            };
            console.log('    ├─ Event:', SERVER_EVENTS.AUTHENTICATED);
            console.log('    ├─ Success:', authResponse.success);
            console.log('    └─ User:', authResponse.user);
            
            socket.emit(SERVER_EVENTS.AUTHENTICATED, authResponse);
            
            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║  ✅ AUTHENTIFICATION JWT RÉUSSIE                              ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log(`  👤 User: ${dbUser.username} (${user.id})`);
            console.log(`  🔌 Socket: ${socket.id}`);
            console.log(`  ⏰ Timestamp: ${new Date().toISOString()}`);
            console.log('');
            
            return; // Authentification réussie
          } else {
            console.log('  ❌ Utilisateur non trouvé ou inactif');
            console.log('    └─ User ID:', decoded.userId);
          }
        } catch (jwtError: any) {
          console.log('  ❌ Erreur vérification JWT');
          console.log('    ├─ Error:', jwtError.message);
          console.log('    └─ Tentative avec session token...');
        }
      }

      // Tentative d'authentification avec session token (participant anonyme)
      if (sessionToken && (!sessionType || sessionType === 'anonymous')) {
        console.log('  🔐 TENTATIVE AUTHENTIFICATION SESSION TOKEN...');
        console.log('    └─ Type:', sessionType || 'anonymous');
        
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
            console.log('  ✓ Session token valide');
            console.log('    ├─ Participant ID:', participant.id);
            console.log('    ├─ Link ID:', participant.shareLink.linkId);
            console.log('    └─ Language:', participant.language);
            
            // Créer l'utilisateur Socket.IO anonyme
            const user: SocketUser = {
              id: participant.id,
              socketId: socket.id,
              isAnonymous: true,
              language: participant.language,
              sessionToken: participant.sessionToken
            };

            // CORRECTION CRITIQUE: Gérer les connexions multiples (même anonyme, plusieurs onglets)
            const existingUser = this.connectedUsers.get(user.id);
            if (existingUser && existingUser.socketId !== socket.id) {
              const oldSocket = this.io.sockets.sockets.get(existingUser.socketId);
              if (oldSocket) {
                console.log(`  🔄 Déconnexion ancienne socket ${existingUser.socketId}`);
                oldSocket.disconnect(true);
              }
              this.socketToUser.delete(existingUser.socketId);
            }

            // Enregistrer l'utilisateur anonyme
            // CORRECTION: Stocker le sessionToken au lieu de user.id pour les anonymes
            // Cela permet au MessagingService de détecter correctement le type d'authentification
            this.connectedUsers.set(user.id, user);
            this.socketToUser.set(socket.id, participant.sessionToken); // Utiliser sessionToken au lieu de user.id

            // CORRECTION: Mettre à jour l'état en ligne dans la base de données pour les anonymes et broadcaster
            await this.maintenanceService.updateAnonymousOnlineStatus(user.id, true, true);

            // Rejoindre la conversation spécifique du lien de partage
            try {
              const conversationRoom = `conversation_${participant.shareLink.id}`;
              socket.join(conversationRoom);
              console.log(`  👥 Rejoint conversation ${conversationRoom}`);
            } catch {}

            // CORRECTION CRITIQUE: Émettre l'événement AUTHENTICATED IMMÉDIATEMENT
            console.log('');
            console.log('  📤 ÉMISSION ÉVÉNEMENT AUTHENTICATED...');
            const authResponse = { 
              success: true, 
              user: { id: user.id, language: user.language, isAnonymous: true } 
            };
            console.log('    ├─ Event:', SERVER_EVENTS.AUTHENTICATED);
            console.log('    ├─ Success:', authResponse.success);
            console.log('    └─ User:', authResponse.user);
            
            socket.emit(SERVER_EVENTS.AUTHENTICATED, authResponse);
            
            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║  ✅ AUTHENTIFICATION ANONYME RÉUSSIE                          ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log(`  👤 Participant: ${user.id}`);
            console.log(`  🔌 Socket: ${socket.id}`);
            console.log(`  ⏰ Timestamp: ${new Date().toISOString()}`);
            console.log('');
            
            return; // Authentification anonyme réussie
          } else {
            console.log('  ❌ Lien de partage expiré');
            console.log('    ├─ Participant ID:', participant.id);
            console.log('    └─ Expired at:', participant.shareLink.expiresAt);
          }
        } else {
          console.log('  ❌ Participant anonyme non trouvé ou inactif');
        }
      }

      // Aucune authentification valide trouvée
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  ❌ ÉCHEC AUTHENTIFICATION                                     ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log(`  🔌 Socket: ${socket.id}`);
      console.log('  ⚠️ Aucun token valide trouvé');
      console.log('  📤 Émission AUTHENTICATED avec success: false');
      console.log('');
      
      // CORRECTION CRITIQUE: Émettre l'événement AUTHENTICATED avec échec
      const failureResponse = { 
        success: false,
        error: 'Authentification requise. Veuillez fournir un Bearer token ou un x-session-token valide.'
      };
      
      socket.emit(SERVER_EVENTS.AUTHENTICATED, failureResponse);
      socket.emit(SERVER_EVENTS.ERROR, { 
        message: failureResponse.error
      });

    } catch (error: any) {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  ❌ ERREUR DURANT AUTHENTIFICATION                            ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log(`  🔌 Socket: ${socket.id}`);
      console.log('  ⚠️ Error:', error.message);
      console.log('  📤 Émission AUTHENTICATED avec success: false');
      console.log('');
      
      // CORRECTION CRITIQUE: Émettre l'événement AUTHENTICATED avec erreur
      socket.emit(SERVER_EVENTS.AUTHENTICATED, { 
        success: false,
        error: 'Erreur d\'authentification'
      });
      
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
                language: data.language || anonymousUser.language || 'fr',
                sessionToken: anonymousUser.sessionToken
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
        // CORRECTION CRITIQUE: Gérer les connexions multiples
        const existingUser = this.connectedUsers.get(user.id);
        if (existingUser && existingUser.socketId !== socket.id) {
          // Déconnecter l'ancienne socket
          const oldSocket = this.io.sockets.sockets.get(existingUser.socketId);
          if (oldSocket) {
            console.log(`🔄 Déconnexion de l'ancienne socket ${existingUser.socketId} pour ${user.isAnonymous ? 'anonyme' : 'utilisateur'} ${user.id}`);
            oldSocket.disconnect(true);
          }
          this.socketToUser.delete(existingUser.socketId);
        }

        // Enregistrer l'utilisateur
        // CORRECTION: Pour les anonymes, stocker le sessionToken au lieu de user.id
        this.connectedUsers.set(user.id, user);
        this.socketToUser.set(socket.id, user.isAnonymous ? user.sessionToken! : user.id);
        
        // CORRECTION: Mettre à jour l'état en ligne selon le type d'utilisateur et broadcaster
        if (user.isAnonymous) {
          await this.maintenanceService.updateAnonymousOnlineStatus(user.id, true, true);
        } else {
          await this.maintenanceService.updateUserOnlineStatus(user.id, true, true);
        }
        
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
      console.log(`📊 [JOIN_CONVERSATIONS] Début pour userId: ${userId} (anonyme: ${isAnonymous})`);

      let conversations: any[] = [];

      if (isAnonymous) {
        // Conversations pour participants anonymes
        conversations = await this.prisma.anonymousParticipant.findMany({
          where: { id: userId },
          select: { conversationId: true }
        });
        console.log(`📊 [JOIN_CONVERSATIONS] Trouvé ${conversations.length} conversations pour utilisateur anonyme ${userId}`);
      } else {
        // Conversations pour utilisateurs authentifiés
        conversations = await this.prisma.conversationMember.findMany({
          where: { userId: userId, isActive: true },
          select: { conversationId: true }
        });
        console.log(`📊 [JOIN_CONVERSATIONS] Trouvé ${conversations.length} conversations pour utilisateur ${userId}`);
      }

      // Rejoindre les rooms Socket.IO
      for (const conv of conversations) {
        socket.join(`conversation_${conv.conversationId}`);
        console.log(`👥 [JOIN_CONVERSATIONS] Utilisateur ${userId} rejoint conversation_${conv.conversationId}`);
      }

      console.log(`✅ [JOIN_CONVERSATIONS] Terminé - ${conversations.length} rooms rejointes pour ${userId}`);

    } catch (error) {
      console.error(`❌ [JOIN_CONVERSATIONS] Erreur jointure conversations pour ${userId}:`, error);
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
        // Note: Les notifications sont gérées directement dans routes/notifications.ts
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

  private async _handleTranslationReady(data: { taskId: string; result: any; targetLanguage: string; translationId?: string; id?: string }) {
    try {
      const { result, targetLanguage } = data;
      
      console.log(`📤 [SocketIOManager] Envoi traduction aux clients: ${result.messageId} -> ${targetLanguage}`);
      console.log(`🔍 [SocketIOManager] Données de traduction:`, {
        messageId: result.messageId,
        translatedText: result.translatedText?.substring(0, 50) + '...',
        targetLanguage,
        confidenceScore: result.confidenceScore
      });
      
      // Récupérer la conversation du message pour broadcast
      let conversationIdForBroadcast: string | null = null;
      try {
        const msg = await this.prisma.message.findUnique({
          where: { id: result.messageId },
          select: { conversationId: true }
        });
        conversationIdForBroadcast = msg?.conversationId || null;
      } catch (error) {
        console.error(`❌ [SocketIOManager] Erreur récupération conversation:`, error);
      }
      
      // Préparer les données de traduction au format correct pour le frontend
      // FORMAT: TranslationEvent avec un tableau de traductions
      const translationData: TranslationEvent = {
        messageId: result.messageId,
        translations: [{
          id: data.translationId || data.id || `${result.messageId}_${targetLanguage}_${Date.now()}`,
          messageId: result.messageId,
          sourceLanguage: result.sourceLanguage || 'auto',
          targetLanguage: targetLanguage,
          translatedContent: result.translatedText,
          translationModel: result.translationModel || result.modelType || 'medium',
          cacheKey: `${result.messageId}_${result.sourceLanguage || 'auto'}_${targetLanguage}`,
          cached: false,
          confidenceScore: result.confidenceScore || 0.85,
          createdAt: new Date()
        }]
      };
      
      console.log(`🔍 [SocketIOManager] Format de traduction préparé:`, {
        messageId: translationData.messageId,
        translationsCount: translationData.translations.length,
        targetLanguage: translationData.translations[0].targetLanguage,
        translatedTextPreview: translationData.translations[0].translatedContent.substring(0, 50) + '...'
      });
      
      // Diffuser dans la room de conversation (méthode principale et UNIQUE)
      if (conversationIdForBroadcast) {
        // Normaliser l'ID de conversation
        const normalizedId = await this.normalizeConversationId(conversationIdForBroadcast);
        const roomName = `conversation_${normalizedId}`;
        const roomClients = this.io.sockets.adapter.rooms.get(roomName);
        const clientCount = roomClients ? roomClients.size : 0;
        
        console.log(`📡 [SocketIOManager] Broadcasting traduction vers room ${roomName} (${clientCount} clients) - original: ${conversationIdForBroadcast}`);
        console.log(`🔍 [SocketIOManager] Détails de la diffusion WebSocket:`, {
          roomName,
          clientCount,
          eventType: SERVER_EVENTS.MESSAGE_TRANSLATION,
          messageId: result.messageId,
          targetLanguage,
          translatedTextLength: result.translatedText?.length || 0,
          modelType: result.translationModel || result.modelType,
          hasTranslationData: !!translationData,
          translationsArrayLength: translationData.translations.length
        });
        
        // Log des clients dans la room pour debug
        if (clientCount > 0 && roomClients) {
          const clientSocketIds = Array.from(roomClients);
          console.log(`👥 [SocketIOManager] Clients dans la room ${roomName}:`, clientSocketIds.map(sid => {
            const user = this.socketToUser.get(sid);
            return user ? `${user} (${sid.substr(0, 8)})` : `unknown (${sid.substr(0, 8)})`;
          }));
        }
        
        this.io.to(roomName).emit(SERVER_EVENTS.MESSAGE_TRANSLATION, translationData);
        this.stats.translations_sent += clientCount;
        
        console.log(`✅ [SocketIOManager] Traduction ${result.messageId} -> ${targetLanguage} diffusée vers ${clientCount} clients dans la room`);
      } else {
        console.warn(`⚠️ [SocketIOManager] Aucune conversation trouvée pour le message ${result.messageId}`);
        
        // Fallback UNIQUEMENT si pas de room: Envoi direct aux utilisateurs connectés pour cette langue
        const targetUsers = this._findUsersForLanguage(targetLanguage);
        let directSendCount = 0;
        
        for (const user of targetUsers) {
          const userSocket = this.io.sockets.sockets.get(user.socketId);
          if (userSocket) {
            userSocket.emit(SERVER_EVENTS.MESSAGE_TRANSLATION, translationData);
            directSendCount++;
          }
        }
        
        if (directSendCount > 0) {
          console.log(`📡 [SocketIOManager] Fallback: Traduction envoyée directement à ${directSendCount} utilisateurs (pas de room)`);
        }
      }
      
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
            
            // Note: Les notifications de traduction sont gérées directement dans routes/notifications.ts
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
      const user = this.connectedUsers.get(userId);
      const isAnonymous = user?.isAnonymous || false;

      // CORRECTION CRITIQUE: Ne supprimer que si c'est bien la socket active actuelle
      // (en cas de reconnexion rapide, une nouvelle socket peut avoir été créée)
      const currentUser = this.connectedUsers.get(userId);
      if (currentUser && currentUser.socketId === socket.id) {
        // IMPORTANT: Automatically leave any active video/audio calls
        try {
          const activeParticipations = await this.prisma.callParticipant.findMany({
            where: {
              userId,
              leftAt: null // Still in call
            },
            include: {
              callSession: true
            }
          });

          if (activeParticipations.length > 0) {
            console.log(`📞 User ${userId} disconnected while in ${activeParticipations.length} active call(s). Auto-leaving...`);

            for (const participation of activeParticipations) {
              try {
                // Use CallService to properly leave the call
                await this.callService.leaveCall({
                  callId: participation.callSessionId,
                  userId
                });
                console.log(`✅ User ${userId} auto-left call ${participation.callSessionId}`);
              } catch (error) {
                console.error(`❌ Error auto-leaving call ${participation.callSessionId}:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error checking/leaving active calls for user ${userId}:`, error);
        }

        this.connectedUsers.delete(userId);
        this.socketToUser.delete(socket.id);

        // CORRECTION: Mettre à jour l'état en ligne/hors ligne selon le type d'utilisateur et broadcaster
        if (isAnonymous) {
          await this.maintenanceService.updateAnonymousOnlineStatus(userId, false, true);
          console.log(`🔌 Déconnexion participant anonyme: ${userId} (socket: ${socket.id})`);
        } else {
          await this.maintenanceService.updateUserOnlineStatus(userId, false, true);
          console.log(`🔌 Déconnexion utilisateur: ${userId} (socket: ${socket.id})`);
        }
      } else {
        // Cette socket était déjà remplacée, juste nettoyer socketToUser
        this.socketToUser.delete(socket.id);
        console.log(`🔌 Déconnexion socket obsolète ignorée: ${socket.id} pour utilisateur ${userId}`);
      }
    }

    this.stats.active_connections--;
  }

  /**
   * CORRECTION: Broadcaster le changement de statut d'un utilisateur à tous les clients
   */
  private async _broadcastUserStatus(userId: string, isOnline: boolean, isAnonymous: boolean): Promise<void> {
    try {
      // Récupérer les informations de l'utilisateur pour le broadcast
      if (isAnonymous) {
        const participant = await this.prisma.anonymousParticipant.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            conversationId: true
          }
        });

        if (participant) {
          const displayName = `${participant.firstName} ${participant.lastName}`.trim() || participant.username;
          
          // Broadcaster uniquement dans la conversation du participant anonyme
          this.io.to(`conversation_${participant.conversationId}`).emit(SERVER_EVENTS.USER_STATUS, {
            userId: participant.id,
            username: displayName,
            isOnline
          });
          
          console.log(`📡 [STATUS] Statut participant anonyme ${displayName} broadcasté: ${isOnline ? 'en ligne' : 'hors ligne'}`);
        }
      } else {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            displayName: true,
            firstName: true,
            lastName: true,
            conversations: {
              select: {
                conversationId: true
              }
            }
          }
        });

        if (user) {
          const displayName = user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.username;
          
          // Broadcaster dans toutes les conversations de l'utilisateur
          for (const conv of user.conversations) {
            this.io.to(`conversation_${conv.conversationId}`).emit(SERVER_EVENTS.USER_STATUS, {
              userId: user.id,
              username: displayName,
              isOnline
            });
          }
          
          console.log(`📡 [STATUS] Statut utilisateur ${displayName} broadcasté dans ${user.conversations.length} conversations: ${isOnline ? 'en ligne' : 'hors ligne'}`);
        }
      }
    } catch (error) {
      console.error('❌ [STATUS] Erreur lors du broadcast du statut:', error);
    }
  }

  private async _handleTypingStart(socket: any, data: { conversationId: string }) {
    const userId = this.socketToUser.get(socket.id);
    if (!userId) {
      console.warn('⚠️ [TYPING] Typing start sans userId pour socket', socket.id);
      return;
    }

    try {
      // Normaliser l'ID de conversation
      const normalizedId = await this.normalizeConversationId(data.conversationId);

      // Récupérer l'utilisateur depuis connectedUsers (contient déjà isAnonymous)
      const connectedUser = this.connectedUsers.get(userId);
      if (!connectedUser) {
        console.warn('⚠️ [TYPING] Utilisateur non connecté:', userId);
        return;
      }

      let displayName: string;

      // FIXED: Gérer les utilisateurs anonymes
      if (connectedUser.isAnonymous) {
        // Récupérer depuis AnonymousParticipant
        const dbAnonymousUser = await (this.prisma as any).anonymousParticipant.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        });

        if (!dbAnonymousUser) {
          console.warn('⚠️ [TYPING] Utilisateur anonyme non trouvé:', userId);
          return;
        }

        // Construire le nom d'affichage pour anonyme
        displayName = `${dbAnonymousUser.firstName || ''} ${dbAnonymousUser.lastName || ''}`.trim() ||
                      dbAnonymousUser.username;
      } else {
        // Récupérer depuis User
        const dbUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            displayName: true
          }
        });

        if (!dbUser) {
          console.warn('⚠️ [TYPING] Utilisateur non trouvé:', userId);
          return;
        }

        // Construire le nom d'affichage
        displayName = dbUser.displayName ||
                     `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() ||
                     dbUser.username;
      }

      const typingEvent: TypingEvent = {
        userId: userId,
        username: displayName,
        conversationId: normalizedId,
        isTyping: true
      };

      const room = `conversation_${normalizedId}`;

      console.log(`⌨️ [TYPING] ${displayName} ${connectedUser.isAnonymous ? '(anonyme)' : ''} commence à taper dans ${room} (original: ${data.conversationId})`);

      // Émettre vers tous les autres utilisateurs de la conversation (sauf l'émetteur)
      socket.to(room).emit(SERVER_EVENTS.TYPING_START, typingEvent);

    } catch (error) {
      console.error('❌ [TYPING] Erreur handleTypingStart:', error);
    }
  }

  private async _handleTypingStop(socket: any, data: { conversationId: string }) {
    const userId = this.socketToUser.get(socket.id);
    if (!userId) {
      console.warn('⚠️ [TYPING] Typing stop sans userId pour socket', socket.id);
      return;
    }

    try {
      // Normaliser l'ID de conversation
      const normalizedId = await this.normalizeConversationId(data.conversationId);

      // Récupérer l'utilisateur depuis connectedUsers (contient déjà isAnonymous)
      const connectedUser = this.connectedUsers.get(userId);
      if (!connectedUser) {
        console.warn('⚠️ [TYPING] Utilisateur non connecté:', userId);
        return;
      }

      let displayName: string;

      // FIXED: Gérer les utilisateurs anonymes
      if (connectedUser.isAnonymous) {
        // Récupérer depuis AnonymousParticipant
        const dbAnonymousUser = await (this.prisma as any).anonymousParticipant.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        });

        if (!dbAnonymousUser) {
          console.warn('⚠️ [TYPING] Utilisateur anonyme non trouvé:', userId);
          return;
        }

        // Construire le nom d'affichage pour anonyme
        displayName = `${dbAnonymousUser.firstName || ''} ${dbAnonymousUser.lastName || ''}`.trim() ||
                      dbAnonymousUser.username;
      } else {
        // Récupérer depuis User
        const dbUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            displayName: true
          }
        });

        if (!dbUser) {
          console.warn('⚠️ [TYPING] Utilisateur non trouvé:', userId);
          return;
        }

        // Construire le nom d'affichage
        displayName = dbUser.displayName ||
                     `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() ||
                     dbUser.username;
      }

      const typingEvent: TypingEvent = {
        userId: userId,
        username: displayName,
        conversationId: normalizedId,
        isTyping: false
      };

      const room = `conversation_${normalizedId}`;

      console.log(`⌨️ [TYPING] ${displayName} ${connectedUser.isAnonymous ? '(anonyme)' : ''} arrête de taper dans ${room} (original: ${data.conversationId})`);

      // Émettre vers tous les autres utilisateurs de la conversation (sauf l'émetteur)
      socket.to(room).emit(SERVER_EVENTS.TYPING_STOP, typingEvent);

    } catch (error) {
      console.error('❌ [TYPING] Erreur handleTypingStop:', error);
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
   * Utilise le comportement simple et fiable de l'ancienne méthode
   * 
   * OPTIMISATION: Le calcul des stats est fait de manière asynchrone (non-bloquant)
   */
  private async _broadcastNewMessage(message: Message, conversationId: string, senderSocket?: any): Promise<void> {
    try {
      // Normaliser l'ID de conversation pour le broadcast ET le payload
      const normalizedId = await this.normalizeConversationId(conversationId);

      console.log(`[PHASE 3.1] 📤 Broadcasting message ${message.id} vers conversation ${normalizedId} (original: ${conversationId})`);
      console.log(`[DEBUG] message.conversationId AVANT normalisation: ${message.conversationId}`);

      // CORRECTION CRITIQUE: Remplacer message.conversationId par l'ObjectId normalisé
      // car le message en base peut contenir l'identifier au lieu de l'ObjectId
      (message as any).conversationId = normalizedId;
      console.log(`[DEBUG] message.conversationId APRÈS normalisation: ${message.conversationId}`);
      
      // OPTIMISATION: Récupérer les traductions et les stats en parallèle (non-bloquant)
      // Les stats seront envoyées séparément si elles prennent du temps
      let messageTranslations: any[] = [];
      let updatedStats: any = null;
      
      // Lancer les 2 requêtes en parallèle
      const [translationsResult, statsResult] = await Promise.allSettled([
        // Récupérer les traductions existantes du message
        (async () => {
          if (!message.id) return [];
          try {
            const messageWithTranslations = await this.prisma.message.findUnique({
              where: { id: message.id },
              include: {
                translations: {
                  select: {
                    id: true,
                    targetLanguage: true,
                    translatedContent: true,
                    translationModel: true,
                    cacheKey: true,
                    confidenceScore: true
                  }
                }
              }
            });
            return messageWithTranslations?.translations || [];
          } catch (error) {
            console.warn(`⚠️ [DEBUG] Erreur récupération traductions pour ${message.id}:`, error);
            return [];
          }
        })(),
        // OPTIMISATION: Calculer les stats de manière asynchrone
        // Si c'est long, le broadcast du message ne sera pas bloqué
        conversationStatsService.updateOnNewMessage(
          this.prisma,
          conversationId,  // Utiliser l'ID original (ObjectId) pour Prisma
          message.originalLanguage || 'fr',
          () => this.getConnectedUsers()
        ).catch(error => {
          console.warn(`⚠️ [PERF] Erreur calcul stats (non-bloquant): ${error}`);
          return null; // Continuer même si les stats échouent
        })
      ]);

      // Extraire les résultats
      if (translationsResult.status === 'fulfilled') {
        messageTranslations = translationsResult.value;
      }

      if (statsResult.status === 'fulfilled') {
        updatedStats = statsResult.value;
      } else {
        console.warn(`⚠️ [PERF] Stats non disponibles, broadcast sans stats`);
      }

      // Construire le payload de message pour broadcast - compatible avec les types existants
      // CORRECTION CRITIQUE: Utiliser l'ObjectId normalisé pour cohérence client-serveur
      const messagePayload = {
        id: message.id,
        conversationId: normalizedId,  // ← FIX: Toujours utiliser l'ObjectId normalisé
        senderId: message.senderId || undefined,
        content: message.content,
        originalLanguage: message.originalLanguage || 'fr',
        messageType: message.messageType || 'text',
        isEdited: Boolean(message.isEdited),
        isDeleted: Boolean(message.isDeleted),
        createdAt: message.createdAt || new Date(),
        updatedAt: message.updatedAt || new Date(),
        // CORRECTION CRITIQUE: Inclure les traductions dans le payload
        translations: messageTranslations,
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
        // CORRECTION: Inclure les attachments dans le payload
        attachments: (message as any).attachments || [],
        // CORRECTION: Inclure l'objet replyTo complet ET replyToId
        replyToId: message.replyToId || undefined,
        replyTo: (message as any).replyTo ? {
          id: (message as any).replyTo.id,
          conversationId: normalizedId,  // ← FIX: Utiliser l'ObjectId normalisé cohérent
          senderId: (message as any).replyTo.senderId || undefined,
          anonymousSenderId: (message as any).replyTo.anonymousSenderId || undefined,
          content: (message as any).replyTo.content,
          originalLanguage: (message as any).replyTo.originalLanguage || 'fr',
          messageType: (message as any).replyTo.messageType || 'text',
          createdAt: (message as any).replyTo.createdAt || new Date(),
          sender: (message as any).replyTo.sender ? {
            id: (message as any).replyTo.sender.id,
            username: (message as any).replyTo.sender.username,
            firstName: (message as any).replyTo.sender.firstName || '',
            lastName: (message as any).replyTo.sender.lastName || '',
            displayName: (message as any).replyTo.sender.displayName || (message as any).replyTo.sender.username,
          } : undefined,
          anonymousSender: (message as any).replyTo.anonymousSender ? {
            id: (message as any).replyTo.anonymousSender.id,
            username: (message as any).replyTo.anonymousSender.username,
            firstName: (message as any).replyTo.anonymousSender.firstName,
            lastName: (message as any).replyTo.anonymousSender.lastName,
          } : undefined
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

      // COMPORTEMENT SIMPLE ET FIABLE DE L'ANCIENNE MÉTHODE
      const room = `conversation_${normalizedId}`;
      // 1. Broadcast vers tous les clients de la conversation
      this.io.to(room).emit(SERVER_EVENTS.MESSAGE_NEW, messagePayload);

      // 2. S'assurer que l'auteur reçoit aussi (au cas où il ne serait pas dans la room encore)
      if (senderSocket) {
        senderSocket.emit(SERVER_EVENTS.MESSAGE_NEW, messagePayload);
        console.log(`📤 [PHASE 3.1] Message ${message.id} envoyé directement à l'auteur via socket`);
      } else {
        console.log(`⚠️ [PHASE 3.1] Socket de l'auteur non fourni, broadcast room seulement`);
      }

      const roomClients = this.io.sockets.adapter.rooms.get(room);
      console.log(`✅ [PHASE 3.1] Message ${message.id} broadcasté vers ${room} (${roomClients?.size || 0} clients)`);
      
      // Envoyer les notifications de message pour les utilisateurs non connectés à la conversation
      const isAnonymousSender = !!message.anonymousSenderId;
      if (message.senderId) {
        // Note: Les notifications sont gérées directement dans routes/notifications.ts
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

  // ===== HANDLERS DE RÉACTIONS =====

  /**
   * Gère l'ajout d'une réaction à un message
   */
  private async _handleReactionAdd(
    socket: any,
    data: { messageId: string; emoji: string },
    callback?: (response: SocketIOResponse<any>) => void
  ): Promise<void> {
    try {
      console.log('🎯 [_handleReactionAdd] Called with:', {
        socketId: socket.id,
        messageId: data.messageId,
        emoji: data.emoji
      });

      const userId = this.socketToUser.get(socket.id);
      console.log('🔍 [_handleReactionAdd] User lookup:', {
        userId,
        hasSocketMapping: this.socketToUser.has(socket.id),
        socketToUserSize: this.socketToUser.size
      });

      if (!userId) {
        console.error('❌ [_handleReactionAdd] No userId found for socket:', socket.id);
        console.log('📋 [_handleReactionAdd] Current socketToUser mappings:', 
          Array.from(this.socketToUser.entries()).map(([sid, uid]) => ({
            socketId: sid.substring(0, 8) + '...',
            userId: uid.substring(0, 8) + '...'
          }))
        );
        console.log('📋 [_handleReactionAdd] Current connectedUsers:', 
          Array.from(this.connectedUsers.entries()).map(([uid, user]) => ({
            userId: uid.substring(0, 8) + '...',
            isAnonymous: user.isAnonymous,
            hasSessionToken: !!user.sessionToken
          }))
        );
        
        const errorResponse: SocketIOResponse<any> = {
          success: false,
          error: 'User not authenticated'
        };
        if (callback) callback(errorResponse);
        return;
      }

      const user = this.connectedUsers.get(userId);
      const isAnonymous = user?.isAnonymous || false;
      const sessionToken = user?.sessionToken;

      console.log('👤 [_handleReactionAdd] User info:', {
        userId: userId.substring(0, 8) + '...',
        isAnonymous,
        hasSessionToken: !!sessionToken,
        sessionTokenPreview: sessionToken?.substring(0, 8) + '...'
      });

      // Importer le ReactionService
      const { ReactionService } = await import('../services/ReactionService.js');
      const reactionService = new ReactionService(this.prisma);

      // Ajouter la réaction
      const reaction = await reactionService.addReaction({
        messageId: data.messageId,
        emoji: data.emoji,
        userId: !isAnonymous ? userId : undefined,
        anonymousUserId: isAnonymous && sessionToken ? sessionToken : undefined
      });

      if (!reaction) {
        const errorResponse: SocketIOResponse<any> = {
          success: false,
          error: 'Failed to add reaction'
        };
        if (callback) callback(errorResponse);
        return;
      }

      // Créer l'événement de mise à jour
      const updateEvent = await reactionService.createUpdateEvent(
        data.messageId,
        data.emoji,
        'add',
        !isAnonymous ? userId : undefined,
        isAnonymous && sessionToken ? sessionToken : undefined
      );

      // Envoyer la réponse au client
      const successResponse: SocketIOResponse<any> = {
        success: true,
        data: reaction
      };
      if (callback) callback(successResponse);

      // Broadcaster l'événement à tous les participants de la conversation
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { conversationId: true }
      });

      if (message) {
        const normalizedConversationId = await this.normalizeConversationId(message.conversationId);
        console.log(`📡 [REACTION_ADDED] Broadcasting à la room:`, {
          conversationId: normalizedConversationId,
          messageId: data.messageId,
          emoji: data.emoji,
          userId: userId,
          updateEvent: updateEvent
        });
        
        this.io.to(normalizedConversationId).emit(SERVER_EVENTS.REACTION_ADDED, updateEvent);
        
        console.log(`✨ Réaction ajoutée et broadcastée: ${data.emoji} sur message ${data.messageId} par ${userId}`);
      } else {
        console.error(`❌ [REACTION_ADDED] Message ${data.messageId} non trouvé, impossible de broadcaster`);
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'ajout de réaction:', error);
      const errorResponse: SocketIOResponse<any> = {
        success: false,
        error: error.message || 'Failed to add reaction'
      };
      if (callback) callback(errorResponse);
    }
  }

  /**
   * Gère la suppression d'une réaction d'un message
   */
  private async _handleReactionRemove(
    socket: any,
    data: { messageId: string; emoji: string },
    callback?: (response: SocketIOResponse<any>) => void
  ): Promise<void> {
    try {
      const userId = this.socketToUser.get(socket.id);
      if (!userId) {
        const errorResponse: SocketIOResponse<any> = {
          success: false,
          error: 'User not authenticated'
        };
        if (callback) callback(errorResponse);
        return;
      }

      const user = this.connectedUsers.get(userId);
      const isAnonymous = user?.isAnonymous || false;
      const sessionToken = user?.sessionToken;

      // Importer le ReactionService
      const { ReactionService } = await import('../services/ReactionService.js');
      const reactionService = new ReactionService(this.prisma);

      // Supprimer la réaction
      const removed = await reactionService.removeReaction({
        messageId: data.messageId,
        emoji: data.emoji,
        userId: !isAnonymous ? userId : undefined,
        anonymousUserId: isAnonymous && sessionToken ? sessionToken : undefined
      });

      if (!removed) {
        const errorResponse: SocketIOResponse<any> = {
          success: false,
          error: 'Reaction not found'
        };
        if (callback) callback(errorResponse);
        return;
      }

      // Créer l'événement de mise à jour
      const updateEvent = await reactionService.createUpdateEvent(
        data.messageId,
        data.emoji,
        'remove',
        !isAnonymous ? userId : undefined,
        isAnonymous && sessionToken ? sessionToken : undefined
      );

      // Envoyer la réponse au client
      const successResponse: SocketIOResponse<any> = {
        success: true,
        data: { message: 'Reaction removed successfully' }
      };
      if (callback) callback(successResponse);

      // Broadcaster l'événement à tous les participants de la conversation
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { conversationId: true }
      });

      if (message) {
        const normalizedConversationId = await this.normalizeConversationId(message.conversationId);
        this.io.to(normalizedConversationId).emit(SERVER_EVENTS.REACTION_REMOVED, updateEvent);
      }

      console.log(`🗑️ Réaction retirée: ${data.emoji} sur message ${data.messageId} par ${userId}`);
    } catch (error: any) {
      console.error('❌ Erreur lors de la suppression de réaction:', error);
      const errorResponse: SocketIOResponse<any> = {
        success: false,
        error: error.message || 'Failed to remove reaction'
      };
      if (callback) callback(errorResponse);
    }
  }

  /**
   * Gère la synchronisation des réactions d'un message
   */
  private async _handleReactionSync(
    socket: any,
    messageId: string,
    callback?: (response: SocketIOResponse<any>) => void
  ): Promise<void> {
    try {
      console.log(`🔄 [REACTION_SYNC] Demande de synchronisation pour message ${messageId} par socket ${socket.id}`);
      
      const userId = this.socketToUser.get(socket.id);
      if (!userId) {
        console.error(`❌ [REACTION_SYNC] Utilisateur non authentifié pour socket ${socket.id}`);
        const errorResponse: SocketIOResponse<any> = {
          success: false,
          error: 'User not authenticated'
        };
        if (callback) callback(errorResponse);
        return;
      }

      const user = this.connectedUsers.get(userId);
      const isAnonymous = user?.isAnonymous || false;
      const sessionToken = user?.sessionToken;

      console.log(`👤 [REACTION_SYNC] Utilisateur: ${userId}, isAnonymous: ${isAnonymous}`);

      // Importer le ReactionService
      const { ReactionService } = await import('../services/ReactionService.js');
      const reactionService = new ReactionService(this.prisma);

      // Récupérer les réactions avec agrégation
      const reactionSync = await reactionService.getMessageReactions({
        messageId,
        currentUserId: !isAnonymous ? userId : undefined,
        currentAnonymousUserId: isAnonymous && sessionToken ? sessionToken : undefined
      });

      console.log(`✅ [REACTION_SYNC] Réactions récupérées:`, {
        messageId,
        reactionsCount: reactionSync.reactions.length,
        userReactionsCount: reactionSync.userReactions.length,
        reactions: reactionSync.reactions,
        userReactions: reactionSync.userReactions
      });

      // Envoyer la réponse au client
      const successResponse: SocketIOResponse<any> = {
        success: true,
        data: reactionSync
      };
      if (callback) callback(successResponse);

      console.log(`🔄 Synchronisation des réactions pour message ${messageId} terminée pour ${userId}`);
    } catch (error: any) {
      console.error('❌ Erreur lors de la synchronisation des réactions:', error);
      const errorResponse: SocketIOResponse<any> = {
        success: false,
        error: error.message || 'Failed to sync reactions'
      };
      if (callback) callback(errorResponse);
    }
  }

  // ===== FIN HANDLERS DE RÉACTIONS =====

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
      // Arrêter le ticker des stats en ligne
      if (this.onlineStatsInterval) {
        clearInterval(this.onlineStatsInterval);
        this.onlineStatsInterval = null;
      }
      
      await this.translationService.close();
      this.io.close();
      console.log('[GATEWAY] ✅ MeeshySocketIOManager fermé');
    } catch (error) {
      console.error(`❌ Erreur fermeture MeeshySocketIOManager: ${error}`);
    }
  }
}
