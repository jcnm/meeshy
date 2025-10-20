/**
 * Service de gestion des réactions emoji sur les messages
 * 
 * Gère l'ajout, la suppression, l'agrégation et la synchronisation
 * des réactions avec support utilisateurs authentifiés et anonymes
 */

import { PrismaClient, Reaction } from '../../shared/prisma/client';
import type {
  ReactionData,
  ReactionAggregation,
  ReactionSync,
  ReactionUpdateEvent
} from '../../shared/types';
import { sanitizeEmoji, isValidEmoji } from '../../shared/types/reaction';

export interface AddReactionOptions {
  messageId: string;
  userId?: string;
  anonymousUserId?: string;
  emoji: string;
}

export interface RemoveReactionOptions {
  messageId: string;
  userId?: string;
  anonymousUserId?: string;
  emoji: string;
}

export interface GetReactionsOptions {
  messageId: string;
  currentUserId?: string;
  currentAnonymousUserId?: string;
}

export class ReactionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Ajoute une réaction à un message
   * Vérifie les permissions et évite les doublons
   */
  async addReaction(options: AddReactionOptions): Promise<ReactionData | null> {
    const { messageId, userId, anonymousUserId, emoji } = options;

    // Validation de l'emoji
    const sanitized = sanitizeEmoji(emoji);
    if (!sanitized) {
      throw new Error('Invalid emoji format');
    }

    // Vérifier que l'utilisateur ou anonyme est fourni
    if (!userId && !anonymousUserId) {
      throw new Error('Either userId or anonymousUserId must be provided');
    }

    // Vérifier que le message existe et permissions
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            members: true,
            anonymousParticipants: true
          }
        }
      }
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Vérifier les permissions d'accès à la conversation
    if (userId) {
      const isMember = message.conversation.members.some(m => m.userId === userId);
      if (!isMember) {
        throw new Error('User is not a member of this conversation');
      }
    } else if (anonymousUserId) {
      const isParticipant = message.conversation.anonymousParticipants.some(
        p => p.id === anonymousUserId
      );
      if (!isParticipant) {
        throw new Error('Anonymous user is not a participant of this conversation');
      }
    }

    // Vérifier si la réaction existe déjà
    const existingReaction = await this.prisma.reaction.findFirst({
      where: {
        messageId,
        ...(userId ? { userId } : { anonymousUserId }),
        emoji: sanitized
      }
    });

    if (existingReaction) {
      // Réaction déjà existante, retourner celle-ci
      return this.mapReactionToData(existingReaction);
    }

    // Créer la réaction
    const reaction = await this.prisma.reaction.create({
      data: {
        messageId,
        userId,
        anonymousUserId,
        emoji: sanitized
      }
    });

    return this.mapReactionToData(reaction);
  }

  /**
   * Retire une réaction d'un message
   */
  async removeReaction(options: RemoveReactionOptions): Promise<boolean> {
    const { messageId, userId, anonymousUserId, emoji } = options;

    // Validation de l'emoji
    const sanitized = sanitizeEmoji(emoji);
    if (!sanitized) {
      throw new Error('Invalid emoji format');
    }

    // Supprimer la réaction
    const result = await this.prisma.reaction.deleteMany({
      where: {
        messageId,
        ...(userId ? { userId } : { anonymousUserId }),
        emoji: sanitized
      }
    });

    return result.count > 0;
  }

  /**
   * Récupère toutes les réactions pour un message avec agrégation
   */
  async getMessageReactions(options: GetReactionsOptions): Promise<ReactionSync> {
    const { messageId, currentUserId, currentAnonymousUserId } = options;

    // Récupérer toutes les réactions du message
    const reactions = await this.prisma.reaction.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' }
    });

    // Agréger par emoji
    const aggregationMap = new Map<string, ReactionAggregation>();

    reactions.forEach(reaction => {
      const existing = aggregationMap.get(reaction.emoji);

      if (existing) {
        // Ajouter à l'agrégation existante
        const userIds = [...existing.userIds];
        const anonymousUserIds = [...existing.anonymousUserIds];

        if (reaction.userId) {
          userIds.push(reaction.userId);
        }
        if (reaction.anonymousUserId) {
          anonymousUserIds.push(reaction.anonymousUserId);
        }

        // Vérifier si l'utilisateur actuel a réagi
        let hasCurrentUser = existing.hasCurrentUser;
        if (currentUserId && reaction.userId === currentUserId) {
          hasCurrentUser = true;
        }
        if (currentAnonymousUserId && reaction.anonymousUserId === currentAnonymousUserId) {
          hasCurrentUser = true;
        }

        aggregationMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: existing.count + 1,
          userIds,
          anonymousUserIds,
          hasCurrentUser
        });
      } else {
        // Créer nouvelle agrégation
        const hasCurrentUser = 
          (currentUserId && reaction.userId === currentUserId) ||
          (currentAnonymousUserId && reaction.anonymousUserId === currentAnonymousUserId);

        aggregationMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          userIds: reaction.userId ? [reaction.userId] : [],
          anonymousUserIds: reaction.anonymousUserId ? [reaction.anonymousUserId] : [],
          hasCurrentUser
        });
      }
    });

    // Convertir en tableau
    const aggregations = Array.from(aggregationMap.values());

    // Trouver les emojis utilisés par l'utilisateur actuel
    const userReactions = reactions
      .filter(r => 
        (currentUserId && r.userId === currentUserId) ||
        (currentAnonymousUserId && r.anonymousUserId === currentAnonymousUserId)
      )
      .map(r => r.emoji);

    return {
      messageId,
      reactions: aggregations,
      totalCount: reactions.length,
      userReactions: Array.from(new Set(userReactions)) // Dédupliquer
    };
  }

  /**
   * Récupère l'agrégation pour un emoji spécifique
   */
  async getEmojiAggregation(
    messageId: string,
    emoji: string,
    currentUserId?: string,
    currentAnonymousUserId?: string
  ): Promise<ReactionAggregation> {
    const sanitized = sanitizeEmoji(emoji);
    if (!sanitized) {
      throw new Error('Invalid emoji format');
    }

    const reactions = await this.prisma.reaction.findMany({
      where: {
        messageId,
        emoji: sanitized
      }
    });

    const userIds = reactions
      .filter(r => r.userId)
      .map(r => r.userId!);

    const anonymousUserIds = reactions
      .filter(r => r.anonymousUserId)
      .map(r => r.anonymousUserId!);

    const hasCurrentUser = reactions.some(r =>
      (currentUserId && r.userId === currentUserId) ||
      (currentAnonymousUserId && r.anonymousUserId === currentAnonymousUserId)
    );

    return {
      emoji: sanitized,
      count: reactions.length,
      userIds,
      anonymousUserIds,
      hasCurrentUser
    };
  }

  /**
   * Récupère toutes les réactions d'un utilisateur
   */
  async getUserReactions(userId: string): Promise<ReactionData[]> {
    const reactions = await this.prisma.reaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limiter pour performance
    });

    return reactions.map(r => this.mapReactionToData(r));
  }

  /**
   * Récupère toutes les réactions d'un utilisateur anonyme
   */
  async getAnonymousUserReactions(anonymousUserId: string): Promise<ReactionData[]> {
    const reactions = await this.prisma.reaction.findMany({
      where: { anonymousUserId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return reactions.map(r => this.mapReactionToData(r));
  }

  /**
   * Vérifie si un utilisateur a déjà réagi avec un emoji
   */
  async hasUserReacted(
    messageId: string,
    emoji: string,
    userId?: string,
    anonymousUserId?: string
  ): Promise<boolean> {
    const sanitized = sanitizeEmoji(emoji);
    if (!sanitized) return false;

    const reaction = await this.prisma.reaction.findFirst({
      where: {
        messageId,
        emoji: sanitized,
        ...(userId ? { userId } : { anonymousUserId })
      }
    });

    return reaction !== null;
  }

  /**
   * Supprime toutes les réactions d'un message (cascade lors de suppression message)
   */
  async deleteMessageReactions(messageId: string): Promise<number> {
    const result = await this.prisma.reaction.deleteMany({
      where: { messageId }
    });

    return result.count;
  }

  /**
   * Crée un événement de mise à jour pour WebSocket
   */
  async createUpdateEvent(
    messageId: string,
    emoji: string,
    action: 'add' | 'remove',
    userId?: string,
    anonymousUserId?: string
  ): Promise<ReactionUpdateEvent> {
    const aggregation = await this.getEmojiAggregation(
      messageId,
      emoji,
      userId,
      anonymousUserId
    );

    return {
      messageId,
      userId,
      anonymousUserId,
      emoji,
      action,
      aggregation,
      timestamp: new Date()
    };
  }

  /**
   * Mappe une Reaction Prisma vers ReactionData
   */
  private mapReactionToData(reaction: Reaction): ReactionData {
    return {
      id: reaction.id,
      messageId: reaction.messageId,
      userId: reaction.userId || undefined,
      anonymousUserId: reaction.anonymousUserId || undefined,
      emoji: reaction.emoji,
      createdAt: reaction.createdAt,
      updatedAt: reaction.updatedAt
    };
  }

  /**
   * Valide et nettoie les options d'ajout de réaction
   */
  validateAddReactionOptions(options: AddReactionOptions): void {
    if (!options.messageId) {
      throw new Error('messageId is required');
    }

    if (!options.userId && !options.anonymousUserId) {
      throw new Error('Either userId or anonymousUserId must be provided');
    }

    if (!options.emoji) {
      throw new Error('emoji is required');
    }

    if (!isValidEmoji(options.emoji)) {
      throw new Error('Invalid emoji format');
    }
  }

  /**
   * Valide et nettoie les options de suppression de réaction
   */
  validateRemoveReactionOptions(options: RemoveReactionOptions): void {
    if (!options.messageId) {
      throw new Error('messageId is required');
    }

    if (!options.userId && !options.anonymousUserId) {
      throw new Error('Either userId or anonymousUserId must be provided');
    }

    if (!options.emoji) {
      throw new Error('emoji is required');
    }

    if (!isValidEmoji(options.emoji)) {
      throw new Error('Invalid emoji format');
    }
  }
}

// Export singleton avec instance Prisma partagée
// Note: Cette instance sera injectée par le système de DI
export const createReactionService = (prisma: PrismaClient) => {
  return new ReactionService(prisma);
};
