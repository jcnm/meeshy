import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache.service';
import { CreateConversationDto } from '../shared/dto';
import { ConversationResponse } from '../shared/interfaces';

@Injectable()
export class ConversationServiceOptimized {
  private readonly logger = new Logger(ConversationServiceOptimized.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Version optimisée : récupère les conversations d'un utilisateur avec cache
   */
  async findUserConversationsOptimized(userId: string): Promise<ConversationResponse[]> {
    const cacheKey = CacheService.Keys.USER_CONVERSATIONS(userId);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        this.logger.debug(`Fetching conversations for user ${userId} from database`);

        // 1. Récupérer les IDs des conversations de l'utilisateur
        const userConversations = await this.prisma.conversationLink.findMany({
          where: {
            userId,
            leftAt: null,
          },
          select: {
            conversationId: true,
            role: true,
            joinedAt: true,
          },
          orderBy: {
            conversation: {
              updatedAt: 'desc',
            },
          },
        });

        if (userConversations.length === 0) {
          return [];
        }

        const conversationIds = userConversations.map(uc => uc.conversationId);

        // 2. Récupérer les détails des conversations en une seule requête
        const conversations = await this.prisma.conversation.findMany({
          where: {
            id: { in: conversationIds },
          },
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // 3. Récupérer les derniers messages en une seule requête
        const lastMessages = await this.prisma.message.findMany({
          where: {
            conversationId: { in: conversationIds },
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
            createdAt: true,
            updatedAt: true,
            sender: {
              select: {
                username: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          distinct: ['conversationId'],
        });

        // 4. Récupérer les participants en une seule requête
        const participants = await this.prisma.conversationLink.findMany({
          where: {
            conversationId: { in: conversationIds },
            leftAt: null,
          },
          select: {
            id: true,
            conversationId: true,
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });

        // 5. Assembler les données
        const conversationMap = new Map(conversations.map(c => [c.id, c]));
        const lastMessageMap = new Map(lastMessages.map(m => [m.conversationId, m]));
        const participantMap = new Map<string, typeof participants>();
        
        participants.forEach(p => {
          if (!participantMap.has(p.conversationId)) {
            participantMap.set(p.conversationId, []);
          }
          participantMap.get(p.conversationId)!.push(p);
        });

        return userConversations.map(uc => {
          const conversation = conversationMap.get(uc.conversationId)!;
          const lastMessage = lastMessageMap.get(uc.conversationId);
          const convParticipants = participantMap.get(uc.conversationId) || [];

          return {
            id: conversation.id,
            type: conversation.type,
            title: conversation.title,
            name: conversation.title,
            description: conversation.description,
            isGroup: conversation.type === 'group',
            isPrivate: conversation.type === 'private',
            isActive: conversation.isActive,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            participants: convParticipants.map(p => ({
              id: p.id,
              conversationId: p.conversationId,
              userId: p.userId,
              role: p.role,
              user: p.user,
            })),
            lastMessage: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender?.username || 'Utilisateur',
              senderAvatar: lastMessage.sender?.avatar || undefined,
              originalLanguage: lastMessage.originalLanguage || 'fr',
              isEdited: lastMessage.isEdited || false,
              editedAt: lastMessage.editedAt || undefined,
              isDeleted: lastMessage.isDeleted || false,
              conversationId: lastMessage.conversationId,
              replyTo: undefined,
              createdAt: lastMessage.createdAt,
              updatedAt: lastMessage.updatedAt,
            } : undefined,
            unreadCount: 0, // À implémenter
          } as ConversationResponse;
        });
      },
      CacheService.TTL.MEDIUM
    );
  }

  /**
   * Invalide le cache des conversations d'un utilisateur
   */
  invalidateUserConversationsCache(userId: string): void {
    this.cache.delete(CacheService.Keys.USER_CONVERSATIONS(userId));
  }

  /**
   * Invalide le cache de tous les participants d'une conversation
   */
  invalidateConversationCache(conversationId: string): void {
    // Supprimer le cache de la conversation
    this.cache.delete(CacheService.Keys.CONVERSATION_DETAILS(conversationId));
    
    // Supprimer le cache des messages
    this.cache.deleteByPattern(`conversation:${conversationId}:messages:.*`);
    
    // Invalider le cache des conversations de tous les participants
    // (à optimiser pour éviter de charger tous les participants)
    this.cache.deleteByPattern(`user:.*:conversations`);
  }

  /**
   * Version optimisée : récupérer les détails d'une conversation avec cache
   */
  async findOneOptimized(conversationId: string): Promise<ConversationResponse | null> {
    const cacheKey = CacheService.Keys.CONVERSATION_DETAILS(conversationId);

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        this.logger.debug(`Fetching conversation ${conversationId} from database`);

        const conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!conversation) {
          return null;
        }

        // Récupérer les participants
        const participants = await this.prisma.conversationLink.findMany({
          where: {
            conversationId,
            leftAt: null,
          },
          select: {
            id: true,
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });

        // Récupérer le dernier message
        const lastMessage = await this.prisma.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            senderId: true,
            originalLanguage: true,
            isEdited: true,
            editedAt: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
            sender: {
              select: {
                username: true,
                avatar: true,
              },
            },
          },
        });

        return {
          id: conversation.id,
          type: conversation.type,
          title: conversation.title,
          name: conversation.title,
          description: conversation.description,
          isGroup: conversation.type === 'group',
          isPrivate: conversation.type === 'private',
          isActive: conversation.isActive,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          participants: participants.map(p => ({
            id: p.id,
            conversationId,
            userId: p.userId,
            role: p.role,
            user: p.user,
          })),
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            senderName: lastMessage.sender?.username || 'Utilisateur',
            senderAvatar: lastMessage.sender?.avatar || undefined,
            originalLanguage: lastMessage.originalLanguage || 'fr',
            isEdited: lastMessage.isEdited || false,
            editedAt: lastMessage.editedAt || undefined,
            isDeleted: lastMessage.isDeleted || false,
            conversationId,
            replyTo: undefined,
            createdAt: lastMessage.createdAt,
            updatedAt: lastMessage.updatedAt,
          } : undefined,
          unreadCount: 0,
        } as ConversationResponse;
      },
      CacheService.TTL.MEDIUM
    );
  }

  /**
   * Nettoie le cache lors de la création d'une conversation
   */
  async createConversationOptimized(
    createConversationDto: CreateConversationDto,
    creatorId: string
  ) {
    const conversation = await this.prisma.conversation.create({
      data: {
        type: createConversationDto.type,
        title: createConversationDto.title,
        description: createConversationDto.description,
        isActive: true,
      },
    });

    // Ajouter les participants
    const participantData = [
      { conversationId: conversation.id, userId: creatorId, role: 'ADMIN' },
      ...createConversationDto.participantIds
        .filter(id => id !== creatorId)
        .map(userId => ({ conversationId: conversation.id, userId, role: 'MEMBER' })),
    ];

    await this.prisma.conversationLink.createMany({
      data: participantData,
    });

    // Invalider le cache de tous les participants
    const allParticipants = [creatorId, ...createConversationDto.participantIds];
    allParticipants.forEach(userId => {
      this.invalidateUserConversationsCache(userId);
    });

    return conversation;
  }
}
