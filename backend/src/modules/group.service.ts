import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto, UpdateGroupDto } from '../dto';

@Injectable()
export class GroupService {
  constructor(private prisma: PrismaService) {}

  async create(createGroupDto: CreateGroupDto, creatorId: string) {
    const { title, description, image, isPublic, maxMembers } = createGroupDto;

    // Créer d'abord une conversation pour le groupe
    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'group',
        title,
        description,
      },
    });

    // Créer le groupe
    const group = await this.prisma.group.create({
      data: {
        conversationId: conversation.id,
        title,
        description,
        image,
        isPublic: isPublic || false,
        maxMembers,
        createdById: creatorId,
      },
    });

    // Ajouter le créateur à la conversation et au groupe
    await this.prisma.conversationLink.create({
      data: {
        conversationId: conversation.id,
        userId: creatorId,
        role: 'admin',
        isAdmin: true,
      },
    });

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: creatorId,
        role: 'admin',
      },
    });

    return this.getGroupForFrontend(group.id);
  }

  async findOne(id: string, userId?: string) {
    const group = await this.getGroupWithDetails(id);
    
    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    // Si le groupe n'est pas public, vérifier l'appartenance
    if (!group.isPublic && userId) {
      const member = await this.prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: id,
            userId,
          },
        },
      });

      if (!member) {
        throw new ForbiddenException('Accès refusé à ce groupe privé');
      }
    }

    return group;
  }

  async update(id: string, updateGroupDto: UpdateGroupDto, userId: string) {
    // Vérifier que l'utilisateur est admin du groupe
    await this.checkAdminPermission(id, userId);

    const updatedGroup = await this.prisma.group.update({
      where: { id },
      data: updateGroupDto,
    });

    // Mettre à jour aussi le titre de la conversation si nécessaire
    if (updateGroupDto.title) {
      await this.prisma.conversation.update({
        where: { id: updatedGroup.conversationId },
        data: { title: updateGroupDto.title },
      });
    }

    return this.getGroupWithDetails(id);
  }

  async addMember(groupId: string, userId: string, adminId: string) {
    // Vérifier les permissions d'admin
    await this.checkAdminPermission(groupId, adminId);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    // Vérifier la limite de membres
    if (group.maxMembers && group.members.length >= group.maxMembers) {
      throw new ForbiddenException('Le groupe a atteint sa limite de membres');
    }

    // Vérifier que l'utilisateur n'est pas déjà membre
    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ForbiddenException('L\'utilisateur est déjà membre du groupe');
    }

    // Ajouter à la conversation et au groupe
    await this.prisma.conversationLink.create({
      data: {
        conversationId: group.conversationId,
        userId,
        role: 'member',
      },
    });

    await this.prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: 'member',
      },
    });

    return this.getGroupWithDetails(groupId);
  }

  async removeMember(groupId: string, userId: string, adminId: string) {
    // Vérifier les permissions d'admin ou modérateur
    await this.checkModeratorPermission(groupId, adminId);

    // Empêcher la suppression du créateur du groupe
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (group?.createdById === userId) {
      throw new ForbiddenException('Impossible de supprimer le créateur du groupe');
    }

    // Supprimer de la conversation et du groupe
    await this.prisma.conversationLink.updateMany({
      where: {
        conversationId: group!.conversationId,
        userId,
      },
      data: {
        leftAt: new Date(),
      },
    });

    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    return { message: 'Membre supprimé du groupe' };
  }

  async updateMemberRole(groupId: string, userId: string, newRole: 'member' | 'moderator' | 'admin', adminId: string) {
    // Vérifier les permissions d'admin
    await this.checkAdminPermission(groupId, adminId);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    // Empêcher la modification du rôle du créateur
    if (group?.createdById === userId) {
      throw new ForbiddenException('Impossible de modifier le rôle du créateur du groupe');
    }

    // Mettre à jour les rôles
    await Promise.all([
      this.prisma.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
        data: { role: newRole },
      }),
      this.prisma.conversationLink.updateMany({
        where: {
          conversationId: group!.conversationId,
          userId,
        },
        data: {
          role: newRole,
          isAdmin: newRole === 'admin',
          isModerator: newRole === 'moderator',
        },
      }),
    ]);

    return this.getGroupWithDetails(groupId);
  }

  async join(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    if (!group.isPublic) {
      throw new ForbiddenException('Ce groupe est privé');
    }

    // Vérifier la limite de membres
    if (group.maxMembers && group.members.length >= group.maxMembers) {
      throw new ForbiddenException('Le groupe a atteint sa limite de membres');
    }

    // Vérifier que l'utilisateur n'est pas déjà membre
    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ForbiddenException('Vous êtes déjà membre de ce groupe');
    }

    // Ajouter à la conversation et au groupe
    await this.prisma.conversationLink.create({
      data: {
        conversationId: group.conversationId,
        userId,
        role: 'member',
      },
    });

    await this.prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: 'member',
      },
    });

    return this.getGroupWithDetails(groupId);
  }

  async leave(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    // Empêcher au créateur de quitter son propre groupe
    if (group.createdById === userId) {
      throw new ForbiddenException('Le créateur ne peut pas quitter son propre groupe');
    }

    // Quitter la conversation et le groupe
    await this.prisma.conversationLink.updateMany({
      where: {
        conversationId: group.conversationId,
        userId,
      },
      data: {
        leftAt: new Date(),
      },
    });

    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    return { message: 'Vous avez quitté le groupe' };
  }

  async searchPublicGroups(query: string, page = 1, limit = 10) {
    const groups = await this.prisma.group.findMany({
      where: {
        isPublic: true,
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
        ],
      },
      include: {
        members: true,
        createdBy: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return groups.map(group => ({
      id: group.id,
      title: group.title,
      description: group.description,
      image: group.image,
      memberCount: group.members.length,
      maxMembers: group.maxMembers,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
    }));
  }

  private async getGroupForFrontend(groupId: string) {
    const group = await this.getGroupWithDetails(groupId);
    if (!group) return null;

    return {
      id: group.id,
      name: group.title,
      description: group.description,
      isPrivate: !group.isPublic,
      maxMembers: group.maxMembers,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: group.members.map(m => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        joinedAt: m.joinedAt,
        role: m.role,
        user: m.user,
      })),
      conversations: [{ id: group.conversation.id }],
    };
  }

  private async getGroupWithDetails(groupId: string) {
    return this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
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
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        conversation: {
          select: {
            id: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  private async checkAdminPermission(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.role !== 'admin') {
      throw new ForbiddenException('Permissions d\'administrateur requises');
    }
  }

  private async checkModeratorPermission(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || !['admin', 'moderator'].includes(member.role)) {
      throw new ForbiddenException('Permissions de modérateur requises');
    }
  }

  async findUserGroups(userId: string) {
    const groupMembers = await this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    isOnline: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
              },
            },
            conversation: {
              select: {
                id: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return groupMembers.map(member => ({
      id: member.group.id,
      name: member.group.title,
      description: member.group.description,
      isPrivate: !member.group.isPublic,
      maxMembers: member.group.maxMembers,
      memberCount: member.group.members.length,
      createdAt: member.group.createdAt,
      updatedAt: member.group.updatedAt,
      members: member.group.members.map(m => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        joinedAt: m.joinedAt,
        role: m.role,
        user: m.user,
      })),
      conversations: [{ id: member.group.conversation.id }],
    }));
  }
}
