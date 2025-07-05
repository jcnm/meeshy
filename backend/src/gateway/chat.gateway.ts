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
import { CreateMessageDto } from '../shared/dto';
import { TypingEvent, MessageEvent, UserStatusEvent, MessageResponse } from '../shared/interfaces';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
  };
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
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private userSockets = new Map<string, string>(); // socketId -> userId
  private typingUsers = new Map<string, Set<string>>(); // conversationId -> Set<userId>

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private messageService: MessageService,
    private userService: UserService,
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
      return { error: error.message };
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
      return { error: error.message };
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
      return { error: error.message };
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

  private broadcastTyping(typingEvent: TypingEvent) {
    this.server.to(`conversation:${typingEvent.conversationId}`).emit('typing', typingEvent);
  }

  private broadcastUserStatus(statusEvent: UserStatusEvent) {
    this.server.emit('userStatus', statusEvent);
  }

  // Méthode publique pour envoyer des notifications
  public notifyConversationUpdate(conversationId: string, event: Record<string, unknown>) {
    this.server.to(`conversation:${conversationId}`).emit('conversationUpdate', event);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
