/**
 * Signal Protocol Key Rotation Service
 *
 * Handles automatic rotation of Signal Protocol keys for security
 * - Signed Pre-Keys: Rotate every 30 days
 * - Kyber Pre-Keys: Rotate every 30 days
 * - One-Time Pre-Keys: Replenish when running low (< 10 remaining)
 */

import * as SignalProtocol from '@signalapp/libsignal-client';
import type { PrismaClient } from '@meeshy/shared/client';
import { PrismaPreKeyStore, PrismaSignedPreKeyStore, PrismaKyberPreKeyStore } from '../encryption-adapters/signal-prisma.stores';

export interface KeyRotationConfig {
  /**
   * Interval for signed pre-key rotation (in days)
   */
  signedPreKeyRotationDays?: number;

  /**
   * Interval for Kyber pre-key rotation (in days)
   */
  kyberPreKeyRotationDays?: number;

  /**
   * Minimum number of one-time pre-keys to maintain
   */
  minPreKeysCount?: number;

  /**
   * Number of pre-keys to generate when replenishing
   */
  preKeysReplenishCount?: number;

  /**
   * Auto-rotate enabled
   */
  autoRotate?: boolean;
}

const DEFAULT_CONFIG: Required<KeyRotationConfig> = {
  signedPreKeyRotationDays: 30,
  kyberPreKeyRotationDays: 30,
  minPreKeysCount: 10,
  preKeysReplenishCount: 100,
  autoRotate: true,
};

export class SignalKeyRotationService {
  private config: Required<KeyRotationConfig>;

