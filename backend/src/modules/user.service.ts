import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from '../shared/dto';
import { USER_SELECT_FIELDS, USER_SAFE_SELECT_FIELDS } from '../shared/constants';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: USER_SAFE_SELECT_FIELDS,
      orderBy: {
        username: 'asc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT_FIELDS,
        userStats: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        ...USER_SELECT_FIELDS,
        updatedAt: true,
      },
    });
  }

  async updateOnlineStatus(id: string, isOnline: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  }

  async getStats(id: string) {
    return this.prisma.userStats.findUnique({
      where: { userId: id },
      include: {
        user: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    });
  }

  async updateStats(userId: string, field: 'messagesSent' | 'messagesReceived' | 'conversationsJoined' | 'groupsCreated' | 'translationsUsed') {
    const currentStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!currentStats) {
      return this.prisma.userStats.create({
        data: {
          userId,
          [field]: 1,
        },
      });
    }

    return this.prisma.userStats.update({
      where: { userId },
      data: {
        [field]: (currentStats[field] as number) + 1,
        lastActiveAt: new Date(),
      },
    });
  }

  async searchUsers(query: string, excludeIds: string[] = []) {
    return this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: query } },
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { displayName: { contains: query } },
              { email: { contains: query } },
            ],
          },
          {
            id: { notIn: excludeIds },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        isOnline: true,
      },
      take: 10,
    });
  }

  // === MÉTHODES POUR L'ADMINISTRATION ===

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT_FIELDS,
        email: true, // Inclus pour l'admin
        phoneNumber: true,
        updatedAt: true,
      },
    });
  }

  async countUsers() {
    return this.prisma.user.count();
  }

  async countActiveUsers() {
    return this.prisma.user.count({
      where: {
        isOnline: true,
      },
    });
  }

  async countUsersByRole(roles: string[]) {
    return this.prisma.user.count({
      where: {
        role: { in: roles },
        isActive: true,
      },
    });
  }

  async findUsersWithFilters(
    filters: {
      role?: string;
      search?: string;
      active?: boolean;
    },
    limit: number,
    offset: number,
  ) {
    const where: any = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.search) {
      where.OR = [
        { username: { contains: filters.search } },
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
        { displayName: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    if (filters.active !== undefined) {
      where.isActive = filters.active;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_SELECT_FIELDS,
          email: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          deactivatedAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async deactivateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        isOnline: false,
        lastSeen: new Date(),
      },
    });
  }

  async getUsersByRole() {
    const rolesCounts = await this.prisma.user.groupBy({
      by: ['role'],
      where: {
        isActive: true,
      },
      _count: {
        id: true,
      },
    });

    const result: Record<string, number> = {
      BIGBOSS: 0,
      ADMIN: 0,
      MODO: 0,
      AUDIT: 0,
      ANALYST: 0,
      USER: 0,
    };

    rolesCounts.forEach(({ role, _count }) => {
      if (role in result) {
        result[role] = _count.id;
      }
    });

    return result;
  }

  async updateUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        ...USER_SELECT_FIELDS,
        email: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async reactivateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        deactivatedAt: null,
      },
    });
  }
}
