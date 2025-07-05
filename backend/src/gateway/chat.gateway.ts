import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../modules/user.service';
import { MessageService } from '../modules/message.service';
import { SocketResponse, Message, User } from '../types';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3003', 'http://localhost:3002'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId

  constructor(
    private readonly userService: UserService,
    private readonly messageService: MessageService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      this.userService.setUserOffline(userId);
      this.userSockets.delete(userId);
      this.socketUsers.delete(client.id);
      
      // Notifier les autres utilisateurs que cet utilisateur est hors ligne
      this.server.emit('userStatusChanged', {
        userId,
        isOnline: false,
      });
    }
    
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('userLogin')
  async handleUserLogin(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<SocketResponse<User>> {
    try {
      const user = this.userService.getUserById(data.userId);
      if (!user) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      // Mettre à jour les mappings
      this.userSockets.set(data.userId, client.id);
      this.socketUsers.set(client.id, data.userId);
      
      // Marquer l'utilisateur comme en ligne
      this.userService.setUserOnline(data.userId);

      // Joindre le socket à une room personnelle
      client.join(`user_${data.userId}`);

      // Notifier les autres utilisateurs
      this.server.emit('userStatusChanged', {
        userId: data.userId,
        isOnline: true,
      });

      this.logger.log(`User ${user.username} logged in`);

      return { success: true, data: user };
    } catch (error) {
      this.logger.error('Erreur lors de la connexion utilisateur:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { recipientId: string; content: string; originalLanguage: string },
    @ConnectedSocket() client: Socket,
  ): Promise<SocketResponse<Message>> {
    try {
      const senderId = this.socketUsers.get(client.id);
      if (!senderId) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      const message = this.messageService.createMessage(
        senderId,
        data.recipientId,
        data.content,
        data.originalLanguage,
      );

      // Envoyer le message au destinataire s'il est en ligne
      const recipientSocketId = this.userSockets.get(data.recipientId);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('newMessage', message);
      }

      // Envoyer une confirmation à l'expéditeur
      client.emit('messageSent', message);

      this.logger.log(`Message sent from ${senderId} to ${data.recipientId}`);

      return { success: true, data: message };
    } catch (error) {
      this.logger.error('Erreur lors de l\'envoi du message:', error);
      return { success: false, error: 'Erreur d\'envoi du message' };
    }
  }

  @SubscribeMessage('getChatHistory')
  async handleGetChatHistory(
    @MessageBody() data: { otherUserId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<SocketResponse<Message[]>> {
    try {
      const userId = this.socketUsers.get(client.id);
      if (!userId) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      const messages = this.messageService.getChatHistory(userId, data.otherUserId);
      return { success: true, data: messages };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de l\'historique:', error);
      return { success: false, error: 'Erreur de récupération de l\'historique' };
    }
  }

  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
  ): Promise<SocketResponse<User[]>> {
    try {
      const onlineUsers = this.userService.getOnlineUsers();
      return { success: true, data: onlineUsers };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des utilisateurs en ligne:', error);
      return { success: false, error: 'Erreur de récupération des utilisateurs' };
    }
  }

  @SubscribeMessage('updateUserSettings')
  async handleUpdateUserSettings(
    @MessageBody() data: Partial<User>,
    @ConnectedSocket() client: Socket,
  ): Promise<SocketResponse<User>> {
    try {
      const userId = this.socketUsers.get(client.id);
      if (!userId) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      const updatedUser = this.userService.updateUserSettings(userId, data);
      if (!updatedUser) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      return { success: true, data: updatedUser };
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour des paramètres:', error);
      return { success: false, error: 'Erreur de mise à jour' };
    }
  }
}
