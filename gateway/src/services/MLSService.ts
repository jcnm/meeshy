/**
 * MLS Service - Backend implementation for end-to-end encryption
 *
 * Manages MLS operations on the server side:
 * - KeyPackage generation and distribution
 * - Conversation initialization with MLS
 * - Encryption metadata management
 * - Audit logging for security
 *
 * Phase 1: 1:1 conversations with TweetNaCl
 * Phase 2+: Group conversations with full MLS protocol
 */

import { PrismaClient } from '../../shared/prisma/client';
import {
  MLSError,
  MLSErrorCode,
} from '@meeshy/shared/types/mls';
import type {
  KeyPackageInfo,
  GenerateKeyPackagesRequest,
  GenerateKeyPackagesResponse,
  InitializeOneToOneConversationRequest,
  InitializeOneToOneConversationResponse,
  MLSStatistics,
  MLSHealthStatus,
  MLSHealthIssue,
  MLSAuditEvent,
  LogMLSAuditEventRequest,
  MLSFeatureFlags,
} from '@meeshy/shared/types/mls';
import {
  DEFAULT_MLS_FEATURE_FLAGS,
  MIN_KEY_PACKAGES_PER_USER,
  DEFAULT_KEY_PACKAGES_COUNT,
  MAX_KEY_PACKAGES_COUNT,
  generateGroupId,
  generateMLSIdentity,
  calculateKeyPackageExpiration,
} from '@meeshy/shared/types/mls';

/**
 * MLS Service
 *
 * Provides server-side MLS operations
 */
export class MLSService {
  private featureFlags: MLSFeatureFlags;

  constructor(
    private readonly prisma: PrismaClient,
    featureFlags?: Partial<MLSFeatureFlags>
  ) {
    // Merge provided flags with defaults
    this.featureFlags = {
      ...DEFAULT_MLS_FEATURE_FLAGS,
      ...featureFlags,
    };
  }

  // ============================================================================
  // KEYPACKAGE MANAGEMENT
  // ============================================================================

  /**
   * Generate KeyPackages for a user
   *
   * @param request - Generation request
   * @returns Generated KeyPackages info
   */
  async generateKeyPackages(
    request: GenerateKeyPackagesRequest
  ): Promise<GenerateKeyPackagesResponse> {
    const { userId, count = DEFAULT_KEY_PACKAGES_COUNT, cipherSuite } = request;

    // Validate count
    if (count < 1 || count > MAX_KEY_PACKAGES_COUNT) {
      throw new MLSError(
        MLSErrorCode.UNKNOWN_ERROR,
        `Count must be between 1 and ${MAX_KEY_PACKAGES_COUNT}`,
        { count }
      );
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      throw new MLSError(
        MLSErrorCode.UNKNOWN_ERROR,
        'User not found',
        { userId }
      );
    }

    const keyPackages: KeyPackageInfo[] = [];

    // Generate KeyPackages in Prisma
    for (let i = 0; i < count; i++) {
      // For Phase 1, we generate a simple UUID as keyPackageId
      // The actual crypto keys will be generated client-side
      const keyPackageId = crypto.randomUUID();
      const expiresAt = calculateKeyPackageExpiration();

      const keyPackage = await this.prisma.mLSKeyPackage.create({
        data: {
          userId,
          keyPackageId,
          publicKey: '', // Will be filled by client
          privateKeyEnc: '', // Will be filled by client (encrypted)
          cipherSuite:
            cipherSuite || 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
          isUsed: false,
          expiresAt,
        },
      });

      keyPackages.push({
        keyPackageId: keyPackage.keyPackageId,
        publicKey: keyPackage.publicKey,
        cipherSuite: keyPackage.cipherSuite as any,
        expiresAt: keyPackage.expiresAt,
        createdAt: keyPackage.createdAt,
      });
    }

    // Log audit event
    await this.logAuditEvent({
      eventType: 'key_package_generated',
      userId,
      details: { count, cipherSuite },
    });

    return {
      keyPackages,
      userId,
      generated: keyPackages.length,
    };
  }

