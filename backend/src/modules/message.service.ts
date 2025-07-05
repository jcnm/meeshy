import { Injectable } from '@nestjs/common';
import { Message, ChatRoom } from '../types';

@Injectable()
export class MessageService {
  private messages: Map<string, Message> = new Map();
  private chatRooms: Map<string, ChatRoom> = new Map();

  createMessage(senderId: string, recipientId: string, content: string, originalLanguage: string): Message {
    const message: Message = {
      id: this.generateId(),
      senderId,
      recipientId,
      content,
      timestamp: new Date(),
      originalLanguage,
    };

    this.messages.set(message.id, message);
    this.addMessageToChatRoom(senderId, recipientId, message);

    return message;
  }

  private addMessageToChatRoom(senderId: string, recipientId: string, message: Message): void {
    const chatRoomId = this.getChatRoomId(senderId, recipientId);
    let chatRoom = this.chatRooms.get(chatRoomId);

    if (!chatRoom) {
      chatRoom = {
        id: chatRoomId,
        participantIds: [senderId, recipientId],
        messages: [],
        createdAt: new Date(),
      };
      this.chatRooms.set(chatRoomId, chatRoom);
    }

    chatRoom.messages.push(message);
  }

  getChatHistory(userId1: string, userId2: string): Message[] {
    const chatRoomId = this.getChatRoomId(userId1, userId2);
    const chatRoom = this.chatRooms.get(chatRoomId);
    return chatRoom ? chatRoom.messages : [];
  }

  getUserChatRooms(userId: string): ChatRoom[] {
    return Array.from(this.chatRooms.values())
      .filter(room => room.participantIds.includes(userId));
  }

  private getChatRoomId(userId1: string, userId2: string): string {
    // Créer un ID de chat room consistant en triant les IDs
    const sortedIds = [userId1, userId2].sort();
    return `${sortedIds[0]}_${sortedIds[1]}`;
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getMessageById(messageId: string): Message | undefined {
    return this.messages.get(messageId);
  }

  getRecentMessages(limit: number = 50): Message[] {
    const allMessages = Array.from(this.messages.values());
    return allMessages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}