  constructor(
    private prisma: PrismaClient,
    config?: KeyRotationConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check and rotate keys for a user if needed
   */
  async checkAndRotateKeys(userId: string): Promise<{
    signedPreKeyRotated: boolean;
    kyberPreKeyRotated: boolean;
    preKeysReplenished: boolean;
    expiredKeysCleanedUp: number;
  }> {
    const results = {
      signedPreKeyRotated: false,
      kyberPreKeyRotated: false,
      preKeysReplenished: false,
      expiredKeysCleanedUp: 0,
    };

    if (!this.config.autoRotate) {
      return results;
    }

    // Get identity key for signing
    const identityKeyPair = await this.prisma.signalIdentityKeyPair.findUnique({
      where: { userId },
    });

    if (!identityKeyPair) {
      throw new Error(`Identity key pair not found for user ${userId}`);
    }

    // TODO: Decrypt private key with user's master key
    const identityKey = SignalProtocol.PrivateKey.deserialize(
      new Uint8Array(identityKeyPair.privateKeyEnc)
    );

    // Check and rotate signed pre-key
    results.signedPreKeyRotated = await this.checkAndRotateSignedPreKey(
      userId,
      identityKey
    );

    // Check and rotate Kyber pre-key
    results.kyberPreKeyRotated = await this.checkAndRotateKyberPreKey(
      userId,
      identityKey
    );

    // Check and replenish one-time pre-keys
    results.preKeysReplenished = await this.checkAndReplenishPreKeys(userId);

    // Cleanup expired keys
    results.expiredKeysCleanedUp = await this.cleanupExpiredKeys(userId);

    return results;
  }

  /**
   * Check and rotate signed pre-key if needed
   */
  private async checkAndRotateSignedPreKey(
    userId: string,
    identityKey: SignalProtocol.PrivateKey
  ): Promise<boolean> {
    // Check rotation schedule
    const rotation = await this.prisma.signalKeyRotation.findUnique({
      where: {
        userId_keyType: {
          userId,
          keyType: 'signed_pre_key',
        },
      },
    });

    const now = new Date();
    const shouldRotate = !rotation || rotation.nextRotationAt <= now;

    if (!shouldRotate) {
      return false;
    }

    // Generate new signed pre-key
    const keyId = Date.now(); // Use timestamp as key ID
    const keyPair = SignalProtocol.PrivateKey.generate();
    const publicKey = keyPair.getPublicKey();
    const signature = identityKey.sign(publicKey.serialize());

    const signedPreKeyRecord = SignalProtocol.SignedPreKeyRecord.new(
      keyId,
      now.getTime(),
      publicKey,
      keyPair,
      signature
    );

    // Save to database
    const store = new PrismaSignedPreKeyStore(this.prisma, userId);
    await store.saveSignedPreKey(keyId, signedPreKeyRecord);

    // Update rotation schedule
    const nextRotation = new Date(now);
    nextRotation.setDate(nextRotation.getDate() + this.config.signedPreKeyRotationDays);

    await this.prisma.signalKeyRotation.upsert({
      where: {
        userId_keyType: {
          userId,
          keyType: 'signed_pre_key',
        },
      },
      create: {
        userId,
        keyType: 'signed_pre_key',
        lastRotatedAt: now,
        nextRotationAt: nextRotation,
        intervalDays: this.config.signedPreKeyRotationDays,
        autoRotate: true,
      },
      update: {
        lastRotatedAt: now,
        nextRotationAt: nextRotation,
      },
    });

    return true;
  }

  /**
   * Check and rotate Kyber pre-key if needed
   */
  private async checkAndRotateKyberPreKey(
    userId: string,
    identityKey: SignalProtocol.PrivateKey
  ): Promise<boolean> {
    // Check rotation schedule
    const rotation = await this.prisma.signalKeyRotation.findUnique({
      where: {
        userId_keyType: {
          userId,
          keyType: 'kyber_pre_key',
        },
      },
    });

    const now = new Date();
    const shouldRotate = !rotation || rotation.nextRotationAt <= now;

    if (!shouldRotate) {
      return false;
    }

    // Generate new Kyber pre-key
    const keyId = Date.now();
    const keyPair = SignalProtocol.KEMKeyPair.generate();
    const publicKey = keyPair.getPublicKey();
    const signature = identityKey.sign(publicKey.serialize());

    const kyberPreKeyRecord = SignalProtocol.KyberPreKeyRecord.new(
      keyId,
      now.getTime(),
      keyPair,
      signature
    );

    // Save to database
    const store = new PrismaKyberPreKeyStore(this.prisma, userId);
    await store.saveKyberPreKey(keyId, kyberPreKeyRecord);

    // Update rotation schedule
    const nextRotation = new Date(now);
    nextRotation.setDate(nextRotation.getDate() + this.config.kyberPreKeyRotationDays);

    await this.prisma.signalKeyRotation.upsert({
      where: {
        userId_keyType: {
          userId,
          keyType: 'kyber_pre_key',
        },
      },
      create: {
        userId,
        keyType: 'kyber_pre_key',
        lastRotatedAt: now,
        nextRotationAt: nextRotation,
        intervalDays: this.config.kyberPreKeyRotationDays,
        autoRotate: true,
      },
      update: {
        lastRotatedAt: now,
        nextRotationAt: nextRotation,
      },
    });

    return true;
  }

  /**
   * Check and replenish one-time pre-keys if running low
   */
  private async checkAndReplenishPreKeys(userId: string): Promise<boolean> {
    // Count unused pre-keys
    const unusedCount = await this.prisma.signalPreKey.count({
      where: {
        userId,
        isUsed: false,
      },
    });

    if (unusedCount >= this.config.minPreKeysCount) {
      return false;
    }

    // Generate new pre-keys
    const store = new PrismaPreKeyStore(this.prisma, userId);
    const startId = Date.now();

    for (let i = 0; i < this.config.preKeysReplenishCount; i++) {
      const keyPair = SignalProtocol.PrivateKey.generate();
      const preKeyRecord = SignalProtocol.PreKeyRecord.new(
        startId + i,
        keyPair.getPublicKey(),
        keyPair
      );

      await store.savePreKey(startId + i, preKeyRecord);
    }

    // Update rotation schedule
    const now = new Date();
    await this.prisma.signalKeyRotation.upsert({
      where: {
        userId_keyType: {
          userId,
          keyType: 'pre_keys',
        },
      },
      create: {
        userId,
        keyType: 'pre_keys',
        lastRotatedAt: now,
        nextRotationAt: now, // Check again next time
        intervalDays: 0, // On-demand replenishment
        autoRotate: true,
      },
      update: {
        lastRotatedAt: now,
      },
    });

    return true;
  }

  /**
   * Cleanup expired keys
   */
  private async cleanupExpiredKeys(userId: string): Promise<number> {
    let totalCleaned = 0;

    // Cleanup expired signed pre-keys (keep most recent one)
    const signedPreKeys = await this.prisma.signalSignedPreKey.findMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      skip: 1, // Keep the most recent one even if expired
    });

    if (signedPreKeys.length > 0) {
      const idsToDelete = signedPreKeys.map((k) => k.id);
      const result = await this.prisma.signalSignedPreKey.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      totalCleaned += result.count;
    }