  /**
   * Fetch an available KeyPackage for a user
   *
   * @param userId - User ID
   * @returns Available KeyPackage or null
   */
  async fetchKeyPackage(userId: string): Promise<KeyPackageInfo | null> {
    const keyPackage = await this.prisma.mLSKeyPackage.findFirst({
      where: {
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!keyPackage) {
      return null;
    }

    return {
      keyPackageId: keyPackage.keyPackageId,
      publicKey: keyPackage.publicKey,
      cipherSuite: keyPackage.cipherSuite as any,
      expiresAt: keyPackage.expiresAt,
      createdAt: keyPackage.createdAt,
    };
  }

  /**
   * Mark a KeyPackage as used
   *
   * @param keyPackageId - KeyPackage ID
   * @param conversationId - Conversation ID
   */
  async markKeyPackageAsUsed(
    keyPackageId: string,
    conversationId: string
  ): Promise<void> {
    await this.prisma.mLSKeyPackage.update({
      where: { keyPackageId },
      data: {
        isUsed: true,
        usedForConvId: conversationId,
        usedAt: new Date(),
      },
    });

    // Log audit event
    await this.logAuditEvent({
      eventType: 'key_package_used',
      conversationId,
      keyPackageId,
      details: { conversationId },
    });
  }

  /**
   * Get available KeyPackages for a user
   *
   * @param userId - User ID
   * @returns Array of available KeyPackages
   */
  async getAvailableKeyPackages(userId: string): Promise<readonly KeyPackageInfo[]> {
    const keyPackages = await this.prisma.mLSKeyPackage.findMany({
      where: {
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return keyPackages.map((kp) => ({
      keyPackageId: kp.keyPackageId,
      publicKey: kp.publicKey,
      cipherSuite: kp.cipherSuite as any,
      expiresAt: kp.expiresAt,
      createdAt: kp.createdAt,
    }));
  }

  /**
   * Ensure a user has enough available KeyPackages
   *
   * @param userId - User ID
   * @param minCount - Minimum number of KeyPackages
   */
  async ensureKeyPackages(
    userId: string,
    minCount: number = MIN_KEY_PACKAGES_PER_USER
  ): Promise<void> {
    const availableCount = await this.prisma.mLSKeyPackage.count({
      where: {
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (availableCount < minCount) {
      const toGenerate = DEFAULT_KEY_PACKAGES_COUNT;
      await this.generateKeyPackages({ userId, count: toGenerate });
    }
  }

  /**
   * Cleanup expired KeyPackages
   *
   * @returns Number of KeyPackages deleted
   */
  async cleanupExpiredKeyPackages(): Promise<number> {
    const result = await this.prisma.mLSKeyPackage.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  // ============================================================================
  // CONVERSATION INITIALIZATION
  // ============================================================================

  /**
   * Initialize a 1:1 conversation with MLS encryption
   *
   * @param request - Initialization request
   * @returns Initialization info
   */
  async initializeOneToOneConversation(
    request: InitializeOneToOneConversationRequest
  ): Promise<InitializeOneToOneConversationResponse> {
    const { conversationId, initiatorUserId, recipientUserId } = request;

    // Check if MLS is enabled
    if (!this.featureFlags.mlsEnabled) {
      throw new MLSError(
        MLSErrorCode.MLS_NOT_ENABLED,
        'MLS encryption is not enabled'
      );
    }

    // Verify conversation exists
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, type: true },
    });

    if (!conversation) {
      throw new MLSError(
        MLSErrorCode.UNKNOWN_ERROR,
        'Conversation not found',
        { conversationId }
      );
    }

    // Check if conversation already has MLS state
    const existingState = await this.prisma.mLSGroupState.findUnique({
      where: { conversationId },
    });

    if (existingState) {
      throw new MLSError(
        MLSErrorCode.UNKNOWN_ERROR,
        'Conversation already has MLS state',
        { conversationId, groupId: existingState.groupId }
      );
    }

    // Fetch KeyPackages for both users
    const initiatorKP = await this.fetchKeyPackage(initiatorUserId);
    const recipientKP = await this.fetchKeyPackage(recipientUserId);

    if (!initiatorKP) {
      throw new MLSError(
        MLSErrorCode.NO_KEY_PACKAGES_AVAILABLE,
        'No KeyPackage available for initiator',
        { userId: initiatorUserId }
      );
    }

    if (!recipientKP) {
      throw new MLSError(
        MLSErrorCode.NO_KEY_PACKAGES_AVAILABLE,
        'No KeyPackage available for recipient',
        { userId: recipientUserId }
      );
    }

    // Generate Group ID
    const groupId = generateGroupId(conversationId);

    // Create MLS Group State
    await this.prisma.mLSGroupState.create({
      data: {
        conversationId,
        groupId,
        epoch: 0,
        cipherSuite: initiatorKP.cipherSuite,
        treeHash: '', // Will be computed client-side
        confirmedTranscriptHash: '', // Will be computed client-side
        memberKeyPackages: [
          { userId: initiatorUserId, keyPackageId: initiatorKP.keyPackageId },
          { userId: recipientUserId, keyPackageId: recipientKP.keyPackageId },
        ],
      },
    });

    // Mark KeyPackages as used
    await this.markKeyPackageAsUsed(initiatorKP.keyPackageId, conversationId);
    await this.markKeyPackageAsUsed(recipientKP.keyPackageId, conversationId);

    // Log audit event
    await this.logAuditEvent({
      eventType: 'group_created',
      conversationId,
      groupId,
      details: {
        initiatorUserId,
        recipientUserId,
        type: '1:1',
      },
    });

    return {
      groupId,
      conversationId,
      initiatorKeyPackageId: initiatorKP.keyPackageId,
      recipientKeyPackageId: recipientKP.keyPackageId,
      epoch: 0,
    };
  }

  /**
   * Get MLS Group state for a conversation
   *
   * @param conversationId - Conversation ID
   * @returns Group state or null
   */
  async getGroupState(conversationId: string) {
    const groupState = await this.prisma.mLSGroupState.findUnique({
      where: { conversationId },
    });

    if (!groupState) {
      return null;
    }

    return {
      groupId: groupState.groupId,
      conversationId: groupState.conversationId,
      epoch: groupState.epoch,
      cipherSuite: groupState.cipherSuite,
      members: groupState.memberKeyPackages as any,
      createdAt: groupState.createdAt,
      updatedAt: groupState.updatedAt,
    };
  }

  /**
   * Check if a conversation is encrypted with MLS
   *
   * @param conversationId - Conversation ID
   * @returns true if conversation has MLS encryption
   */
  async isConversationEncrypted(conversationId: string): Promise<boolean> {
    const groupState = await this.prisma.mLSGroupState.findUnique({
      where: { conversationId },
      select: { id: true },
    });

    return groupState !== null;
  }

  // ============================================================================
  // STATISTICS AND MONITORING
  // ============================================================================

  /**
   * Get MLS statistics
   *
   * @returns Statistics object
   */
  async getStatistics(): Promise<MLSStatistics> {
    const totalUsers = await this.prisma.user.count({
      where: { isActive: true },
    });

    const usersWithKeyPackages = await this.prisma.mLSKeyPackage.groupBy({
      by: ['userId'],
      where: {
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    const totalKeyPackages = await this.prisma.mLSKeyPackage.count();

    const availableKeyPackages = await this.prisma.mLSKeyPackage.count({
      where: {
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    const expiredKeyPackages = await this.prisma.mLSKeyPackage.count({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    const encryptedConversations = await this.prisma.mLSGroupState.count();

    const totalConversations = await this.prisma.conversation.count({
      where: { type: 'direct' },
    });

    const encryptedMessages = await this.prisma.encryptedMessageData.count();

    const totalMessages = await this.prisma.message.count();

    const adoptionRate =
      totalConversations > 0
        ? ((encryptedConversations / totalConversations) * 100).toFixed(2)
        : '0.00';

    const encryptionRate =
      totalMessages > 0
        ? ((encryptedMessages / totalMessages) * 100).toFixed(2)
        : '0.00';

    return {
      users: {
        total: totalUsers,
        withKeyPackages: usersWithKeyPackages.length,
        percentage: ((usersWithKeyPackages.length / totalUsers) * 100).toFixed(2),
      },
      keyPackages: {
        total: totalKeyPackages,
        available: availableKeyPackages,
        expired: expiredKeyPackages,
        used: totalKeyPackages - availableKeyPackages - expiredKeyPackages,
      },
      conversations: {
        total: totalConversations,
        encrypted: encryptedConversations,
        adoptionRate: `${adoptionRate}%`,
      },
      messages: {
        total: totalMessages,
        encrypted: encryptedMessages,
        encryptionRate: `${encryptionRate}%`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get MLS health status
   *
   * @returns Health status
   */
  async getHealthStatus(): Promise<MLSHealthStatus> {
    const issues: MLSHealthIssue[] = [];

    // Check for users with low KeyPackage count
    const allUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let lowKeyPackageCount = 0;

    for (const user of allUsers) {
      const availableCount = await this.prisma.mLSKeyPackage.count({
        where: {
          userId: user.id,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (availableCount < MIN_KEY_PACKAGES_PER_USER) {
        lowKeyPackageCount++;
      }
    }

    if (lowKeyPackageCount > 0) {
      issues.push({
        severity: 'warning',
        type: 'low_key_packages',
        message: `${lowKeyPackageCount} users have less than ${MIN_KEY_PACKAGES_PER_USER} available KeyPackages`,
        affectedUsers: lowKeyPackageCount,
      });
    }

    // Check for KeyPackages expiring soon (within 7 days)
    const expiringKeyComing = new Date();
    expiringKeyComing.setDate(expiringKeyComing.getDate() + 7);

    const expiringKeyPackages = await this.prisma.mLSKeyPackage.count({
      where: {
        isUsed: false,
        expiresAt: {
          gt: new Date(),
          lt: expiringKeyComing,
        },
      },
    });

    if (expiringKeyPackages > 0) {
      issues.push({
        severity: 'info',
        type: 'expiring_key_packages',
        message: `${expiringKeyPackages} KeyPackages expiring within 7 days`,
        count: expiringKeyPackages,
      });
    }

    const healthStatus =
      issues.length === 0
        ? 'healthy'
        : issues.some((i) => i.severity === 'error')
        ? 'error'
        : 'warning';

    return {
      status: healthStatus,
      issues,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================

  /**
   * Log an MLS audit event
   *
   * @param request - Audit event request
   * @returns Created audit event
   */
  async logAuditEvent(request: LogMLSAuditEventRequest): Promise<MLSAuditEvent> {
    const event = await this.prisma.mLSAuditEvent.create({
      data: {
        eventType: request.eventType,
        severity: request.severity || 'info',
        userId: request.userId,
        conversationId: request.conversationId,
        groupId: request.groupId,
        keyPackageId: request.keyPackageId,
        details: request.details ? (request.details as any) : undefined, // Convert readonly to InputJsonValue
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      },
    });

    return {
      id: event.id,
      eventType: event.eventType as any,
      severity: event.severity as any,
      userId: event.userId || undefined,
      conversationId: event.conversationId || undefined,
      groupId: event.groupId || undefined,
      keyPackageId: event.keyPackageId || undefined,
      details: event.details as any,
      ipAddress: event.ipAddress || undefined,
      userAgent: event.userAgent || undefined,
      timestamp: event.timestamp,
    };
  }

  /**
   * Get audit events for a conversation
   *
   * @param conversationId - Conversation ID
   * @param limit - Maximum number of events to return
   * @returns Array of audit events
   */
  async getAuditEventsForConversation(
    conversationId: string,
    limit: number = 100
  ): Promise<readonly MLSAuditEvent[]> {
    const events = await this.prisma.mLSAuditEvent.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType as any,
      severity: event.severity as any,
      userId: event.userId || undefined,
      conversationId: event.conversationId || undefined,
      groupId: event.groupId || undefined,
      keyPackageId: event.keyPackageId || undefined,
      details: event.details as any,
      ipAddress: event.ipAddress || undefined,
      userAgent: event.userAgent || undefined,
      timestamp: event.timestamp,
    }));
  }

  // ============================================================================
  // MAINTENANCE
  // ============================================================================

  /**
   * Run maintenance tasks
   * - Cleanup expired KeyPackages
   * - Ensure users have enough KeyPackages
   *
   * @returns Maintenance results
   */
  async runMaintenance(): Promise<{
    expiredKeyPackagesDeleted: number;
    usersEnsured: number;
  }> {
    // Cleanup expired KeyPackages
    const expiredKeyPackagesDeleted = await this.cleanupExpiredKeyPackages();

    // Ensure all active users have enough KeyPackages
    const activeUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let usersEnsured = 0;
    for (const user of activeUsers) {
      await this.ensureKeyPackages(user.id, MIN_KEY_PACKAGES_PER_USER);
      usersEnsured++;
    }

    return {
      expiredKeyPackagesDeleted,
      usersEnsured,
    };
  }
}
