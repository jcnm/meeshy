import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto, UpdateMessageDto } from '../shared/dto';
import { MessageResponse } from '../shared/interfaces';
import { USER_SELECT_FIELDS } from '../shared/constants';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  // Fonction utilitaire pour la sélection complète des utilisateurs
  private getUserSelect() {
    return USER_SELECT_FIELDS;
  }

  async create(createMessageDto: CreateMessageDto, senderId: string): Promise<MessageResponse> {
    const { content, conversationId, originalLanguage, replyToId } = createMessageDto;

    // Vérifier que l'utilisateur est dans la conversation
    const link = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
        leftAt: null,
      },
    });

    if (!link) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à envoyer des messages dans cette conversation');
    }

    // Créer le message
    const message = await this.prisma.message.create({
      data: {
        content,
        conversationId,
        senderId,
        originalLanguage: originalLanguage || 'fr',
        replyToId,
      },
      include: {
        sender: {
          select: this.getUserSelect(),
        },
        replyTo: {
          include: {
            sender: {
              select: this.getUserSelect(),
            },
          },
        },
      },
    });

    // Mettre à jour l'activité de la conversation
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return this.formatMessageResponse(message);
  }

  async findByConversation(conversationId: string, userId: string, page = 1, limit = 50): Promise<MessageResponse[]> {
    // Vérifier que l'utilisateur a accès à la conversation
    const link = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
        leftAt: null,
      },
    });

    if (!link) {
      throw new ForbiddenException('Accès refusé à cette conversation');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
      },
      include: {
        sender: {
          select: this.getUserSelect(),
        },
        replyTo: {
          include: {
            sender: {
              select: this.getUserSelect(),
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

    return messages.reverse().map(message => this.formatMessageResponse(message));
  }

  async update(messageId: string, updateMessageDto: UpdateMessageDto, userId: string): Promise<MessageResponse> {
    // Vérifier que le message existe et appartient à l'utilisateur
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            username: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message non trouvé');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres messages');
    }

    if (message.isDeleted) {
      throw new ForbiddenException('Impossible de modifier un message supprimé');
    }

    // Mettre à jour le message
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: updateMessageDto.content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        replyTo: {
          include: {
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

    return this.formatMessageResponse(updatedMessage);
  }

  async delete(messageId: string, userId: string): Promise<void> {
    // Vérifier que le message existe et appartient à l'utilisateur
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            links: {
              where: {
                userId,
                role: { in: ['admin', 'moderator'] },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message non trouvé');
    }

    // Vérifier les permissions (propriétaire du message ou admin/modérateur)
    const isOwner = message.senderId === userId;
    const isAdminOrModerator = message.conversation.links.length > 0;

    if (!isOwner && !isAdminOrModerator) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à supprimer ce message');
    }

    // Marquer le message comme supprimé
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: '[Message supprimé]',
      },
    });
  }

  async search(conversationId: string, query: string, userId: string): Promise<MessageResponse[]> {
    // Vérifier l'accès à la conversation
    const link = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
        leftAt: null,
      },
    });

    if (!link) {
      throw new ForbiddenException('Accès refusé à cette conversation');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        content: {
          contains: query,
        },
      },
      include: {
        sender: {
          select: {
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        replyTo: {
          include: {
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
      take: 20,
    });

    return messages.map(message => this.formatMessageResponse(message));
  }

  private formatMessageResponse(message: {
    id: string;
    content: string;
    senderId: string;
    conversationId: string;
    originalLanguage: string;
    isEdited: boolean;
    editedAt: Date | null;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    sender: {
      username: string;
      displayName: string | null;
      avatar: string | null;
    };
    replyTo?: {
      id: string;
      content: string;
      sender: {
        username: string;
        displayName: string | null;
      };
    } | null;
  }): MessageResponse {
    return {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      conversationId: message.conversationId,
      senderName: message.sender.displayName || message.sender.username,
      senderAvatar: message.sender.avatar || undefined,
      originalLanguage: message.originalLanguage,
      isEdited: message.isEdited,
      editedAt: message.editedAt || undefined,
      isDeleted: message.isDeleted,
      replyTo: message.replyTo ? {
        id: message.replyTo.id,
        content: message.replyTo.content,
        senderName: message.replyTo.sender.displayName || message.replyTo.sender.username,
      } : undefined,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}
