/**
 * Gestionnaire Socket.IO pour Meeshy
 * Gestion des connexions, conversations et traductions en temps réel
 */

import { Server, Socket } from 'socket.io';
import { PrismaClient } from '../../libs/prisma/client';
import { TranslationService } from '../services/TranslationService';
import { ZMQTranslationClient } from '../services/zmq-translation-client';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Import des types partagés - SUPPRESSION DUPLICATION CODE
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketIOMessage,
  SocketIOUser,
  AuthenticatedSocket as BaseAuthenticatedSocket,
  TranslationEvent,
  TypingEvent,
  UserStatusEvent,
  SocketIOResponse
} from '../shared-types/socketio-events';

// Type étendu pour la gateway qui hérite de Socket.IO
type AuthenticatedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & BaseAuthenticatedSocket;

export class MeeshySocketIOManager {
  private io!: Server<ClientToServerEvents, ServerToClientEvents>;
  private authenticatedSockets: Map<string, AuthenticatedSocket> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>
  private conversationMembers: Map<string, Set<string>> = new Map(); // conversationId -> Set<userId>
  private typingTimeouts: Map<string, Map<string, NodeJS.Timeout>> = new Map(); // conversationId -> Map<userId, timeout>
  private translationService: TranslationService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwtSecret: string
  ) {
    // Initialiser le service de traduction
    const zmqClient = new ZMQTranslationClient();
    this.translationService = new TranslationService(this.prisma, zmqClient);
    this.translationService.initialize().catch((error) => 
      logger.error('Failed to initialize translation service', error)
    );
  }

  /**
   * Initialise le serveur Socket.IO
   */
  public initialize(server: any): void {
    this.io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3001",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Middleware d'authentification
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Token manquant'));
        }

        const decoded = jwt.verify(token, this.jwtSecret) as any;
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.userId }
        });

        if (!user) {
          return next(new Error('Utilisateur non trouvé'));
        }

        // Ajouter les données utilisateur au socket
        (socket as any).userId = user.id;
        (socket as any).username = user.username;
        (socket as any).userData = {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          systemLanguage: user.systemLanguage,
          regionalLanguage: user.regionalLanguage,
          customDestinationLanguage: user.customDestinationLanguage || undefined,
          autoTranslateEnabled: user.autoTranslateEnabled,
          translateToSystemLanguage: user.translateToSystemLanguage,
          translateToRegionalLanguage: user.translateToRegionalLanguage,
          useCustomDestination: user.useCustomDestination,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
        (socket as any).connectedAt = new Date();
        (socket as any).currentConversations = new Set();

        next();
      } catch (error) {
        logger.error('Erreur authentification Socket.IO:', error);
        next(new Error('Token invalide'));
      }
    });

    // Gestionnaire de connexions
    this.io.on('connection', (socket) => {
      this.handleConnection(socket as AuthenticatedSocket);
    });

    logger.info('✅ MeeshySocketIOManager initialisé');
  }

  /**
   * Gère une nouvelle connexion authentifiée
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const { userId, username } = socket;
    
    logger.info(`🔌 Nouvelle connexion Socket.IO: ${username} (${userId})`);

    // Enregistrer le socket
    this.authenticatedSockets.set(socket.id, socket);
    
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Mettre à jour le statut utilisateur
    this.updateUserOnlineStatus(userId, true);

    // Gestionnaires d'événements
    this.setupSocketEventHandlers(socket);

    // Gestionnaire de déconnexion
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Configure les gestionnaires d'événements pour un socket
   */
  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    // Envoi de message
    socket.on('message:send', async (data: { conversationId: string; content: string }, callback?: (response: SocketIOResponse<{ messageId: string }>) => void) => {
      try {
        const result = await this.handleNewMessage(socket, data);
        callback?.({ success: true, data: { messageId: result.messageId } });
      } catch (error) {
        logger.error('Erreur envoi message:', error);
        callback?.({ success: false, error: 'Erreur lors de l\'envoi du message' });
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Édition de message
    socket.on('message:edit', async (data: { messageId: string; content: string }, callback?: (response: SocketIOResponse) => void) => {
      try {
        await this.handleEditMessage(socket, data);
        callback?.({ success: true });
      } catch (error) {
        logger.error('Erreur édition message:', error);
        callback?.({ success: false, error: 'Erreur lors de l\'édition du message' });
      }
    });

    // Suppression de message
    socket.on('message:delete', async (data: { messageId: string }, callback?: (response: SocketIOResponse) => void) => {
      try {
        await this.handleDeleteMessage(socket, data);
        callback?.({ success: true });
      } catch (error) {
        logger.error('Erreur suppression message:', error);
        callback?.({ success: false, error: 'Erreur lors de la suppression du message' });
      }
    });

    // Rejoindre une conversation
    socket.on('conversation:join', (data: { conversationId: string }) => {
      this.handleJoinConversation(socket, data.conversationId);
    });

    // Quitter une conversation
    socket.on('conversation:leave', (data: { conversationId: string }) => {
      this.handleLeaveConversation(socket, data.conversationId);
    });

    // Événements de frappe
    socket.on('typing:start', (data: { conversationId: string }) => {
      this.handleTypingStart(socket, data.conversationId);
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      this.handleTypingStop(socket, data.conversationId);
    });

    // Statut utilisateur
    socket.on('user:status', (data: { isOnline: boolean }) => {
      this.updateUserOnlineStatus(socket.userId, data.isOnline);
    });
  }

  /**
   * Gère la création d'un nouveau message
   */
  private async handleNewMessage(socket: AuthenticatedSocket, data: { conversationId: string; content: string }): Promise<{ messageId: string }> {
    const { conversationId, content } = data;
    const { userId } = socket;

    logger.info(`📝 Nouveau message de ${socket.username} dans ${conversationId}`);

    // Vérifier l'accès à la conversation
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: { some: { userId } }
      },
      include: {
        members: { include: { user: true } }
      }
    });

    if (!conversation) {
      throw new Error('Conversation non trouvée ou accès refusé');
    }

    // Créer le message directement avec la langue de l'utilisateur
    const message = await this.prisma.message.create({
      data: {
        content,
        senderId: userId,
        conversationId,
        originalLanguage: socket.userData.systemLanguage // Utilise la langue système de l'utilisateur
      },
      include: {
        sender: true,
        conversation: true
      }
    });

    // Émettre le message aux participants de la conversation
    this.emitToConversation(conversationId, 'message:new', {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId || undefined,
      content: message.content,
      originalLanguage: message.originalLanguage,
      messageType: message.messageType,
      isEdited: message.isEdited,
      isDeleted: message.isDeleted,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender ? {
        id: message.sender.id,
        username: message.sender.username,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        email: message.sender.email,
        systemLanguage: message.sender.systemLanguage,
        regionalLanguage: message.sender.regionalLanguage,
        customDestinationLanguage: message.sender.customDestinationLanguage || undefined,
        autoTranslateEnabled: message.sender.autoTranslateEnabled,
        translateToSystemLanguage: message.sender.translateToSystemLanguage,
        translateToRegionalLanguage: message.sender.translateToRegionalLanguage,
        useCustomDestination: message.sender.useCustomDestination,
        isOnline: message.sender.isOnline,
        lastSeen: message.sender.lastSeen,
        createdAt: message.sender.createdAt,
        updatedAt: message.sender.updatedAt
      } : undefined
    } as SocketIOMessage);

    // Démarrer le processus de traduction en arrière-plan si nécessaire
    this.requestTranslation(message, conversation.members);

    return { messageId: message.id };
  }

  /**
   * Lance une requête de traduction pour un message
   */
  private async requestTranslation(message: any, conversationMembers: any[]): Promise<void> {
    try {
      logger.info(`🌐 Démarrage traduction pour message ${message.id}: "${message.content}"`);
      
      // Déterminer les langues nécessaires en excluant la langue source
      const requiredLanguages = this.getRequiredLanguages(conversationMembers, message.originalLanguage);
      logger.info(`🎯 Langues requises pour traduction:`, requiredLanguages);
      
      if (requiredLanguages.length > 0) {
        // Utiliser le ZMQ client directement pour traduction
        const zmqClient = new ZMQTranslationClient();
        await zmqClient.initialize();
        
        // Process translations asynchronously
        for (const targetLang of requiredLanguages) {
          try {
            logger.info(`🔄 Traduction ${message.originalLanguage} → ${targetLang} pour: "${message.content}"`);
            
            const translationResult = await zmqClient.translateText({
              messageId: message.id,
              text: message.content,
              sourceLanguage: message.originalLanguage,
              targetLanguage: targetLang,
              conversationId: message.conversationId,
              requestType: 'conversation_translation'
            });

            logger.info(`✅ Traduction reçue:`, {
              messageId: translationResult.messageId,
              translatedText: translationResult.translatedText,
              targetLanguage: targetLang
            });

            // Sauvegarder la traduction en cache
            const cacheKey = `${message.id}_${message.originalLanguage}_${targetLang}`;
            await this.prisma.messageTranslation.create({
              data: {
                messageId: message.id,
                sourceLanguage: message.originalLanguage,
                targetLanguage: targetLang,
                translatedContent: translationResult.translatedText,
                translationModel: translationResult.metadata?.modelUsed || 'basic',
                cacheKey,
                confidenceScore: translationResult.metadata?.confidenceScore
              }
            });

            // Émettre la traduction aux clients
            this.emitToConversation(message.conversationId, 'message:translation', {
              messageId: message.id,
              translations: [{
                messageId: message.id,
                sourceLanguage: message.originalLanguage,
                targetLanguage: targetLang,
                translatedContent: translationResult.translatedText,
                translationModel: translationResult.metadata?.modelUsed || 'basic',
                cacheKey,
                cached: false
              }]
            } as TranslationEvent);

            logger.info(`📤 Traduction émise pour message ${message.id} vers ${targetLang}`);
            
          } catch (error) {
            logger.error(`❌ Erreur traduction vers ${targetLang}:`, error);
            
            // Émettre une traduction d'erreur
            this.emitToConversation(message.conversationId, 'message:translation', {
              messageId: message.id,
              translations: [{
                messageId: message.id,
                sourceLanguage: message.originalLanguage,
                targetLanguage: targetLang,
                translatedContent: `[ERREUR-TRADUCTION] ${message.content}`,
                translationModel: 'error-fallback',
                cacheKey: `${message.id}_${message.originalLanguage}_${targetLang}`,
                cached: false
              }]
            });
          }
        }
      } else {
        logger.info(`ℹ️ Aucune traduction requise pour le message ${message.id}`);
      }
    } catch (error) {
      logger.error('❌ Erreur lors de la requête de traduction:', error);
    }
  }

  /**
   * Détermine les langues requises pour les membres d'une conversation
   */
  private getRequiredLanguages(members: any[], sourceLanguage: string): string[] {
    const languages = new Set<string>();
    
    logger.info(`🔍 Analyse des langues requises pour ${members.length} membres (langue source: ${sourceLanguage})`);
    
    members.forEach(member => {
      const user = member.user;
      logger.info(`👤 Utilisateur ${user.username}: système=${user.systemLanguage}, régional=${user.regionalLanguage}, auto=${user.autoTranslateEnabled}`);
      
      if (user.autoTranslateEnabled) {
        if (user.useCustomDestination && user.customDestinationLanguage) {
          // Ajouter la langue personnalisée si différente de la source
          if (user.customDestinationLanguage !== sourceLanguage) {
            languages.add(user.customDestinationLanguage);
            logger.info(`  ➕ Langue personnalisée ajoutée: ${user.customDestinationLanguage}`);
          }
        } else {
          // Ajouter la langue système si activée et différente de la source
          if (user.translateToSystemLanguage && user.systemLanguage !== sourceLanguage) {
            languages.add(user.systemLanguage);
            logger.info(`  ➕ Langue système ajoutée: ${user.systemLanguage}`);
          }
          // Ajouter la langue régionale si activée et différente de la source et système
          if (user.translateToRegionalLanguage && 
              user.regionalLanguage !== sourceLanguage && 
              user.regionalLanguage !== user.systemLanguage) {
            languages.add(user.regionalLanguage);  
            logger.info(`  ➕ Langue régionale ajoutée: ${user.regionalLanguage}`);
          }
        }
      }
    });
    
    const result = Array.from(languages);
    logger.info(`🎯 Langues finales requises:`, result);
    return result;
  }

  /**
   * Gère l'édition d'un message
   */
  private async handleEditMessage(socket: AuthenticatedSocket, data: { messageId: string; content: string }): Promise<void> {
    const { messageId, content } = data;
    const { userId } = socket;

    // Vérifier que l'utilisateur peut éditer ce message
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId
      }
    });

    if (!message) {
      throw new Error('Message non trouvé ou permission refusée');
    }

    // Mettre à jour le message
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { 
        content,
        updatedAt: new Date()
      },
      include: {
        sender: true,
        conversation: true
      }
    });

    // Émettre la modification
    this.emitToConversation(message.conversationId, 'message:edited', {
      id: updatedMessage.id,
      conversationId: updatedMessage.conversationId,
      senderId: updatedMessage.senderId || undefined,
      content: updatedMessage.content,
      originalLanguage: updatedMessage.originalLanguage,
      messageType: updatedMessage.messageType,
      isEdited: updatedMessage.isEdited,
      isDeleted: updatedMessage.isDeleted,
      createdAt: updatedMessage.createdAt,
      updatedAt: updatedMessage.updatedAt,
      sender: updatedMessage.sender ? {
        id: updatedMessage.sender.id,
        username: updatedMessage.sender.username,
        firstName: updatedMessage.sender.firstName,
        lastName: updatedMessage.sender.lastName,
        email: updatedMessage.sender.email,
        systemLanguage: updatedMessage.sender.systemLanguage,
        regionalLanguage: updatedMessage.sender.regionalLanguage,
        customDestinationLanguage: updatedMessage.sender.customDestinationLanguage || undefined,
        autoTranslateEnabled: updatedMessage.sender.autoTranslateEnabled,
        translateToSystemLanguage: updatedMessage.sender.translateToSystemLanguage,
        translateToRegionalLanguage: updatedMessage.sender.translateToRegionalLanguage,
        useCustomDestination: updatedMessage.sender.useCustomDestination,
        isOnline: updatedMessage.sender.isOnline,
        lastSeen: updatedMessage.sender.lastSeen,
        createdAt: updatedMessage.sender.createdAt,
        updatedAt: updatedMessage.sender.updatedAt
      } : undefined
    });
  }

  /**
   * Gère la suppression d'un message
   */
  private async handleDeleteMessage(socket: AuthenticatedSocket, data: { messageId: string }): Promise<void> {
    const { messageId } = data;
    const { userId } = socket;

    // Vérifier que l'utilisateur peut supprimer ce message
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId
      }
    });

    if (!message) {
      throw new Error('Message non trouvé ou permission refusée');
    }

    // Supprimer le message
    await this.prisma.message.delete({
      where: { id: messageId }
    });

    // Émettre la suppression
    this.emitToConversation(message.conversationId, 'message:deleted', {
      messageId,
      conversationId: message.conversationId
    });
  }

  /**
   * Gère l'adhésion à une conversation
   */
  private async handleJoinConversation(socket: AuthenticatedSocket, conversationId: string): Promise<void> {
    const { userId, username } = socket;

    // Vérifier l'accès à la conversation
    const hasAccess = await this.verifyConversationAccess(userId, conversationId);
    if (!hasAccess) {
      socket.emit('error', { message: 'Accès à la conversation refusé' });
      return;
    }

    // Rejoindre la room Socket.IO
    socket.join(conversationId);
    socket.currentConversations.add(conversationId);

    // Mettre à jour les membres de la conversation
    if (!this.conversationMembers.has(conversationId)) {
      this.conversationMembers.set(conversationId, new Set());
    }
    this.conversationMembers.get(conversationId)!.add(userId);

    // Notifier les autres membres
    socket.to(conversationId).emit('conversation:joined', {
      conversationId,
      userId
    });

    logger.info(`👥 ${username} a rejoint la conversation ${conversationId}`);
  }

  /**
   * Gère la sortie d'une conversation
   */
  private handleLeaveConversation(socket: AuthenticatedSocket, conversationId: string): void {
    const { userId, username } = socket;

    socket.leave(conversationId);
    socket.currentConversations.delete(conversationId);

    // Mettre à jour les membres
    const members = this.conversationMembers.get(conversationId);
    if (members) {
      members.delete(userId);
      if (members.size === 0) {
        this.conversationMembers.delete(conversationId);
      }
    }

    // Notifier les autres membres
    socket.to(conversationId).emit('conversation:left', {
      conversationId,
      userId
    });

    logger.info(`👋 ${username} a quitté la conversation ${conversationId}`);
  }

  /**
   * Gère le début de frappe
   */
  private handleTypingStart(socket: AuthenticatedSocket, conversationId: string): void {
    const { userId, username } = socket;

    // Émettre aux autres membres de la conversation
    socket.to(conversationId).emit('typing:start', {
      userId,
      username,
      conversationId
    });

    // Gérer le timeout automatique
    if (!this.typingTimeouts.has(conversationId)) {
      this.typingTimeouts.set(conversationId, new Map());
    }

    const conversationTimeouts = this.typingTimeouts.get(conversationId)!;
    
    // Annuler le timeout précédent s'il existe
    if (conversationTimeouts.has(userId)) {
      clearTimeout(conversationTimeouts.get(userId)!);
    }

    // Créer un nouveau timeout
    const timeout = setTimeout(() => {
      this.handleTypingStop(socket, conversationId);
    }, 5000); // Arrêt automatique après 5 secondes

    conversationTimeouts.set(userId, timeout);
  }

  /**
   * Gère l'arrêt de frappe
   */
  private handleTypingStop(socket: AuthenticatedSocket, conversationId: string): void {
    const { userId, username } = socket;

    // Émettre aux autres membres
    socket.to(conversationId).emit('typing:stop', {
      userId,
      username,
      conversationId
    });

    // Nettoyer le timeout
    const conversationTimeouts = this.typingTimeouts.get(conversationId);
    if (conversationTimeouts?.has(userId)) {
      clearTimeout(conversationTimeouts.get(userId)!);
      conversationTimeouts.delete(userId);
    }
  }

  /**
   * Gère la déconnexion d'un socket
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const { userId, username } = socket;

    logger.info(`🔌 Déconnexion Socket.IO: ${username} (${userId})`);

    // Nettoyer les références
    this.authenticatedSockets.delete(socket.id);
    
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(userId);
        // L'utilisateur n'a plus de connexions actives
        this.updateUserOnlineStatus(userId, false);
      }
    }

    // Quitter toutes les conversations
    socket.currentConversations.forEach(conversationId => {
      this.handleLeaveConversation(socket, conversationId);
    });

    // Nettoyer les timeouts de frappe
    for (const [conversationId, timeouts] of this.typingTimeouts.entries()) {
      if (timeouts.has(userId)) {
        clearTimeout(timeouts.get(userId)!);
        timeouts.delete(userId);
      }
    }
  }

  /**
   * Met à jour le statut en ligne d'un utilisateur
   */
  private async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeen: new Date()
        }
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (user) {
        // Émettre le changement de statut à tous les sockets connectés
        this.io.emit('user:status', {
          userId,
          username: user.username,
          isOnline
        });
      }
    } catch (error) {
      logger.error('Erreur mise à jour statut utilisateur:', error);
    }
  }

  /**
   * Vérifie l'accès d'un utilisateur à une conversation
   */
  private async verifyConversationAccess(userId: string, conversationId: string): Promise<boolean> {
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          members: { some: { userId } }
        }
      });

      return !!conversation;
    } catch (error) {
      logger.error('Erreur vérification accès conversation:', error);
      return false;
    }
  }

  /**
   * Émet un événement à tous les membres d'une conversation
   */
  private emitToConversation(
    conversationId: string, 
    event: string, 
    data: any
  ): void {
    (this.io.to(conversationId) as any).emit(event, data);
  }

  /**
   * Obtient les statistiques de connexion
   */
  public getStats(): any {
    return {
      connectedSockets: this.authenticatedSockets.size,
      connectedUsers: this.userSockets.size,
      activeConversations: this.conversationMembers.size,
      typingUsers: Array.from(this.typingTimeouts.entries()).reduce((acc, [convId, timeouts]) => {
        acc[convId] = timeouts.size;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Force la déconnexion d'un utilisateur
   */
  public disconnectUser(userId: string): void {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        const socket = this.authenticatedSockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      });
    }
  }
}
