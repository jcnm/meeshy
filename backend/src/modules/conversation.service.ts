import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto, JoinConversationDto, ConversationResponse, CreateConversationLinkDto } from '../dto';

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

  private formatConversationResponse(conversation: {
    id: string;
    type: string;
    title: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    links: Array<{
      role: string;
      user: {
        id: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
        isOnline: boolean;
      };
    }>;
    messages: Array<{
      id: string;
      content: string;
      senderId: string;
      createdAt: Date;
    }>;
    group?: {
      id: string;
      title: string;
      description: string | null;
      image: string | null;
      isPublic: boolean;
      members?: Array<unknown>;
    } | null;
  }): ConversationResponse {
    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      description: conversation.description,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participants: conversation.links.map((link) => ({
        id: link.user.id,
        username: link.user.username,
        displayName: link.user.displayName,
        avatar: link.user.avatar,
        isOnline: link.user.isOnline,
        role: link.role,
      })),
      lastMessage: conversation.messages[0] ? {
        id: conversation.messages[0].id,
        content: conversation.messages[0].content,
        senderId: conversation.messages[0].senderId,
        createdAt: conversation.messages[0].createdAt,
      } : undefined,
      group: conversation.group ? {
        id: conversation.group.id,
        title: conversation.group.title,
        description: conversation.group.description,
        image: conversation.group.image,
        isPublic: conversation.group.isPublic,
        memberCount: conversation.group.members?.length || 0,
      } : undefined,
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
    const { conversationId, linkId, maxUses, expiresAt } = createLinkDto;

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
        linkId,
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
}
