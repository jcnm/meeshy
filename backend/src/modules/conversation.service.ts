import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto, JoinConversationDto, CreateConversationLinkDto } from '../shared/dto';
import { ConversationResponse, MessageResponse, ConversationType, ParticipantRole } from '../shared/interfaces';
import { USER_SELECT_FIELDS } from '../shared/constants';
import { mapPrismaUser } from '../common/user-mapper';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  async create(createConversationDto: CreateConversationDto, creatorId: string) {
    const { type, title, description, participantIds = [] } = createConversationDto;

    // Ajouter le créateur aux participants s'il n'y est pas déjà
    const allParticipants = participantIds.includes(creatorId) 
      ? participantIds 
      : [creatorId, ...participantIds];

    // Créer la conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        type,
        title,
        description,
      },
    });

    // Ajouter les liens de conversation
    const links = allParticipants.map((userId) => ({
      conversationId: conversation.id,
      userId,
      isAdmin: userId === creatorId,
      role: userId === creatorId ? 'admin' : 'member',
    }));

    await this.prisma.conversationLink.createMany({
      data: links,
    });

    return this.getConversationWithDetails(conversation.id);
  }

  async findUserConversations(userId: string): Promise<ConversationResponse[]> {
    const conversationsWithLinks = await this.prisma.conversationLink.findMany({
      where: {
        userId,
        leftAt: null, // N'inclure que les conversations non quittées
      },
      include: {
        conversation: {
          include: {
            links: {
              include: {
                user: {
                  select: USER_SELECT_FIELDS,
                },
              },
              where: {
                leftAt: null,
              },
            },
            messages: {
              take: 1,
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                sender: {
                  select: {
                    username: true,
                  },
                },
              },
            },
            group: {
              include: {
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          updatedAt: 'desc',
        },
      },
    });

    const conversations = await Promise.all(
      conversationsWithLinks.map(async (link) => 
        await this.formatConversationResponse(link.conversation, userId)
      )
    );
    
    return conversations;
  }

  async findOne(id: string, userId: string) {
    const link = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId,
        },
        leftAt: null,
      },
    });

    if (!link) {
      throw new NotFoundException('Conversation non trouvée ou accès refusé');
    }

    return this.getConversationWithDetails(id);
  }

  async join(joinConversationDto: JoinConversationDto, userId: string) {
    const { conversationId } = joinConversationDto;

    // Vérifier si la conversation existe
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        group: true,
      },
    });

    if (!conversation || !conversation.isActive) {
      throw new NotFoundException('Conversation non trouvée ou inactive');
    }

    // Vérifier si l'utilisateur n'est pas déjà dans la conversation
    const existingLink = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (existingLink) {
      if (existingLink.leftAt) {
        // L'utilisateur était parti, le remettre
        await this.prisma.conversationLink.update({
          where: { id: existingLink.id },
          data: {
            leftAt: null,
            joinedAt: new Date(),
          },
        });
      }
      return this.getConversationWithDetails(conversationId);
    }

    // Pour les groupes publics ou avec invitation
    if (conversation.group?.isPublic || joinConversationDto.linkId) {
      await this.prisma.conversationLink.create({
        data: {
          conversationId,
          userId,
          role: 'member',
        },
      });

      return this.getConversationWithDetails(conversationId);
    }

    throw new ForbiddenException('Impossible de rejoindre cette conversation');
  }

  async leave(conversationId: string, userId: string) {
    const link = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversationId,
          userId,
        },
        leftAt: null,
      },
    });

    if (!link) {
      throw new NotFoundException('Vous n\'êtes pas dans cette conversation');
    }

    await this.prisma.conversationLink.update({
      where: { id: link.id },
      data: {
        leftAt: new Date(),
      },
    });

    return { message: 'Conversation quittée avec succès' };
  }

  async updateLastActivity(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  private async getConversationWithDetails(conversationId: string, viewerId?: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        links: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isOnline: true,
              },
            },
          },
          where: {
            leftAt: null,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            sender: {
              select: {
                username: true,
              },
            },
          },
        },
        group: {
          include: {
            members: true,
          },
        },
      },
    });

    return conversation ? await this.formatConversationResponse(conversation, viewerId || 'system') : null;
  }

  private async formatConversationResponse(conversation: any, userId: string): Promise<ConversationResponse> {
    const unreadCount = await this.calculateUnreadCount(conversation.id, userId);
    
    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      name: conversation.title, // Alias pour compatibilité
      description: conversation.description,
      isGroup: conversation.type === 'group',
      isPrivate: !conversation.group?.isPublic,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participants: conversation.links?.map((link: any) => ({
        id: link.id,
        conversationId: link.conversationId,
        userId: link.userId,
        joinedAt: link.joinedAt,
        role: (link.role === 'admin' ? 'ADMIN' : 'MEMBER') as 'ADMIN' | 'MEMBER',
        user: {
          id: link.user.id,
          username: link.user.username,
          firstName: link.user.firstName || '',
          lastName: link.user.lastName || '',
          displayName: link.user.displayName,
          email: link.user.email,
          phoneNumber: link.user.phoneNumber,
          systemLanguage: link.user.systemLanguage,
          regionalLanguage: link.user.regionalLanguage,
          customDestinationLanguage: link.user.customDestinationLanguage,
          autoTranslateEnabled: link.user.autoTranslateEnabled,
          translateToSystemLanguage: link.user.translateToSystemLanguage,
          translateToRegionalLanguage: link.user.translateToRegionalLanguage,
          useCustomDestination: link.user.useCustomDestination,
          isOnline: link.user.isOnline,
          avatar: link.user.avatar,
          lastSeen: link.user.lastSeen,
          createdAt: link.user.createdAt,
          lastActiveAt: link.user.lastActiveAt,
        },
      })) || [],
      lastMessage: conversation.messages?.[0] ? this.formatMessageResponse(conversation.messages[0]) : undefined,
      unreadCount,
    };
  }

  private formatMessageResponse(message: any): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      originalLanguage: message.originalLanguage || 'fr',
      isEdited: message.isEdited || false,
      editedAt: message.editedAt || undefined,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      senderName: message.sender?.displayName || message.sender?.username || 'unknown',
      senderAvatar: message.sender?.avatar || undefined,
      isDeleted: message.isDeleted || false,
    };
  }

  async findUserConversationLinks(userId: string) {
    // Récupérer les liens de conversation créés par l'utilisateur
    const links = await this.prisma.conversationShareLink.findMany({
      where: {
        conversation: {
          links: {
            some: {
              userId,
              leftAt: null,
            }
          }
        },
        isActive: true,
      },
      include: {
        conversation: {
          include: {
            links: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    return links;
  }

  async createConversationLink(createLinkDto: CreateConversationLinkDto, creatorId: string) {
    const { conversationId, maxUses, expiresAt } = createLinkDto;

    // Vérifier que l'utilisateur est membre de la conversation
    const userLink = await this.prisma.conversationLink.findFirst({
      where: {
        conversationId,
        userId: creatorId,
        leftAt: null,
      }
    });

    if (!userLink) {
      throw new ForbiddenException('Vous n\'êtes pas membre de cette conversation');
    }

    // Créer le lien de partage
    const shareLink = await this.prisma.conversationShareLink.create({
      data: {
        linkId: userLink.id,
        conversationId,
        createdBy: creatorId,
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        currentUses: 0,
      },
      include: {
        conversation: {
          include: {
            links: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    return shareLink;
  }

  async getConversationByLinkId(linkId: string) {
    const shareLink = await this.prisma.conversationShareLink.findUnique({
      where: { linkId },
      include: {
        conversation: {
          include: {
            links: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    avatar: true,
                    isOnline: true,
                  },
                },
              },
              where: {
                leftAt: null,
              },
            },
            messages: {
              take: 1,
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                sender: {
                  select: {
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
            group: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        avatar: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    if (!shareLink) {
      throw new NotFoundException('Lien de conversation introuvable');
    }

    return {
      id: shareLink.id,
      linkId: shareLink.linkId,
      conversationId: shareLink.conversationId,
      isActive: shareLink.isActive,
      currentUses: shareLink.currentUses,
      maxUses: shareLink.maxUses,
      expiresAt: shareLink.expiresAt,
      createdAt: shareLink.createdAt,
      conversation: await this.formatConversationResponse(shareLink.conversation, 'system'),
      creator: shareLink.creator,
    };
  }

  async findGroupConversations(groupId: string, userId: string): Promise<ConversationResponse[]> {
    // Vérifier que l'utilisateur est membre du groupe
    const groupMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!groupMember) {
      throw new ForbiddenException('Vous n\'êtes pas membre de ce groupe');
    }

    // Récupérer toutes les conversations du groupe
    const conversations = await this.prisma.conversation.findMany({
      where: {
        groupId,
        isActive: true,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: USER_SELECT_FIELDS,
            },
          },
        },
        links: {
          where: {
            leftAt: null,
          },
          include: {
            user: {
              select: USER_SELECT_FIELDS,
            },
          },
        },
        group: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mapper les conversations avec gestion correcte des types et calcul des messages non lus
    return Promise.all(conversations.map(async (conversation) => {
      const unreadCount = await this.calculateUnreadCount(conversation.id, userId);
      
      return {
        id: conversation.id,
        type: conversation.type as ConversationType,
        title: conversation.title || undefined,
        description: conversation.description || undefined,
        isGroup: true,
        isPrivate: false,
        isActive: conversation.isActive,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastMessage: conversation.messages[0] ? this.formatMessageResponse(conversation.messages[0]) : undefined,
        unreadCount,
        participants: conversation.links.map(link => ({
          id: link.id,
          conversationId: link.conversationId,
          userId: link.userId,
          role: link.role as ParticipantRole,
          joinedAt: link.joinedAt,
          leftAt: link.leftAt || undefined,
          isAdmin: link.isAdmin,
          isModerator: link.isModerator,
          user: mapPrismaUser(link.user),
        })),
      };
    }));
  }

  /**
   * Calcule le nombre de messages non lus dans une conversation pour un utilisateur
   */
  private async calculateUnreadCount(conversationId: string, userId: string): Promise<number> {
    // Récupérer le lien de conversation pour obtenir les infos de lecture
    const link = await this.prisma.conversationLink.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!link) {
      return 0;
    }

    // Compter les messages créés après que l'utilisateur ait rejoint la conversation
    // et qui ne sont pas envoyés par l'utilisateur lui-même
    const where = {
      conversationId,
      isDeleted: false,
      senderId: { not: userId }, // Ne pas compter ses propres messages
      createdAt: { gt: link.joinedAt }
    };

    return this.prisma.message.count({ where });
  }
}