    // Cleanup expired Kyber pre-keys (keep most recent unused one)
    const kyberPreKeys = await this.prisma.signalKyberPreKey.findMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
        used: true, // Only delete used ones
      },
    });

    if (kyberPreKeys.length > 0) {
      const idsToDelete = kyberPreKeys.map((k) => k.id);
      const result = await this.prisma.signalKyberPreKey.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      totalCleaned += result.count;
    }

    // Cleanup old used pre-keys (older than 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.prisma.signalPreKey.deleteMany({
      where: {
        userId,
        isUsed: true,
        usedAt: { lt: ninetyDaysAgo },
      },
    });
    totalCleaned += result.count;

    return totalCleaned;
  }

  /**
   * Force rotate all keys for a user
   */
  async forceRotateAllKeys(userId: string): Promise<{
    signedPreKeyRotated: boolean;
    kyberPreKeyRotated: boolean;
    preKeysReplenished: boolean;
  }> {
    // Temporarily enable auto-rotate and set next rotation to now
    await this.prisma.signalKeyRotation.updateMany({
      where: { userId },
      data: {
        nextRotationAt: new Date(),
        autoRotate: true,
      },
    });

    const result = await this.checkAndRotateKeys(userId);

    return {
      signedPreKeyRotated: result.signedPreKeyRotated,
      kyberPreKeyRotated: result.kyberPreKeyRotated,
      preKeysReplenished: result.preKeysReplenished,
    };
  }

  /**
   * Get key rotation status for a user
   */
  async getRotationStatus(userId: string): Promise<{
    signedPreKey: {
      lastRotated: Date | null;
      nextRotation: Date | null;
      daysUntilRotation: number | null;
    };
    kyberPreKey: {
      lastRotated: Date | null;
      nextRotation: Date | null;
      daysUntilRotation: number | null;
    };
    preKeys: {
      total: number;
      unused: number;
      used: number;
      needsReplenishment: boolean;
    };
  }> {
    const rotations = await this.prisma.signalKeyRotation.findMany({
      where: { userId },
    });

    const signedPreKeyRotation = rotations.find(
      (r) => r.keyType === 'signed_pre_key'
    );
    const kyberPreKeyRotation = rotations.find(
      (r) => r.keyType === 'kyber_pre_key'
    );

    const now = new Date();

    const preKeyStats = await this.prisma.signalPreKey.groupBy({
      by: ['isUsed'],
      where: { userId },
      _count: true,
    });

    const total = preKeyStats.reduce((sum, stat) => sum + stat._count, 0);
    const unused =
      preKeyStats.find((stat) => !stat.isUsed)?._count || 0;
    const used = preKeyStats.find((stat) => stat.isUsed)?._count || 0;

    return {
      signedPreKey: {
        lastRotated: signedPreKeyRotation?.lastRotatedAt || null,
        nextRotation: signedPreKeyRotation?.nextRotationAt || null,
        daysUntilRotation: signedPreKeyRotation
          ? Math.ceil(
              (signedPreKeyRotation.nextRotationAt.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      },
      kyberPreKey: {
        lastRotated: kyberPreKeyRotation?.lastRotatedAt || null,
        nextRotation: kyberPreKeyRotation?.nextRotationAt || null,
        daysUntilRotation: kyberPreKeyRotation
          ? Math.ceil(
              (kyberPreKeyRotation.nextRotationAt.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      },
      preKeys: {
        total,
        unused,
        used,
        needsReplenishment: unused < this.config.minPreKeysCount,
      },
    };
  }
}

/**
 * Create a key rotation service
 */
export function createKeyRotationService(
  prisma: PrismaClient,
  config?: KeyRotationConfig
): SignalKeyRotationService {
  return new SignalKeyRotationService(prisma, config);
}

/**
 * Setup automatic key rotation job
 * Call this function in your server initialization to start automatic rotation
 */
export function setupAutomaticKeyRotation(
  prisma: PrismaClient,
  config?: KeyRotationConfig & { intervalMinutes?: number }
): NodeJS.Timeout {
  const service = createKeyRotationService(prisma, config);
  const intervalMinutes = config?.intervalMinutes || 60; // Default: check every hour

  const intervalId = setInterval(async () => {
    try {
      // Get all users who need key rotation
      const now = new Date();
      const rotations = await prisma.signalKeyRotation.findMany({
        where: {
          nextRotationAt: { lte: now },
          autoRotate: true,
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      // Rotate keys for each user
      for (const { userId } of rotations) {
        await service.checkAndRotateKeys(userId);
      }
    } catch (error) {
      console.error('Automatic key rotation failed:', error);
    }
  }, intervalMinutes * 60 * 1000);

  return intervalId;
}
