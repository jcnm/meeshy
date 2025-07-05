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
}
