import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MessageService } from '../modules/message.service';
import { UserService } from '../modules/user.service';
import { NotificationService } from '../common/notification.service';
import { CreateMessageDto } from '../shared/dto';
import { TypingEvent, MessageEvent, UserStatusEvent, MessageResponse, UserRole } from '../shared/interfaces';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    role?: UserRole;
  };
}

// Nouveaux types pour les événements temps réel
interface NotificationEvent {
  id: string;
  type: 'message' | 'user_joined' | 'user_left' | 'role_changed' | 'system';
  title: string;
  message: string;
  userId: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

interface PresenceEvent {
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen?: Date;
  currentActivity?: string;
}

interface AdminEvent {
  type: 'user_role_changed' | 'user_banned' | 'user_deleted' | 'system_alert';
  adminId: string;
  targetUserId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3000'],
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private userSockets = new Map<string, string>(); // socketId -> userId
  private typingUsers = new Map<string, Set<string>>(); // conversationId -> Set<userId>

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private messageService: MessageService,
    private userService: UserService,
    private notificationService: NotificationService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraire le token JWT des headers ou query
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        client.disconnect();
        return;
      }

      // Vérifier le token JWT
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      // Associer l'utilisateur au socket
      client.userId = user.id;
      client.user = {
        id: user.id,
        username: user.displayName || user.username,
      };

      // Mettre à jour les maps de connexion
      this.connectedUsers.set(user.id, client.id);
      this.userSockets.set(client.id, user.id);

      // Mettre à jour le statut en ligne
      await this.userService.updateOnlineStatus(user.id, true);

      // Rejoindre les salles des conversations de l'utilisateur
      const userConversations = await this.prisma.conversationLink.findMany({
        where: {
          userId: user.id,
          leftAt: null,
        },
        select: {
          conversationId: true,
        },
      });

      for (const conv of userConversations) {
        client.join(`conversation:${conv.conversationId}`);
      }

      // Notifier les autres utilisateurs de la connexion
      this.broadcastUserStatus({
        userId: user.id,
        username: user.username,
        isOnline: true,
      });

      console.log(`👤 Utilisateur ${user.username} connecté (${client.id})`);
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.userSockets.get(client.id);
    
