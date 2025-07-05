import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto, JoinConversationDto, CreateConversationLinkDto } from '../shared/dto';
import { ConversationResponse } from '../shared/interfaces';
import { USER_SELECT_FIELDS } from '../shared/constants';

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

    return conversationsWithLinks.map(link => this.formatConversationResponse(link.conversation));
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

  private async getConversationWithDetails(conversationId: string) {
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

    return conversation ? this.formatConversationResponse(conversation) : null;
  }

  private formatConversationResponse(conversation: any): ConversationResponse {
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
      lastMessage: conversation.messages?.[0] ? {
        id: conversation.messages[0].id,
        conversationId: conversation.id,
        senderId: conversation.messages[0].senderId,
        content: conversation.messages[0].content,
        originalLanguage: conversation.messages[0].originalLanguage || 'fr',
        isEdited: conversation.messages[0].isEdited || false,
        editedAt: conversation.messages[0].editedAt,
        createdAt: conversation.messages[0].createdAt,
        updatedAt: conversation.messages[0].updatedAt,
        sender: {
          id: conversation.messages[0].sender?.id || conversation.messages[0].senderId,
          username: conversation.messages[0].sender?.username || 'unknown',
          firstName: conversation.messages[0].sender?.firstName || '',
          lastName: conversation.messages[0].sender?.lastName || '',
          displayName: conversation.messages[0].sender?.displayName,
          email: conversation.messages[0].sender?.email || '',
          phoneNumber: conversation.messages[0].sender?.phoneNumber,
          systemLanguage: conversation.messages[0].sender?.systemLanguage || 'fr',
          regionalLanguage: conversation.messages[0].sender?.regionalLanguage || 'fr',
          customDestinationLanguage: conversation.messages[0].sender?.customDestinationLanguage,
          autoTranslateEnabled: conversation.messages[0].sender?.autoTranslateEnabled || true,
          translateToSystemLanguage: conversation.messages[0].sender?.translateToSystemLanguage || true,
          translateToRegionalLanguage: conversation.messages[0].sender?.translateToRegionalLanguage || false,
          useCustomDestination: conversation.messages[0].sender?.useCustomDestination || false,
          isOnline: conversation.messages[0].sender?.isOnline || false,
          avatar: conversation.messages[0].sender?.avatar,
          lastSeen: conversation.messages[0].sender?.lastSeen,
          createdAt: conversation.messages[0].sender?.createdAt || new Date(),
          lastActiveAt: conversation.messages[0].sender?.lastActiveAt || new Date(),
        },
      } : undefined,
      unreadCount: 0, // TODO: Calculer le nombre de messages non lus
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
      conversation: this.formatConversationResponse(shareLink.conversation),
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
            userId,
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

    return conversations.map(conversation => ({
      id: conversation.id,
      type: conversation.type as any,
      title: conversation.title || undefined,
      description: conversation.description || undefined,
      isGroup: true,
      isPrivate: false,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessage: conversation.messages[0] || null,
      unreadCount: 0, // TODO: Calculer le nombre de messages non lus
      participants: conversation.links.map(link => ({
        id: link.id,
        conversationId: link.conversationId,
        userId: link.userId,
        role: link.role as any,
        joinedAt: link.joinedAt,
        leftAt: link.leftAt,
        isAdmin: link.isAdmin,
        isModerator: link.isModerator,
        user: link.user,
      })),
    }));
  }
}
