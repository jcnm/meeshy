/**
 * Gestionnaire WebSocket simplifié pour Meeshy
 * Version fonctionnelle avec gestion complète des événements temps réel
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '../../libs/prisma/client';
import { TranslationService } from '../services/TranslationService';
import { ZMQTranslationClient } from '../services/zmq-translation-client';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Interface pour une connexion WebSocket authentifiée
interface AuthenticatedWebSocket {
  id: string;
  userId: string;
  username: string;
  socket: any;
  connectedAt: Date;
  subscriptions: Set<string>; // IDs des conversations
}

// Gestionnaire WebSocket principal
export class MeeshyWebSocketHandler {
  private connections: Map<string, AuthenticatedWebSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set<connectionId>
  private conversationMembers: Map<string, Set<string>> = new Map(); // conversationId -> Set<userId>
  private typingUsers: Map<string, Map<string, NodeJS.Timeout>> = new Map(); // conversationId -> Map<userId, timeout>

  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwtSecret: string
  ) {
    const zmqClient = new ZMQTranslationClient();
    this.translationService = new TranslationService(this.prisma, zmqClient);
    // Initialiser le service de traduction
    this.translationService.initialize().catch((error) => 
      logger.error('Failed to initialize translation service', error)
    );
  }

  private readonly translationService: TranslationService;

  /**
   * Configure le WebSocket sur l'instance Fastify
   */
  public setupWebSocket(fastify: FastifyInstance): void {
    const self = this;

    fastify.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, (connection, request) => {
        self.handleConnection(connection, request);
      });
    });
  }

  /**
   * Gère une nouvelle connexion WebSocket
   */
  private async handleConnection(connection: any, request: any): Promise<void> {
    const connectionId = uuidv4();
    let authenticatedConnection: AuthenticatedWebSocket | null = null;

    // Authentification immédiate via token en query parameter
    try {
      const token = (request.query as any)?.token as string;
      if (!token) {
        logger.warn(`WebSocket connection rejected: No token provided from ${request.ip}`);
        connection.socket.close(4001, 'Authentication required: token parameter missing');
        return;
      }

      authenticatedConnection = await this.authenticateConnection(
        connectionId, 
        connection, 
        token
      );
      
      if (!authenticatedConnection) {
        return; // L'erreur a déjà été envoyée dans authenticateConnection
      }

      this.connections.set(connectionId, authenticatedConnection);
      
      // Ajouter à la map des connexions utilisateur
      if (!this.userConnections.has(authenticatedConnection.userId)) {
        this.userConnections.set(authenticatedConnection.userId, new Set());
      }
      this.userConnections.get(authenticatedConnection.userId)!.add(connectionId);

      // Confirmer l'authentification
      connection.socket.send(JSON.stringify({
        type: 'authenticated',
        data: {
          userId: authenticatedConnection.userId,
          username: authenticatedConnection.username
        }
      }));

      // Mettre à jour le statut en ligne
      await this.updateUserOnlineStatus(authenticatedConnection.userId, true);

      // Rejoindre automatiquement la conversation globale "any"
      await this.ensureGlobalConversationExists();
      await this.addUserToGlobalConversation(authenticatedConnection.userId);
      
      authenticatedConnection.subscriptions.add('any');
      if (!this.conversationMembers.has('any')) {
        this.conversationMembers.set('any', new Set());
      }
      this.conversationMembers.get('any')!.add(authenticatedConnection.userId);

      logger.info(`User ${authenticatedConnection.username} connected and joined global conversation`);

    } catch (error) {
      logger.error('WebSocket authentication error', error);
      connection.socket.close(4002, 'Authentication failed');
      return;
    }

    // Gestionnaire de messages
    connection.socket.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleMessage(authenticatedConnection!, data);
      } catch (error) {
        logger.error('WebSocket message error', error);
        connection.socket.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    // Gestionnaire de fermeture
    connection.socket.on('close', async () => {
      if (authenticatedConnection) {
        await this.handleDisconnection(authenticatedConnection);
      }
    });

    // Gestionnaire d'erreur
    connection.socket.on('error', (error: Error) => {
      logger.error('WebSocket error', error);
    });
  }

  /**
   * Authentifie une connexion WebSocket
   */
  private async authenticateConnection(
    connectionId: string, 
    connection: any, 
    token: string
  ): Promise<AuthenticatedWebSocket | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;
      const userId = payload.userId || payload.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true
        }
      });

      if (!user) {
        logger.warn('User not found during authentication');
        connection.socket.close(4002, 'User not found');
        return null;
      }

      // Créer la connexion authentifiée
      return {
        id: connectionId,
        userId: user.id,
        username: user.username,
        socket: connection.socket,
        connectedAt: new Date(),
        subscriptions: new Set()
      };

    } catch (error) {
      connection.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Invalid authentication token' }
      }));
      return null;
    }
  }

  /**
   * Gère les messages WebSocket authentifiés
   */
  private async handleMessage(connection: AuthenticatedWebSocket, data: any): Promise<void> {
    logger.debug(`Processing message type: ${data.type}`, { 
      userId: connection.userId, 
      conversationId: data.conversationId 
    });

    switch (data.type) {
      case 'join_chat':
        await this.handleJoinConversation(connection, data.conversationId);
        break;
        
      case 'leave_chat':
        await this.handleLeaveConversation(connection, data.conversationId);
        break;
        
      case 'new_message':
        await this.handleSendMessage(connection, data);
        break;
        
      case 'start_typing':
        await this.handleTypingStart(connection, data.conversationId);
        break;
        
      case 'stop_typing':
        await this.handleTypingStop(connection, data.conversationId);
        break;
        
      case 'read_message':
        await this.handleMarkRead(connection, data);
        break;
        
      default:
        connection.socket.send(JSON.stringify({
          type: 'error',
          data: { message: `Unknown message type: ${data.type}` }
        }));
    }
  }

  /**
   * Rejoindre une conversation
   */
  private async handleJoinConversation(connection: AuthenticatedWebSocket, conversationId: string): Promise<void> {
    // Vérifier l'accès à la conversation
    const member = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId: connection.userId
      }
    });

    if (!member) {
      connection.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Access denied to conversation' }
      }));
      return;
    }

    // Ajouter à la conversation
    connection.subscriptions.add(conversationId);
    
    if (!this.conversationMembers.has(conversationId)) {
      this.conversationMembers.set(conversationId, new Set());
    }
    this.conversationMembers.get(conversationId)!.add(connection.userId);

    connection.socket.send(JSON.stringify({
      type: 'chat_joined',
      data: { conversationId }
    }));
  }

  /**
   * Quitter une conversation
   */
  private async handleLeaveConversation(connection: AuthenticatedWebSocket, conversationId: string): Promise<void> {
    connection.subscriptions.delete(conversationId);
    
    const members = this.conversationMembers.get(conversationId);
    if (members) {
      members.delete(connection.userId);
    }

    // Arrêter l'indicateur de frappe
    await this.stopTyping(connection.userId, conversationId);

    connection.socket.send(JSON.stringify({
      type: 'chat_left',
      data: { conversationId }
    }));
  }

  /**
   * Envoyer un message
   */
  private async handleSendMessage(connection: AuthenticatedWebSocket, data: any): Promise<void> {
    const { conversationId, content, tempId } = data;

    // Vérifier l'accès
    if (!connection.subscriptions.has(conversationId)) {
      connection.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Not subscribed to conversation' }
      }));
      return;
    }

    try {
      // Créer le message en base
      const message = await this.prisma.message.create({
        data: {
          content,
          senderId: connection.userId,
          conversationId,
          originalLanguage: 'fr' // TODO: Détecter automatiquement
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          }
        }
      });

      // Marquer le message comme lu pour l'expéditeur
      await this.prisma.messageReadStatus.create({
        data: {
          messageId: message.id,
          userId: connection.userId
        }
      });

      // Lancer la traduction via le service Translator (qui gère lui-même les langues des participants)
      this.requestTranslationsAndBroadcast(message, conversationId, tempId);

      // Broadcaster immédiatement le message original à l'expéditeur
      connection.socket.send(JSON.stringify({
        type: 'message_sent',
        data: {
          id: message.id,
          content: message.content,
          originalLanguage: message.originalLanguage,
          sender: message.sender,
          conversationId: message.conversationId,
          createdAt: message.createdAt,
          tempId
        }
      }));

    } catch (error) {
      logger.error('Error sending message', error);
      connection.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Failed to send message' }
      }));
    }
  }

  /**
   * Demande les traductions au service Translator et broadcast le message avec toutes les traductions
   */
  private async requestTranslationsAndBroadcast(message: any, conversationId: string, tempId?: string): Promise<void> {
    try {
      // Récupérer les IDs des participants de la conversation
      let participantIds: string[] = [];

      if (conversationId === 'any') {
        // Pour la conversation globale, tous les utilisateurs connectés
        participantIds = Array.from(this.userConnections.keys());
      } else {
        // Pour les conversations normales
        const participants = await this.prisma.conversationMember.findMany({
          where: {
            conversationId: conversationId,
            isActive: true
          },
          select: {
            userId: true
          }
        });
        participantIds = participants.map(p => p.userId);
      }

      // Envoyer une requête de traduction au service Translator via ZMQ
      // Le service Translator récupérera lui-même les langues des participants et traduira
      const zmqClient = await this.getZMQClient();
      
      const translationRequest = {
        messageId: message.id,
        text: message.content,
        sourceLanguage: message.originalLanguage,
        targetLanguage: message.originalLanguage, // Langue source (le Translator déterminera les cibles)
        modelType: this.getPredictedModelType(message.content.length),
        conversationId: conversationId, // Le Translator utilisera ceci pour récupérer les participants
        participantIds: participantIds, // Information pour optimisation
        requestType: 'message_translation'
      };

      logger.debug(`Translation request for message ${message.id} to all participant languages`);
      
      // Envoyer la requête au service Translator
      const translationResponse = await zmqClient.translateText(translationRequest);
      
      // Le service Translator retourne maintenant le message avec toutes ses traductions
      // On broadcaste ce message complet à tous les participants
      const messageWithTranslations = {
        id: message.id,
        content: message.content,
        originalLanguage: message.originalLanguage,
        sender: message.sender,
        conversationId: message.conversationId,
        createdAt: message.createdAt,
        tempId,
        translations: translationResponse.translations || [] // Toutes les traductions
      };

      // Broadcaster le message avec toutes les traductions à tous les participants
      this.broadcastToConversation(conversationId, {
        type: `message_received_${conversationId}`,
        data: messageWithTranslations
      }, message.senderId); // Exclure l'expéditeur qui a déjà reçu le message

      logger.info(`Message ${message.id} broadcasted with ${translationResponse.translations?.length || 0} translations`);

    } catch (error) {
      logger.error('Translation request failed', error);
      
      // Fallback: broadcaster le message original sans traductions
      this.broadcastToConversation(conversationId, {
        type: `message_received_${conversationId}`,
        data: {
          id: message.id,
          content: message.content,
          originalLanguage: message.originalLanguage,
          sender: message.sender,
          conversationId: message.conversationId,
          createdAt: message.createdAt,
          tempId,
          translations: [],
          error: 'Translation service unavailable'
        }
      }, message.senderId);
    }
  }

  /**
   * Obtient une instance du client ZMQ
   */
  private async getZMQClient(): Promise<any> {
    if (!this.zmqClient) {
      const { ZMQTranslationClient } = await import('../services/zmq-translation-client');
      this.zmqClient = new ZMQTranslationClient();
      await this.zmqClient.initialize();
    }
    return this.zmqClient;
  }

  private zmqClient: any = null;

  /**
   * Prédit le type de modèle basé sur la longueur du texte
   */
  private getPredictedModelType(textLength: number): 'basic' | 'medium' | 'premium' {
    if (textLength < 20) return 'basic';
    if (textLength <= 100) return 'medium';
    return 'premium';
  }

  /**
   * Début d'indicateur de frappe
   */
  private async handleTypingStart(connection: AuthenticatedWebSocket, conversationId: string): Promise<void> {
    if (!connection.subscriptions.has(conversationId)) return;

    // Initialiser la map si nécessaire
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Map());
    }

    const conversationTyping = this.typingUsers.get(conversationId)!;
    
    // Annuler le timeout précédent
    const existingTimeout = conversationTyping.get(connection.userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Programmer l'arrêt automatique après 5 secondes
    const timeout = setTimeout(() => {
      this.stopTyping(connection.userId, conversationId);
    }, 5000);

    conversationTyping.set(connection.userId, timeout);

    // Notifier les autres membres
    this.broadcastToConversation(conversationId, {
      type: `typing_started_${conversationId}`,
      data: {
        conversationId,
        userId: connection.userId,
        username: connection.username,
        isTyping: true
      }
    }, connection.userId);
  }

  /**
   * Arrêt d'indicateur de frappe
   */
  private async handleTypingStop(connection: AuthenticatedWebSocket, conversationId: string): Promise<void> {
    await this.stopTyping(connection.userId, conversationId);
  }

  /**
   * Marquer un message comme lu
   */
  private async handleMarkRead(connection: AuthenticatedWebSocket, data: any): Promise<void> {
    const { messageId, conversationId } = data;

    try {
      await this.prisma.messageReadStatus.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId: connection.userId
          }
        },
        update: { readAt: new Date() },
        create: {
          messageId,
          userId: connection.userId,
          readAt: new Date()
        }
      });

      // Notifier les autres membres
      this.broadcastToConversation(conversationId, {
        type: `message_read_${conversationId}`,
        data: {
          messageId,
          conversationId,
          userId: connection.userId,
          username: connection.username,
          readAt: new Date()
        }
      }, connection.userId);

    } catch (error) {
      logger.error('Error marking message as read', error);
    }
  }

  /**
   * Gère la déconnexion d'un utilisateur
   */
  private async handleDisconnection(connection: AuthenticatedWebSocket): Promise<void> {
    logger.debug(`User ${connection.username} disconnected`);

    // Supprimer de toutes les structures
    this.connections.delete(connection.id);
    
    const userConns = this.userConnections.get(connection.userId);
    if (userConns) {
      userConns.delete(connection.id);
      if (userConns.size === 0) {
        this.userConnections.delete(connection.userId);
        // Mettre à jour le statut hors ligne seulement si plus de connexions
        await this.updateUserOnlineStatus(connection.userId, false);
      }
    }

    // Supprimer des conversations
    for (const conversationId of connection.subscriptions) {
      const members = this.conversationMembers.get(conversationId);
      if (members) {
        members.delete(connection.userId);
      }
      await this.stopTyping(connection.userId, conversationId);
    }
  }

  /**
   * Arrêter l'indicateur de frappe
   */
  private async stopTyping(userId: string, conversationId: string): Promise<void> {
    const conversationTyping = this.typingUsers.get(conversationId);
    if (conversationTyping) {
      const timeout = conversationTyping.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        conversationTyping.delete(userId);
      }
    }

    // Notifier les autres membres
    this.broadcastToConversation(conversationId, {
      type: `typing_stopped_${conversationId}`,
      data: {
        conversationId,
        userId,
        isTyping: false
      }
    }, userId);
  }

  /**
   * Broadcaster un message à tous les membres d'une conversation
   */
  private broadcastToConversation(conversationId: string, message: any, excludeUserId?: string): void {
    logger.debug(`Broadcasting message to conversation ${conversationId}`, {
      type: message.type,
      excludeUserId,
      totalConnections: this.connections.size
    });

    if (conversationId === 'any') {
      // Pour la conversation globale, broadcaster à tous les utilisateurs connectés
      for (const [connId, connection] of this.connections) {
        if (excludeUserId && connection.userId === excludeUserId) continue;
        
        try {
          connection.socket.send(JSON.stringify(message));
          logger.debug(`Message sent to user ${connection.username} (${connection.userId})`);
        } catch (error) {
          logger.error(`Error sending to connection ${connId}`, error);
        }
      }
    } else {
      // Pour les conversations normales, utiliser la logique existante
      const members = this.conversationMembers.get(conversationId);
      if (!members) {
        logger.warn(`No members found for conversation ${conversationId}`);
        return;
      }

      for (const memberId of members) {
        if (excludeUserId && memberId === excludeUserId) continue;
        
        const userConns = this.userConnections.get(memberId);
        if (userConns) {
          for (const connId of userConns) {
            const connection = this.connections.get(connId);
            if (connection && connection.subscriptions.has(conversationId)) {
              try {
                connection.socket.send(JSON.stringify(message));
              } catch (error) {
                logger.error(`Error sending to connection ${connId}`, error);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Mettre à jour le statut en ligne d'un utilisateur
   */
  private async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeen: new Date(),
          lastActiveAt: isOnline ? new Date() : undefined
        }
      });
    } catch (error) {
      logger.error('Error updating user online status', error);
    }
  }

  /**
   * Envoyer un message à un utilisateur spécifique
   */
  public sendToUser(userId: string, message: any): void {
    const userConns = this.userConnections.get(userId);
    if (userConns) {
      for (const connId of userConns) {
        const connection = this.connections.get(connId);
        if (connection) {
          try {
            connection.socket.send(JSON.stringify(message));
          } catch (error) {
            logger.error(`Error sending to user ${userId}`, error);
          }
        }
      }
    }
  }

  /**
   * Obtenir les statistiques de connexion
   */
  public getStats(): any {
    return {
      totalConnections: this.connections.size,
      totalUsers: this.userConnections.size,
      totalConversations: this.conversationMembers.size
    };
  }

  /**
   * S'assurer que la conversation globale "any" existe
   */
  private async ensureGlobalConversationExists(): Promise<void> {
    try {
      const existingConversation = await this.prisma.conversation.findUnique({
        where: { id: 'any' }
      });

      if (!existingConversation) {
        await this.prisma.conversation.create({
          data: {
            id: 'any',
            title: 'Global Stream',
            description: 'Conversation globale pour tous les utilisateurs',
            type: 'global'
          }
        });
        logger.info('Global conversation "any" created');
      }
    } catch (error) {
      logger.error('Error creating global conversation', error);
    }
  }

  /**
   * Ajouter un utilisateur à la conversation globale
   */
  private async addUserToGlobalConversation(userId: string): Promise<void> {
    try {
      await this.prisma.conversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: 'any',
            userId: userId
          }
        },
        update: {
          isActive: true,
          joinedAt: new Date()
        },
        create: {
          conversationId: 'any',
          userId: userId,
          role: 'MEMBER',
          isActive: true,
          joinedAt: new Date()
        }
      });
      logger.debug(`User ${userId} added to global conversation`);
    } catch (error) {
      logger.error('Error adding user to global conversation', error);
    }
  }
}