    if (userId) {
      // Nettoyer les maps
      this.connectedUsers.delete(userId);
      this.userSockets.delete(client.id);

      // Nettoyer les indicateurs de frappe
      for (const [conversationId, typingSet] of this.typingUsers.entries()) {
        if (typingSet.has(userId)) {
          typingSet.delete(userId);
          this.broadcastTyping({
            conversationId,
            userId,
            username: client.user?.username || 'Utilisateur',
            isTyping: false,
          });
        }
      }

      // Mettre à jour le statut hors ligne
      await this.userService.updateOnlineStatus(userId, false);

      // Notifier les autres utilisateurs de la déconnexion
      this.broadcastUserStatus({
        userId,
        username: client.user?.username || 'Utilisateur',
        isOnline: false,
        lastSeen: new Date(),
      });

      console.log(`👤 Utilisateur ${client.user?.username} déconnecté (${client.id})`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CreateMessageDto,
  ) {
    try {
      if (!client.userId) {
        return { error: 'Non authentifié' };
      }

      // Créer le message via le service
      const message = await this.messageService.create(data, client.userId);

      // Diffuser le message à tous les participants de la conversation
      const messageEvent: MessageEvent = {
        type: 'new_message',
        message,
        conversationId: data.conversationId,
      };

      this.server.to(`conversation:${data.conversationId}`).emit('newMessage', messageEvent);

      // Arrêter l'indicateur de frappe pour cet utilisateur
      this.stopTyping(data.conversationId, client.userId, client.user?.username || 'Utilisateur');

      return { success: true, message };
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      return { error: error instanceof Error ? error.message : 'Erreur inconnue' };
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    try {
      if (!client.userId) {
        return { error: 'Non authentifié' };
      }

      const message = await this.messageService.update(
        data.messageId,
        { content: data.content },
        client.userId,
      );

      // Diffuser la modification du message
      const messageEvent: MessageEvent = {
        type: 'message_edited',
        message,
        conversationId: message.conversationId,
      };

      this.server.to(`conversation:${message.conversationId}`).emit('messageEdited', messageEvent);

      return { success: true, message };
    } catch (error) {
      console.error('Erreur lors de la modification du message:', error);
      return { error: error instanceof Error ? error.message : 'Erreur inconnue' };
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      if (!client.userId) {
        return { error: 'Non authentifié' };
      }

      // Récupérer les infos du message avant suppression
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        select: { conversationId: true },
      });

      if (!message) {
        return { error: 'Message non trouvé' };
      }

      await this.messageService.delete(data.messageId, client.userId);

      // Diffuser la suppression du message
      const messageEvent: MessageEvent = {
        type: 'message_deleted',
        message: {
          id: data.messageId,
          conversationId: message.conversationId,
        } as MessageResponse,
        conversationId: message.conversationId,
      };

      this.server.to(`conversation:${message.conversationId}`).emit('messageDeleted', messageEvent);

      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error);
      return { error: error instanceof Error ? error.message : 'Erreur inconnue' };
    }
  }

  @SubscribeMessage('startTyping')
  async handleStartTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) return;

    this.startTyping(data.conversationId, client.userId, client.user?.username || 'Utilisateur');
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) return;

    this.stopTyping(data.conversationId, client.userId, client.user?.username || 'Utilisateur');
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) return;

    // Vérifier que l'utilisateur a accès à cette conversation
    const link = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId: data.conversationId,
          userId: client.userId,
        },
        leftAt: null,
      },
    });

    if (link) {
      client.join(`conversation:${data.conversationId}`);
      return { success: true };
    }

    return { error: 'Accès refusé à cette conversation' };
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
    
    // Arrêter l'indicateur de frappe si actif
    if (client.userId) {
      this.stopTyping(data.conversationId, client.userId, client.user?.username || 'Utilisateur');
    }

    return { success: true };
  }

  // Méthodes utilitaires
  private startTyping(conversationId: string, userId: string, username: string) {
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Set());
    }

    const typingSet = this.typingUsers.get(conversationId)!;
    typingSet.add(userId);

    this.broadcastTyping({
      conversationId,
      userId,
      username,
      isTyping: true,
    });

    // Auto-stop après 3 secondes d'inactivité
    setTimeout(() => {
      if (typingSet.has(userId)) {
        this.stopTyping(conversationId, userId, username);
      }
    }, 3000);
  }

  private stopTyping(conversationId: string, userId: string, username: string) {
    const typingSet = this.typingUsers.get(conversationId);
    if (typingSet && typingSet.has(userId)) {
      typingSet.delete(userId);
      
      this.broadcastTyping({
        conversationId,
        userId,
        username,
        isTyping: false,
      });
    }
  }

  private broadcastTyping(event: TypingEvent) {
    this.server.to(`conversation:${event.conversationId}`).emit('userTyping', event);
  }

  private broadcastUserStatus(event: UserStatusEvent) {
    this.server.emit('userStatusChanged', event);
  }

  // === NOUVELLES MÉTHODES POUR LE TEMPS RÉEL ===

  /**
   * Envoie une notification à un utilisateur spécifique
   */
  sendNotificationToUser(userId: string, notification: NotificationEvent) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('notification', notification);
    }
  }

  /**
   * Envoie une notification à tous les utilisateurs connectés
   */
  broadcastNotification(notification: NotificationEvent) {
    this.server.emit('notification', notification);
  }

  /**
   * Envoie un événement admin à tous les administrateurs connectés
   */
  broadcastAdminEvent(event: AdminEvent) {
    // Envoyer uniquement aux utilisateurs avec permissions admin
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      const socket = this.server.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.user?.role && ['BIGBOSS', 'ADMIN', 'MODO', 'AUDIT'].includes(socket.user.role)) {
        this.server.to(socketId).emit('adminEvent', event);
      }
    }
  }

  /**
   * Met à jour la présence d'un utilisateur
   */
  updateUserPresence(userId: string, activity?: string) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      const presenceEvent: PresenceEvent = {
        userId,
        username: '',
        isOnline: true,
        currentActivity: activity,
      };
      this.server.emit('userPresenceChanged', presenceEvent);
    }
  }

  /**
   * Gestion des événements de notification temps réel
   */
  @SubscribeMessage('markNotificationRead')
  async handleMarkNotificationRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    if (!client.userId) return { error: 'Non authentifié' };

    try {
      // Marquer la notification comme lue en supprimant de la base
      await this.notificationService.markAsRead(data.notificationId, client.userId);
      return { success: true };
    } catch (error) {
      console.error('Erreur lors du marquage de la notification:', error);
      return { error: 'Erreur lors du marquage de la notification' };
    }
  }

  /**
   * Gestion de la présence utilisateur
   */
  @SubscribeMessage('updateActivity')
  async handleUpdateActivity(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { activity: string },
  ) {
    if (!client.userId) return;

    this.updateUserPresence(client.userId, data.activity);
  }

  /**
   * Événement pour rejoindre la room admin
   */
  @SubscribeMessage('joinAdminRoom')
  async handleJoinAdminRoom(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return { error: 'Non authentifié' };

    // Vérifier les permissions admin
    const user = await this.prisma.user.findUnique({
      where: { id: client.userId },
      select: { id: true, username: true, role: true },
    });

    if (!user) return { error: 'Utilisateur non trouvé' };

    // Vérifier le rôle pour autoriser l'accès à la room admin
    const allowedRoles = ['BIGBOSS', 'ADMIN', 'MODO', 'AUDIT', 'ANALYST'];
    if (!allowedRoles.includes(user.role)) {
      return { error: 'Permissions insuffisantes pour accéder à la room admin' };
    }

    client.join('admin-room');
    return { success: true, role: user.role };
  }

  /**
   * Obtenir la liste des utilisateurs connectés
   */
  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return { error: 'Non authentifié' };

    const onlineUsers = Array.from(this.connectedUsers.keys());
    return { success: true, onlineUsers };
  }

  /**
   * Méthodes publiques pour être utilisées par d'autres services
   */

  /**
   * Notifie un changement de rôle utilisateur
   */
  async notifyRoleChange(userId: string, newRole: UserRole, adminId: string) {
    const notification: NotificationEvent = {
      id: `role-change-${Date.now()}`,
      type: 'role_changed',
      title: 'Rôle modifié',
      message: `Votre rôle a été mis à jour vers ${newRole}`,
      userId,
      data: { newRole, adminId },
      timestamp: new Date(),
    };

    this.sendNotificationToUser(userId, notification);

    const adminEvent: AdminEvent = {
      type: 'user_role_changed',
      adminId,
      targetUserId: userId,
      data: { newRole },
      timestamp: new Date(),
    };

    this.broadcastAdminEvent(adminEvent);
  }

  /**
   * Notifie qu'un utilisateur a rejoint une conversation
   */
  async notifyUserJoined(conversationId: string, userId: string, username: string) {
    const notification: NotificationEvent = {
      id: `user-joined-${Date.now()}`,
      type: 'user_joined',
      title: 'Nouvel utilisateur',
      message: `${username} a rejoint la conversation`,
      userId,
      data: { conversationId },
      timestamp: new Date(),
    };

    this.server.to(`conversation:${conversationId}`).emit('notification', notification);
  }

  /**
   * Obtient les statistiques de connexion en temps réel
   */
  getConnectionStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeConversations: this.typingUsers.size,
      totalSockets: this.server.sockets.sockets.size,
    };
  }

  /**
   * Diffuse un événement à tous les participants d'une conversation
   * Utilisé par les contrôleurs REST pour déclencher des événements WebSocket
   */
  broadcastToConversation(room: string, event: string, data: MessageEvent | TypingEvent | NotificationEvent | Record<string, unknown>) {
    console.log(`📡 Diffusion WebSocket - Room: ${room}, Event: ${event}`, data);
    this.server.to(room).emit(event, data);
  }
}
