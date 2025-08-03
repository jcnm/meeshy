/**
 * Gestionnaire WebSocket avancé pour Meeshy avec traduction intégrée
 * Gère l'authentification, les messages temps réel et la traduction automatique
 */

import { FastifyRequest } from 'fastify';
import { PrismaClient } from '../../../shared/generated';
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
import {
  WebSocketEventType,
  WebSocketMessage,
  AuthenticatedConnection,
  MessageData,
  TypingData,
  ConversationData,
  UserPresenceData,
  MessageTranslationData
} from '../types/websocket-updated';

export class MeeshyAdvancedWebSocketHandler {
  private connections = new Map<string, AuthenticatedConnection>();
  private userConnections = new Map<string, Set<string>>(); // userId -> connectionIds
  private conversationMembers = new Map<string, Set<string>>(); // conversationId -> userIds
  private typingUsers = new Map<string, Map<string, NodeJS.Timeout>>(); // conversationId -> userId -> timeout
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    logger.info('🚀 MeeshyAdvancedWebSocketHandler initialisé avec traduction');
  }

  /**
   * Gère une nouvelle connexion WebSocket
   */
  async handleConnection(connection: SocketStream, request: FastifyRequest): Promise<void> {
    const connectionId = uuidv4();
    const clientIp = request.ip;
    
    logger.info(`🔌 Nouvelle connexion WebSocket: ${connectionId} depuis ${clientIp}`);

    // Configuration initiale de la connexion
    const conn: AuthenticatedConnection = {
      id: connectionId,
      socket: connection.socket,
      userId: null,
      isAuthenticated: false,
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        userAgent: request.headers['user-agent'] || 'Unknown',
        ip: clientIp
      }
    };

    this.connections.set(connectionId, conn);

    // Gestionnaires d'événements
    connection.socket.on('message', async (data: Buffer) => {
      await this.handleMessage(connectionId, data);
    });

    connection.socket.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    connection.socket.on('error', (error) => {
      logger.error(`❌ Erreur WebSocket ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
    });

    // Demander l'authentification
    this.sendToConnection(connectionId, {
      type: WebSocketEventType.AUTH_REQUIRED,
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

      // Vérifier l'authentification pour les messages protégés
      if (!conn.isAuthenticated && message.type !== WebSocketEventType.AUTH_REQUEST) {
        this.sendToConnection(connectionId, {
          type: WebSocketEventType.ERROR,
          data: { message: 'Not authenticated' },
          timestamp: new Date()
        });
        return;
      }

      // Router les messages selon leur type
      switch (message.type) {
        case WebSocketEventType.AUTH_REQUEST:
          await this.handleAuthentication(connectionId, message.data);
          break;

        case WebSocketEventType.MESSAGE_SEND:
          await this.handleMessageSend(connectionId, message.data as MessageData);
          break;

        case WebSocketEventType.MESSAGE_TRANSLATE:
          await this.handleMessageTranslation(connectionId, message.data as MessageTranslationData);
          break;

        case WebSocketEventType.TYPING_START:
          await this.handleTypingStart(connectionId, message.data as TypingData);
          break;

        case WebSocketEventType.TYPING_STOP:
          await this.handleTypingStop(connectionId, message.data as TypingData);
          break;

        case WebSocketEventType.CONVERSATION_JOIN:
          await this.handleConversationJoin(connectionId, message.data as ConversationData);
          break;

        case WebSocketEventType.CONVERSATION_LEAVE:
          await this.handleConversationLeave(connectionId, message.data as ConversationData);
          break;

        case WebSocketEventType.PRESENCE_UPDATE:
          await this.handlePresenceUpdate(connectionId, message.data as UserPresenceData);
          break;

        default:
          logger.warn(`⚠️ Type de message non supporté: ${message.type}`);
          this.sendToConnection(connectionId, {
            type: WebSocketEventType.ERROR,
            data: { message: `Unsupported message type: ${message.type}` },
            timestamp: new Date()
          });
      }

    } catch (error) {
      logger.error(`❌ Erreur traitement message ${connectionId}:`, error);
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.ERROR,
        data: { message: 'Invalid message format' },
        timestamp: new Date()
      });
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
      const jwtSecret = process.env.JWT_SECRET || 'default-secret';
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };

      // Vérifier que l'utilisateur existe
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, username: true, isActive: true, preferredLanguage: true }
      });

      if (!user || !user.isActive) {
        throw new Error('Utilisateur non trouvé ou inactif');
      }

      // Mettre à jour la connexion
      conn.userId = user.id;
      conn.isAuthenticated = true;

      // Ajouter à la map des connexions utilisateur
      if (!this.userConnections.has(user.id)) {
        this.userConnections.set(user.id, new Set());
      }
      this.userConnections.get(user.id)!.add(connectionId);

      // Confirmer l'authentification
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.AUTH_SUCCESS,
        data: { 
          userId: user.id,
          username: user.username,
          preferredLanguage: user.preferredLanguage,
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
        conn.socket.close();
      }, 1000);
    }
  }

  /**
   * Gère l'envoi de messages avec traduction automatique
   */
  private async handleMessageSend(connectionId: string, data: MessageData): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    try {
      // Vérifier que l'utilisateur peut envoyer dans cette conversation
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: data.conversationId,
          participants: {
            some: { userId: conn.userId }
          }
        },
        include: {
          participants: {
            include: { 
              user: {
                select: { id: true, username: true, email: true, preferredLanguage: true }
              }
            }
          }
        }
      });

      if (!conversation) {
        throw new Error('Conversation non trouvée ou accès refusé');
      }

      // Créer le message en base
      const message = await this.prisma.message.create({
        data: {
          id: uuidv4(),
          content: data.content,
          senderId: conn.userId,
          conversationId: data.conversationId,
          messageType: data.messageType || 'text',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          sender: {
            select: { id: true, username: true, email: true }
          }
        }
      });

      // Préparer les données du message
      const messageData: MessageData = {
        messageId: message.id,
        conversationId: data.conversationId,
        content: data.content,
        senderId: conn.userId,
        senderUsername: message.sender.username,
        messageType: data.messageType || 'text',
        timestamp: message.createdAt
      };

      // Diffuser le message à tous les participants
      const participantIds = conversation.participants.map(p => p.userId);
      this.broadcastToUsers(participantIds, {
        type: WebSocketEventType.MESSAGE_RECEIVED,
        data: messageData,
        timestamp: new Date()
      });

      // Traduction automatique si nécessaire
      if (conversation.participants.length > 1) {
        await this.handleAutoTranslation(
          message.id, 
          data.content, 
          data.conversationId, 
          conversation.participants
        );
      }

      logger.info(`💬 Message envoyé dans conversation ${data.conversationId} par ${conn.userId}`);

    } catch (error) {
      logger.error(`❌ Erreur envoi message ${connectionId}:`, error);
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.ERROR,
        data: { message: 'Failed to send message' },
        timestamp: new Date()
      });
    }
  }

  /**
   * Gère la traduction manuelle de messages
   */
  private async handleMessageTranslation(connectionId: string, data: MessageTranslationData): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    try {
      logger.info(`🌐 Demande de traduction: message ${data.messageId} vers ${data.targetLanguages.join(', ')}`);

      // Récupérer le message original
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        include: {
          conversation: {
            include: {
              participants: true
            }
          }
        }
      });

      if (!message) {
        throw new Error('Message non trouvé');
      }

      // Vérifier l'accès à la conversation
      const hasAccess = message.conversation.participants.some(p => p.userId === conn.userId);
      if (!hasAccess) {
        throw new Error('Accès refusé à ce message');
      }

      // Effectuer la traduction
      const client = await getZMQClient();
      const translationResult = await client.translateToMultipleLanguages(
        message.content,
        data.sourceLanguage || 'auto',
        data.targetLanguages
      );

      if (!translationResult || translationResult.length === 0) {
        throw new Error('Échec de la traduction');
      }

      // Sauvegarder les traductions en base
      const translations = await Promise.all(
        translationResult.map(async (translation: any) => {
          return await this.prisma.messageTranslation.create({
            data: {
              id: uuidv4(),
              messageId: data.messageId,
              targetLanguage: 'auto', // TODO: récupérer la vraie langue cible
              translatedContent: translation.translatedText,
              sourceLanguage: translation.detectedSourceLanguage,
              translationModel: translation.metadata?.modelUsed || 'basic',
              cacheKey: `${data.messageId}_${translation.detectedSourceLanguage}`,
              createdAt: new Date()
            }
          });
        })
      );

      // Envoyer les traductions au demandeur
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.MESSAGE_TRANSLATED,
        data: {
          messageId: data.messageId,
          sourceLanguage: translationResult.detected_source_language,
          translations: translations.map(t => ({
            language: t.targetLanguage,
            content: t.translatedContent,
            confidence: t.confidence,
            model: t.translationModel,
            fromCache: t.fromCache
          }))
        },
        timestamp: new Date()
      });

      logger.info(`✅ Traduction terminée pour message ${data.messageId}: ${translations.length} langues`);

    } catch (error) {
      logger.error(`❌ Erreur traduction message ${connectionId}:`, error);
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.ERROR,
        data: { message: 'Translation failed' },
        timestamp: new Date()
      });
    }
  }

  /**
   * Traduction automatique pour conversations multilingues
   */
  private async handleAutoTranslation(
    messageId: string, 
    content: string, 
    conversationId: string, 
    participants: any[]
  ): Promise<void> {
    try {
      // Collecter les langues cibles uniques des participants
      const targetLanguages = Array.from(new Set(
        participants
          .map(p => p.user.preferredLanguage)
          .filter((lang): lang is string => lang !== null && lang !== undefined)
      ));

      if (targetLanguages.length === 0) {
        return; // Pas de langues cibles configurées
      }

      logger.info(`🤖 Traduction automatique: ${targetLanguages.length} langues pour message ${messageId}`);

      // Effectuer la traduction
      const client = await getZMQClient();
      const translationResult = await client.translateToMultipleLanguages(
        content,
        'auto', // Détection auto de la langue source
        targetLanguages
      );

      if (!translationResult) {
        logger.warn(`⚠️ Échec traduction automatique pour message ${messageId}`);
        return;
      }

      // Sauvegarder les traductions automatiques
      const translations = await Promise.all(
        translationResult.map(async (translation) => {
          return await this.prisma.messageTranslation.create({
            data: {
              messageId,
              targetLanguage: translation.detectedSourceLanguage || 'auto',
              translatedContent: translation.translatedText,
              sourceLanguage: translation.detectedSourceLanguage || 'auto',
              translationModel: translation.metadata?.modelUsed || 'zmq-translator',
              cacheKey: `${messageId}-${translation.detectedSourceLanguage}`
            }
          });
        })
      );

      // Diffuser les traductions aux utilisateurs concernés
      for (const participant of participants) {
        // Note: preferredLanguage pourrait ne pas exister dans le schéma actuel
        const preferredLang = 'en'; // participant.user.preferredLanguage || 'en';
        const translation = translations.find(
          t => t.targetLanguage === preferredLang
        );

        if (translation) {
          this.broadcastToUsers([participant.userId], {
            type: WebSocketEventType.AUTO_TRANSLATION_RECEIVED,
            data: {
              messageId,
              targetLanguage: translation.targetLanguage,
              translatedContent: translation.translatedContent,
              model: translation.translationModel,
              sourceLanguage: translation.sourceLanguage
            },
            timestamp: new Date()
          });
        }
      }

      logger.info(`✅ Traduction automatique terminée pour message ${messageId}: ${translations.length} traductions`);

    } catch (error) {
      logger.error(`❌ Erreur traduction automatique message ${messageId}:`, error);
    }
  }

  /**
   * Gère les indicateurs de frappe
   */
  private async handleTypingStart(connectionId: string, data: TypingData): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    const { conversationId } = data;

    // Vérifier l'accès à la conversation
    const hasAccess = await this.checkConversationAccess(conn.userId, conversationId);
    if (!hasAccess) return;

    // Gérer le timeout de frappe
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Map());
    }

    const conversationTyping = this.typingUsers.get(conversationId)!;
    
    // Annuler l'ancien timeout s'il existe
    if (conversationTyping.has(conn.userId)) {
      clearTimeout(conversationTyping.get(conn.userId)!);
    }

    // Nouveau timeout (5 secondes)
    const timeout = setTimeout(() => {
      this.handleTypingStop(connectionId, data);
    }, 5000);

    conversationTyping.set(conn.userId, timeout);

    // Diffuser l'indicateur de frappe aux autres participants
    const participantIds = await this.getConversationParticipants(conversationId);
    const otherParticipants = participantIds.filter(id => id !== conn.userId);

    this.broadcastToUsers(otherParticipants, {
      type: WebSocketEventType.TYPING_START,
      data: {
        conversationId,
        userId: conn.userId,
        username: data.username || 'Unknown'
      },
      timestamp: new Date()
    });
  }

  /**
   * Gère l'arrêt des indicateurs de frappe
   */
  private async handleTypingStop(connectionId: string, data: TypingData): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    const { conversationId } = data;

    // Nettoyer le timeout
    if (this.typingUsers.has(conversationId)) {
      const conversationTyping = this.typingUsers.get(conversationId)!;
      if (conversationTyping.has(conn.userId)) {
        clearTimeout(conversationTyping.get(conn.userId)!);
        conversationTyping.delete(conn.userId);
      }
    }

    // Diffuser l'arrêt de frappe aux autres participants
    const participantIds = await this.getConversationParticipants(conversationId);
    const otherParticipants = participantIds.filter(id => id !== conn.userId);

    this.broadcastToUsers(otherParticipants, {
      type: WebSocketEventType.TYPING_STOP,
      data: {
        conversationId,
        userId: conn.userId
      },
      timestamp: new Date()
    });
  }

  /**
   * Gère la connexion à une conversation
   */
  private async handleConversationJoin(connectionId: string, data: ConversationData): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    const { conversationId } = data;

    // Vérifier l'accès à la conversation
    const hasAccess = await this.checkConversationAccess(conn.userId, conversationId);
    if (!hasAccess) {
      this.sendToConnection(connectionId, {
        type: WebSocketEventType.ERROR,
        data: { message: 'Access denied to conversation' },
        timestamp: new Date()
      });
      return;
    }

    // Ajouter aux membres de la conversation
    if (!this.conversationMembers.has(conversationId)) {
      this.conversationMembers.set(conversationId, new Set());
    }
    this.conversationMembers.get(conversationId)!.add(conn.userId);

    // Confirmer la connexion
    this.sendToConnection(connectionId, {
      type: WebSocketEventType.CONVERSATION_JOINED,
      data: { conversationId },
      timestamp: new Date()
    });

    logger.info(`👥 Utilisateur ${conn.userId} a rejoint la conversation ${conversationId}`);
  }

  /**
   * Gère la déconnexion d'une conversation
   */
  private async handleConversationLeave(connectionId: string, data: ConversationData): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    const { conversationId } = data;

    // Retirer des membres de la conversation
    if (this.conversationMembers.has(conversationId)) {
      this.conversationMembers.get(conversationId)!.delete(conn.userId);
    }

    // Nettoyer les indicateurs de frappe
    if (this.typingUsers.has(conversationId)) {
      const conversationTyping = this.typingUsers.get(conversationId)!;
      if (conversationTyping.has(conn.userId)) {
        clearTimeout(conversationTyping.get(conn.userId)!);
        conversationTyping.delete(conn.userId);
      }
    }

    // Confirmer la déconnexion
    this.sendToConnection(connectionId, {
      type: WebSocketEventType.CONVERSATION_LEFT,
      data: { conversationId },
      timestamp: new Date()
    });

    logger.info(`👋 Utilisateur ${conn.userId} a quitté la conversation ${conversationId}`);
  }

  /**
   * Gère les mises à jour de présence
   */
  private async handlePresenceUpdate(connectionId: string, data: UserPresenceData): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.userId) return;

    try {
      // Mettre à jour le statut en base
      await this.prisma.user.update({
        where: { id: conn.userId },
        data: { 
          lastSeenAt: new Date(),
          status: data.status || 'online'
        }
      });

      // Diffuser le changement de statut aux contacts
      // TODO: Implémenter la logique des contacts/amis

      logger.info(`👤 Statut mis à jour pour ${conn.userId}: ${data.status}`);

    } catch (error) {
      logger.error(`❌ Erreur mise à jour présence ${connectionId}:`, error);
    }
  }

  /**
   * Gère la déconnexion d'un client
   */
  private handleDisconnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    logger.info(`🔌 Déconnexion WebSocket: ${connectionId}`);

    // Nettoyer les connexions utilisateur
    if (conn.userId && this.userConnections.has(conn.userId)) {
      this.userConnections.get(conn.userId)!.delete(connectionId);
      if (this.userConnections.get(conn.userId)!.size === 0) {
        this.userConnections.delete(conn.userId);
      }
    }

    // Nettoyer les membres de conversation
    for (const [conversationId, members] of this.conversationMembers.entries()) {
      if (conn.userId) {
        members.delete(conn.userId);
      }
    }

    // Nettoyer les indicateurs de frappe
    for (const [conversationId, typingMap] of this.typingUsers.entries()) {
      if (conn.userId && typingMap.has(conn.userId)) {
        clearTimeout(typingMap.get(conn.userId)!);
        typingMap.delete(conn.userId);
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
   * Diffuse un message à plusieurs utilisateurs
   */
  private broadcastToUsers(userIds: string[], message: WebSocketMessage): void {
    for (const userId of userIds) {
      const connectionIds = this.userConnections.get(userId);
      if (connectionIds) {
        for (const connectionId of connectionIds) {
          this.sendToConnection(connectionId, message);
        }
      }
    }
  }

  /**
   * Vérifie l'accès d'un utilisateur à une conversation
   */
  private async checkConversationAccess(userId: string, conversationId: string): Promise<boolean> {
    try {
      const participation = await this.prisma.conversationParticipant.findFirst({
        where: {
          userId,
          conversationId
        }
      });
      return !!participation;
    } catch (error) {
      logger.error(`❌ Erreur vérification accès conversation:`, error);
      return false;
    }
  }

  /**
   * Récupère les participants d'une conversation
   */
  private async getConversationParticipants(conversationId: string): Promise<string[]> {
    try {
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true }
      });
      return participants.map(p => p.userId);
    } catch (error) {
      logger.error(`❌ Erreur récupération participants conversation:`, error);
      return [];
    }
  }

  /**
   * Statistiques des connexions
   */
  public getStats(): any {
    return {
      totalConnections: this.connections.size,
      authenticatedConnections: Array.from(this.connections.values()).filter(c => c.isAuthenticated).length,
      activeConversations: this.conversationMembers.size,
      translationServiceReady: true // Pas de méthode isReady() disponible pour l'instant
    };
  }
}

// Instance singleton
export const advancedWebSocketHandler = new MeeshyAdvancedWebSocketHandler();

export default advancedWebSocketHandler;
