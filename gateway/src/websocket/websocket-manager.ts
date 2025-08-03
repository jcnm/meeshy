/**
 * Gestionnaire WebSocket simplifié avec traduction intégrée
 * Version fonctionnelle pour Meeshy
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '../../libs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { ZMQTranslationClient } from '../services/zmq-translation-client';

// Instance globale du client ZMQ
let zmqTranslationClient: ZMQTranslationClient | null = null;

// Initialiser le client ZMQ
async function getZMQClient(): Promise<ZMQTranslationClient> {
  if (!zmqTranslationClient) {
    const port = parseInt(process.env.ZMQ_PORT || '5555');
    const host = process.env.ZMQ_HOST || 'translator';
    
    zmqTranslationClient = new ZMQTranslationClient(port, host);
    await zmqTranslationClient.initialize();
  }
  return zmqTranslationClient;
}

// Interface simplifiée pour les connexions WebSocket
interface SimpleWebSocketConnection {
  id: string;
  socket: any;
  userId: string | null;
  username: string | null;
  isAuthenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
}

// Types d'événements WebSocket
enum WebSocketEventType {
  AUTH_REQUEST = 'auth_request',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILED = 'auth_failed',
  MESSAGE_SEND = 'message_send',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_TRANSLATE = 'message_translate',
  MESSAGE_TRANSLATED = 'message_translated',
  AUTO_TRANSLATION_RECEIVED = 'auto_translation_received',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  ERROR = 'error'
}

// Interface pour les messages
interface WebSocketMessage {
  type: WebSocketEventType;
  data: any;
  timestamp: Date;
}

export class MeeshyWebSocketManager {
  private connections = new Map<string, SimpleWebSocketConnection>();
  private userConnections = new Map<string, Set<string>>(); // userId -> connectionIds
  private prisma: PrismaClient;
  private jwtSecret: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
    logger.info('🚀 MeeshyWebSocketManager initialisé avec traduction');
  }

  /**
   * Configure le WebSocket sur l'instance Fastify
   */
  public setupWebSocket(fastify: FastifyInstance): void {
    const self = this;

    fastify.register(require('@fastify/websocket'));

    fastify.register(async function(fastify) {
      fastify.get('/ws', { websocket: true }, (connection, request) => {
        self.handleConnection(connection, request);
      });
    });

    logger.info('✅ WebSocket configuré sur /ws');
  }

  /**
   * Gère une nouvelle connexion WebSocket
   */
  private async handleConnection(connection: any, request: any): Promise<void> {
    const connectionId = uuidv4();
    const clientIp = request.ip;
    
    logger.info(`🔌 Nouvelle connexion WebSocket: ${connectionId} depuis ${clientIp}`);

    // Configuration initiale de la connexion
    const conn: SimpleWebSocketConnection = {
      id: connectionId,
      socket: connection.socket,
      userId: null,
      username: null,
      isAuthenticated: false,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.connections.set(connectionId, conn);

    // Timeout d'authentification (30 secondes)
    const authTimeout = setTimeout(() => {
      if (!conn.isAuthenticated) {
        logger.warn(`⏰ Timeout d'authentification pour ${connectionId}`);
        connection.socket.close(1008, 'Authentication timeout');
      }
    }, 30000);

    // Gestionnaires d'événements
    connection.socket.on('message', async (data: Buffer) => {
      clearTimeout(authTimeout);
      await this.handleMessage(connectionId, data);
    });

    connection.socket.on('close', () => {
      clearTimeout(authTimeout);
      this.handleDisconnection(connectionId);
    });

    connection.socket.on('error', (error: any) => {
      logger.error(`❌ Erreur WebSocket ${connectionId}:`, error);
      clearTimeout(authTimeout);
      this.handleDisconnection(connectionId);
    });

    // Demander l'authentification
    this.sendToConnection(connectionId, {
      type: WebSocketEventType.AUTH_REQUEST,
      data: { message: 'Authentication required' },
      timestamp: new Date()
    });
  }

  /**
   * Gère les messages entrants
   */
  private async handleMessage(connectionId: string, data: Buffer): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    // Mettre à jour l'activité
    conn.lastActivity = new Date();

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      logger.debug(`📨 Message reçu de ${connectionId}: ${message.type}`);

      // Router les messages selon leur type
      switch (message.type) {
        case WebSocketEventType.AUTH_REQUEST:
          await this.handleAuthentication(connectionId, message.data);
          break;

        case WebSocketEventType.MESSAGE_SEND:
          if (conn.isAuthenticated) {
            await this.handleMessageSend(connectionId, message.data);
          } else {
            this.sendError(connectionId, 'Not authenticated');
          }
          break;

        case WebSocketEventType.MESSAGE_TRANSLATE:
          if (conn.isAuthenticated) {
            await this.handleMessageTranslation(connectionId, message.data);
          } else {
            this.sendError(connectionId, 'Not authenticated');
          }
          break;

        case WebSocketEventType.TYPING_START:
        case WebSocketEventType.TYPING_STOP:
          if (conn.isAuthenticated) {
            await this.handleTyping(connectionId, message);
          }
          break;

        default:
          logger.warn(`⚠️ Type de message non supporté: ${message.type}`);
      }

    } catch (error) {
      logger.error(`❌ Erreur traitement message ${connectionId}:`, error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }

  /**
   * Gère l'authentification JWT
   */
  private async handleAuthentication(connectionId: string, data: any): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    try {
      const { token } = data;
      if (!token) {
        throw new Error('Token manquant');
      }

      // Vérifier le JWT
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string; email: string };

      // Vérifier que l'utilisateur existe
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, username: true, isOnline: true }
      });

      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Mettre à jour la connexion
      conn.userId = user.id;
      conn.username = user.username;
      conn.isAuthenticated = true;

      // Ajouter à la map des connexions utilisateur
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set());
      }
      this.userConnections.get(user.id)!.add(connectionId);

      // Mettre à jour le statut en ligne
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isOnline: true, lastSeen: new Date() }
      });

      // Confirmer l'authentification
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.AUTH_SUCCESS,
        data: { 
          userId: user.id,
          username: user.username,
          message: 'Authentication successful' 
        },
        timestamp: new Date()
      });

      logger.info(`✅ Utilisateur ${user.username} (${user.id}) authentifié sur ${connectionId}`);

    } catch (error) {
      logger.error(`❌ Erreur authentification ${connectionId}:`, error);
      
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.AUTH_FAILED,
        data: { message: 'Authentication failed' },
        timestamp: new Date()
      });

      // Fermer la connexion après échec d'authentification
      setTimeout(() => {
        conn.socket.close(1003, 'Authentication failed');
      }, 1000);
    }
  }

  /**
   * Gère l'envoi de messages avec traduction automatique
   */
  private async handleMessageSend(connectionId: string, data: any): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    try {
      const { conversationId, content, messageType = 'text' } = data;

      if (!conversationId || !content) {
        throw new Error('conversationId et content requis');
      }

      // Vérifier que la conversation existe
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId }
      });

      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      // Créer le message en base
      const message = await this.prisma.message.create({
        data: {
          id: uuidv4(),
          content,
          senderId: conn.userId,
          conversationId,
          messageType,
          originalLanguage: 'auto', // À détecter
        },
        include: {
          sender: {
            select: { id: true, username: true }
          }
        }
      });

      // Préparer les données du message
      const messageData = {
        messageId: message.id,
        conversationId,
        content,
        senderId: conn.userId,
        senderUsername: message.sender.username,
        messageType,
        timestamp: message.createdAt
      };

      // Diffuser le message à tous les participants (pour simplifier, diffusion à tous les utilisateurs connectés)
      this.broadcastToAllAuthenticated({
        type: WebSocketEventType.MESSAGE_RECEIVED,
        data: messageData,
        timestamp: new Date()
      });

      // Traduction automatique si le service est disponible
      if (zmqTranslationClient) {
        await this.handleAutoTranslation(message.id, content, conversationId);
      }

      logger.info(`💬 Message envoyé dans conversation ${conversationId} par ${conn.username}`);

    } catch (error) {
      logger.error(`❌ Erreur envoi message ${connectionId}:`, error);
      this.sendError(connectionId, 'Failed to send message');
    }
  }

  /**
   * Gère la traduction manuelle de messages
   */
  private async handleMessageTranslation(connectionId: string, data: any): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    try {
      const { messageId, targetLanguages, sourceLanguage } = data;

      if (!messageId || !targetLanguages || !Array.isArray(targetLanguages)) {
        throw new Error('messageId et targetLanguages requis');
      }

      logger.info(`🌐 Demande de traduction: message ${messageId} vers ${targetLanguages.join(', ')}`);

      // Récupérer le message original
      const message = await this.prisma.message.findUnique({
        where: { id: messageId }
      });

      if (!message) {
        throw new Error('Message non trouvé');
      }

      // Effectuer la traduction
      const client = await getZMQClient();
      const translationResult = await client.translateToMultipleLanguages(
        message.content,
        sourceLanguage || 'auto',
        targetLanguages
      );

      if (!translationResult || translationResult.length === 0) {
        throw new Error('Échec de la traduction');
      }

      // Sauvegarder les traductions en base
      const translations = await Promise.all(
        translationResult.map(async (translation) => {
          return await this.prisma.messageTranslation.create({
            data: {
              id: uuidv4(),
              messageId,
              targetLanguage: 'auto', // TODO: Récupérer la langue cible depuis la requête
              translatedContent: translation.translatedText,
              sourceLanguage: translation.detectedSourceLanguage,
              translationModel: translation.metadata?.modelUsed || 'basic',
              cacheKey: `${messageId}_${translation.detectedSourceLanguage}`
            }
          });
        })
      );

      // Envoyer les traductions au demandeur
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.MESSAGE_TRANSLATED,
        data: {
          messageId,
          sourceLanguage: translationResult[0]?.detectedSourceLanguage || 'auto',
          translations: translations.map((t: any) => ({
            language: t.targetLanguage,
            content: t.translatedContent,
            model: t.translationModel
          }))
        },
        timestamp: new Date()
      });

      logger.info(`✅ Traduction terminée pour message ${messageId}: ${translations.length} langues`);

    } catch (error) {
      logger.error(`❌ Erreur traduction message ${connectionId}:`, error);
      this.sendError(connectionId, 'Translation failed');
    }
  }

  /**
   * Traduction automatique pour tous les utilisateurs
   */
  private async handleAutoTranslation(messageId: string, content: string, conversationId: string): Promise<void> {
    try {
      // Langues cibles communes (français, anglais, espagnol, allemand)
      const targetLanguages = ['fr', 'en', 'es', 'de'];

      logger.info(`🤖 Traduction automatique pour message ${messageId}`);

      // Effectuer la traduction
      const client = await getZMQClient();
      const translationResult = await client.translateToMultipleLanguages(
        content,
        'auto',
        targetLanguages
      );

      if (!translationResult || translationResult.length === 0) {
        logger.warn(`⚠️ Échec traduction automatique pour message ${messageId}`);
        return;
      }

      // Sauvegarder les traductions automatiques
      const translations = await Promise.all(
        translationResult.map(async (translation) => {
          return await this.prisma.messageTranslation.create({
            data: {
              id: uuidv4(),
              messageId,
              targetLanguage: 'auto', // TODO: Récupérer la langue cible appropriée
              translatedContent: translation.translatedText,
              sourceLanguage: translation.detectedSourceLanguage,
              translationModel: translation.metadata?.modelUsed || 'basic',
              cacheKey: `auto_${messageId}_${translation.detectedSourceLanguage}`
            }
          });
        })
      );

      // Diffuser les traductions automatiques à tous les utilisateurs connectés
      this.broadcastToAllAuthenticated({
        type: WebSocketEventType.AUTO_TRANSLATION_RECEIVED,
        data: {
          messageId,
          conversationId,
          sourceLanguage: translationResult[0]?.detectedSourceLanguage || 'auto',
          translations: translations.map((t: any) => ({
            language: t.targetLanguage,
            content: t.translatedContent,
            model: t.translationModel
          }))
        },
        timestamp: new Date()
      });

      logger.info(`✅ Traduction automatique terminée pour message ${messageId}: ${translations.length} traductions`);

    } catch (error) {
      logger.error(`❌ Erreur traduction automatique message ${messageId}:`, error);
    }
  }

  /**
   * Gère les indicateurs de frappe
   */
  private async handleTyping(connectionId: string, message: WebSocketMessage): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    // Diffuser l'indicateur de frappe aux autres utilisateurs connectés
    this.broadcastToOthers(connectionId, {
      type: message.type,
      data: {
        ...message.data,
        userId: conn.userId,
        username: conn.username
      },
      timestamp: new Date()
    });
  }

  /**
   * Gère la déconnexion d'un client
   */
  private async handleDisconnection(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    logger.info(`🔌 Déconnexion WebSocket: ${connectionId}`);

    // Mettre à jour le statut hors ligne
    if (conn.userId) {
      try {
        await this.prisma.user.update({
          where: { id: conn.userId },
          data: { isOnline: false, lastSeen: new Date() }
        });

        // Nettoyer les connexions utilisateur
        const userConnections = this.userConnections.get(conn.userId);
        if (userConnections) {
          userConnections.delete(connectionId);
          if (userConnections.size === 0) {
            this.userConnections.delete(conn.userId);
          }
        }
      } catch (error) {
        logger.error(`❌ Erreur mise à jour statut déconnexion:`, error);
      }
    }

    // Supprimer la connexion
    this.connections.delete(connectionId);
  }

  /**
   * Envoie un message à une connexion spécifique
   */
  private sendToConnection(connectionId: string, message: WebSocketMessage): void {
    const conn = this.connections.get(connectionId);
    if (conn && conn.socket.readyState === 1) { // WebSocket.OPEN = 1
      try {
        conn.socket.send(JSON.stringify(message));
      } catch (error) {
        logger.error(`❌ Erreur envoi message à ${connectionId}:`, error);
      }
    }
  }

  /**
   * Envoie un message d'erreur à une connexion
   */
  private sendError(connectionId: string, message: string): void {
    this.sendToConnection(connectionId, {
      type: WebSocketEventType.ERROR,
      data: { message },
      timestamp: new Date()
    });
  }

  /**
   * Diffuse un message à tous les utilisateurs authentifiés
   */
  private broadcastToAllAuthenticated(message: WebSocketMessage): void {
    for (const [connectionId, conn] of this.connections.entries()) {
      if (conn.isAuthenticated) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Diffuse un message à tous sauf l'expéditeur
   */
  private broadcastToOthers(senderConnectionId: string, message: WebSocketMessage): void {
    for (const [connectionId, conn] of this.connections.entries()) {
      if (conn.isAuthenticated && connectionId !== senderConnectionId) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Statistiques des connexions
   */
  public getStats(): any {
    const authenticatedConnections = Array.from(this.connections.values()).filter(c => c.isAuthenticated);
    
    return {
      totalConnections: this.connections.size,
      authenticatedConnections: authenticatedConnections.length,
      uniqueUsers: this.userConnections.size,
      translationServiceReady: zmqTranslationClient !== null,
      activeUsers: authenticatedConnections.map(c => ({
        userId: c.userId,
        username: c.username,
        connectedAt: c.connectedAt,
        lastActivity: c.lastActivity
      }))
    };
  }
}

// Instance singleton
export const webSocketManager = new MeeshyWebSocketManager();

export default webSocketManager;
