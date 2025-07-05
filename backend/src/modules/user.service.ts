import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from '../dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
        systemLanguage: true,
        regionalLanguage: true,
        createdAt: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        displayName: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
        lastActiveAt: true,
        systemLanguage: true,
        regionalLanguage: true,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: true,
        useCustomDestination: true,
        createdAt: true,
        updatedAt: true,
        userStats: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        displayName: true,
        avatar: true,
        systemLanguage: true,
        regionalLanguage: true,
        autoTranslateEnabled: true,
        translateToSystemLanguage: true,
        translateToRegionalLanguage: true,
        useCustomDestination: true,
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
        displayName: true,
        avatar: true,
        isOnline: true,
      },
      take: 10,
    });
  }
}
