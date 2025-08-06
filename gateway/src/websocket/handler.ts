/**
 * Gestionnaire WebSocket simplifié pour Meeshy
 * Version fonctionnelle avec gestion complète des événements temps réel
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '../../libs/prisma/client';
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
  ) {}

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

    // Timeout d'authentification (30 secondes)
    const authTimeout = setTimeout(() => {
      if (!authenticatedConnection) {
        connection.socket.close(1008, 'Authentication timeout');
      }
    }, 30000);

    // Gestionnaire de messages
    connection.socket.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'authenticate' && !authenticatedConnection) {
          authenticatedConnection = await this.authenticateConnection(
            connectionId, 
            connection, 
            data.token
          );
          
          if (authenticatedConnection) {
            clearTimeout(authTimeout);
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
          }
        } else if (authenticatedConnection) {
          await this.handleMessage(authenticatedConnection, data);
        } else {
          connection.socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Authentication required' }
          }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        connection.socket.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    // Gestionnaire de fermeture
    connection.socket.on('close', async () => {
      clearTimeout(authTimeout);
      if (authenticatedConnection) {
        await this.handleDisconnection(authenticatedConnection);
      }
    });

    // Gestionnaire d'erreur
    connection.socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
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
        connection.socket.send(JSON.stringify({
          type: 'error',
          data: { message: 'User not found' }
        }));
        return null;
      }

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
    switch (data.type) {
      case 'join_conversation':
        await this.handleJoinConversation(connection, data.conversationId);
        break;
        
      case 'leave_conversation':
        await this.handleLeaveConversation(connection, data.conversationId);
        break;
        
      case 'send_message':
        await this.handleSendMessage(connection, data);
        break;
        
      case 'typing_start':
        await this.handleTypingStart(connection, data.conversationId);
        break;
        
      case 'typing_stop':
        await this.handleTypingStop(connection, data.conversationId);
        break;
        
      case 'mark_read':
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
      type: 'conversation_joined',
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
      type: 'conversation_left',
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

      // Broadcaster aux membres de la conversation
      this.broadcastToConversation(conversationId, {
        type: 'message_received',
        data: {
          id: message.id,
          content: message.content,
          sender: message.sender,
          conversationId: message.conversationId,
          createdAt: message.createdAt,
          tempId
        }
      });

      // TODO: Envoyer au service de traduction via gRPC

    } catch (error) {
      console.error('Error sending message:', error);
      connection.socket.send(JSON.stringify({
        type: 'error',
        data: { message: 'Failed to send message' }
      }));
    }
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
      type: 'typing_status',
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
        type: 'message_read',
        data: {
          messageId,
          conversationId,
          userId: connection.userId,
          username: connection.username,
          readAt: new Date()
        }
      }, connection.userId);

    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  /**
   * Gère la déconnexion d'un utilisateur
   */
  private async handleDisconnection(connection: AuthenticatedWebSocket): Promise<void> {
    console.log(`User ${connection.username} disconnected`);

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
      type: 'typing_status',
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
    const members = this.conversationMembers.get(conversationId);
    if (!members) return;

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
              console.error(`Error sending to connection ${connId}:`, error);
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
      console.error('Error updating user online status:', error);
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
            console.error(`Error sending to user ${userId}:`, error);
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
}
