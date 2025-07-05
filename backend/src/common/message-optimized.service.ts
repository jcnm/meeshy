import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { MessageResponse } from '../shared/interfaces';

@Injectable()
export class MessageServiceOptimized {
  private readonly logger = new Logger(MessageServiceOptimized.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Version optimisée : récupère les messages d'une conversation avec pagination et cache
   */
  async findConversationMessagesOptimized(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<MessageResponse[]> {
    const cacheKey = CacheService.Keys.CONVERSATION_MESSAGES(conversationId, page);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        this.logger.debug(`Fetching messages for conversation ${conversationId}, page ${page} from database`);

        const messages = await this.prisma.message.findMany({
          where: {
            conversationId,
            isDeleted: false,
          },
          select: {
            id: true,
            content: true,
            senderId: true,
            originalLanguage: true,
            isEdited: true,
            editedAt: true,
            isDeleted: true,
            replyToId: true,
            createdAt: true,
            updatedAt: true,
            sender: {
              select: {
                username: true,
                displayName: true,
                avatar: true,
              },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                senderId: true,
                sender: {
                  select: {
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: (page - 1) * limit,
          take: limit,
        });

        return messages.map(message => ({
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          senderName: message.sender.displayName || message.sender.username,
          senderAvatar: message.sender.avatar || undefined,
          originalLanguage: message.originalLanguage || 'fr',
          isEdited: message.isEdited,
          editedAt: message.editedAt || undefined,
          isDeleted: message.isDeleted,
          conversationId,
          replyTo: message.replyTo ? {
            id: message.replyTo.id,
            content: message.replyTo.content,
            senderName: message.replyTo.sender.displayName || message.replyTo.sender.username,
          } : undefined,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        }));
      },
      CacheService.TTL.SHORT // Messages plus volatiles, cache plus court
    );
  }

  /**
   * Invalide le cache des messages d'une conversation
   */
  invalidateConversationMessagesCache(conversationId: string): void {
    this.cache.deleteByPattern(`conversation:${conversationId}:messages:.*`);
  }

  /**
   * Ajoute un message et invalide le cache approprié
   */
  async createMessageOptimized(
    content: string,
    senderId: string,
    conversationId: string,
    originalLanguage: string = 'fr',
    replyToId?: string
  ) {
    const message = await this.prisma.message.create({
      data: {
        content,
        senderId,
        conversationId,
        originalLanguage,
        replyToId,
        isEdited: false,
        isDeleted: false,
      },
      select: {
        id: true,
        content: true,
        senderId: true,
        conversationId: true,
        originalLanguage: true,
        isEdited: true,
        editedAt: true,
        isDeleted: true,
        replyToId: true,
        createdAt: true,
        updatedAt: true,
        sender: {
          select: {
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            sender: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Invalider les caches appropriés
    this.invalidateConversationMessagesCache(conversationId);
    
    // Invalider le cache des conversations des participants (pour lastMessage)
    this.cache.deleteByPattern(`user:.*:conversations`);

    return {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderName: message.sender.displayName || message.sender.username,
      senderAvatar: message.sender.avatar || undefined,
      originalLanguage: message.originalLanguage,
      isEdited: message.isEdited,
      editedAt: message.editedAt || undefined,
      isDeleted: message.isDeleted,
      conversationId: message.conversationId,
      replyTo: message.replyTo ? {
        id: message.replyTo.id,
        content: message.replyTo.content,
        senderName: message.replyTo.sender.displayName || message.replyTo.sender.username,
      } : undefined,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    } as MessageResponse;
  }

  /**
   * Met à jour un message et invalide le cache
   */
  async updateMessageOptimized(
    messageId: string,
    content: string,
    userId: string
  ) {
    // Vérifier que l'utilisateur peut modifier ce message
    const existingMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, conversationId: true },
    });

    if (!existingMessage || existingMessage.senderId !== userId) {
      throw new Error('Message non trouvé ou non autorisé');
    }

    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true,
        editedAt: new Date(),
      },
      select: {
        id: true,
        content: true,
        senderId: true,
        conversationId: true,
        originalLanguage: true,
        isEdited: true,
        editedAt: true,
        isDeleted: true,
        replyToId: true,
        createdAt: true,
        updatedAt: true,
        sender: {
          select: {
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            sender: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Invalider les caches
    this.invalidateConversationMessagesCache(message.conversationId);
    this.cache.deleteByPattern(`user:.*:conversations`);

    return {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderName: message.sender.displayName || message.sender.username,
      senderAvatar: message.sender.avatar || undefined,
      originalLanguage: message.originalLanguage,
      isEdited: message.isEdited,
      editedAt: message.editedAt || undefined,
      isDeleted: message.isDeleted,
      conversationId: message.conversationId,
      replyTo: message.replyTo ? {
        id: message.replyTo.id,
        content: message.replyTo.content,
        senderName: message.replyTo.sender.displayName || message.replyTo.sender.username,
      } : undefined,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    } as MessageResponse;
  }

  /**
   * Supprime (soft delete) un message et invalide le cache
   */
  async deleteMessageOptimized(messageId: string, userId: string) {
    const existingMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, conversationId: true },
    });

    if (!existingMessage || existingMessage.senderId !== userId) {
      throw new Error('Message non trouvé ou non autorisé');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });

    // Invalider les caches
    this.invalidateConversationMessagesCache(existingMessage.conversationId);
    this.cache.deleteByPattern(`user:.*:conversations`);

    return { id: messageId, deleted: true };
  }
}
