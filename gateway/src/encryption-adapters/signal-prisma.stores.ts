/**
 * Prisma-based Storage for Signal Protocol
 *
 * Production-ready persistent storage implementations for Signal Protocol
 * using Prisma and MongoDB
 */

import * as SignalProtocol from '@signalapp/libsignal-client';
import type { PrismaClient } from '@meeshy/shared/client';

/**
 * Prisma Session Store
 */
export class PrismaSessionStore extends SignalProtocol.SessionStore {
  constructor(
    private prisma: PrismaClient,
    private userId: string
  ) {
    super();
  }

  async saveSession(
    name: SignalProtocol.ProtocolAddress,
    record: SignalProtocol.SessionRecord
  ): Promise<void> {
    const address = `${name.name()}.${name.deviceId()}`;
    const serialized = record.serialize();

    await this.prisma.signalSession.upsert({
      where: { address },
      create: {
        address,
        userId: this.userId,
        remoteUserId: name.name(),
        deviceId: name.deviceId(),
        record: Buffer.from(serialized),
      },
      update: {
        record: Buffer.from(serialized),
        updatedAt: new Date(),
      },
    });
  }

  async getSession(
    name: SignalProtocol.ProtocolAddress
  ): Promise<SignalProtocol.SessionRecord | null> {
    const address = `${name.name()}.${name.deviceId()}`;

    const session = await this.prisma.signalSession.findUnique({
      where: { address },
    });

    if (!session) {
      return null;
    }

    return SignalProtocol.SessionRecord.deserialize(
      new Uint8Array(session.record)
    );
  }

  async getExistingSessions(
    addresses: SignalProtocol.ProtocolAddress[]
  ): Promise<SignalProtocol.SessionRecord[]> {
    const addressStrings = addresses.map(
      (addr) => `${addr.name()}.${addr.deviceId()}`
    );

    const sessions = await this.prisma.signalSession.findMany({
      where: {
        address: { in: addressStrings },
      },
    });

    return sessions.map((session) =>
      SignalProtocol.SessionRecord.deserialize(
        new Uint8Array(session.record)
      )
    );
  }
}

/**
 * Prisma Identity Key Store
 */
export class PrismaIdentityKeyStore extends SignalProtocol.IdentityKeyStore {
  private identityKey: SignalProtocol.PrivateKey;
  private registrationId: number;

  constructor(
    private prisma: PrismaClient,
    private userId: string,
    identityKey: SignalProtocol.PrivateKey,
    registrationId: number
  ) {
    super();
    this.identityKey = identityKey;
    this.registrationId = registrationId;
  }

  async getIdentityKey(): Promise<SignalProtocol.PrivateKey> {
    return this.identityKey;
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.registrationId;
  }

  async saveIdentity(
    name: SignalProtocol.ProtocolAddress,
    key: SignalProtocol.PublicKey
  ): Promise<SignalProtocol.IdentityChange> {
    const address = name.name();
    const identityKey = Buffer.from(key.serialize());

    const existing = await this.prisma.signalIdentity.findUnique({
      where: { address },
    });

    await this.prisma.signalIdentity.upsert({
      where: { address },
      create: {
        address,
        ourUserId: this.userId,
        identityKey,
      },
      update: {
        identityKey,
      },
    });

    if (existing && !existing.identityKey.equals(identityKey)) {
      return SignalProtocol.IdentityChange.ReplacedExisting;
    }

    return SignalProtocol.IdentityChange.NewOrUnchanged;
  }

  async isTrustedIdentity(
    name: SignalProtocol.ProtocolAddress,
    key: SignalProtocol.PublicKey,
    direction: SignalProtocol.Direction
  ): Promise<boolean> {
    const address = name.name();

    const identity = await this.prisma.signalIdentity.findUnique({
      where: { address },
    });

    if (!identity) {
      // First time seeing this identity, trust it
      return true;
    }

    const trustedKey = SignalProtocol.PublicKey.deserialize(
      new Uint8Array(identity.identityKey)
    );

    return trustedKey.compare(key) === 0;
  }

  async getIdentity(
    name: SignalProtocol.ProtocolAddress
  ): Promise<SignalProtocol.PublicKey | null> {
    const address = name.name();

    const identity = await this.prisma.signalIdentity.findUnique({
      where: { address },
    });

    if (!identity) {
      return null;
    }

    return SignalProtocol.PublicKey.deserialize(
      new Uint8Array(identity.identityKey)
    );
  }
}

/**
 * Prisma Pre-Key Store
 */
export class PrismaPreKeyStore extends SignalProtocol.PreKeyStore {
  constructor(
    private prisma: PrismaClient,
    private userId: string
  ) {
    super();
  }

  async savePreKey(
    id: number,
    record: SignalProtocol.PreKeyRecord
  ): Promise<void> {
    const serialized = record.serialize();

    await this.prisma.signalPreKey.upsert({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
      create: {
        userId: this.userId,
        keyId: id,
        record: Buffer.from(serialized),
      },
      update: {
        record: Buffer.from(serialized),
      },
    });
  }

  async getPreKey(id: number): Promise<SignalProtocol.PreKeyRecord> {
    const preKey = await this.prisma.signalPreKey.findUnique({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
    });

    if (!preKey) {
      throw new Error(`PreKey ${id} not found for user ${this.userId}`);
    }

    return SignalProtocol.PreKeyRecord.deserialize(
      new Uint8Array(preKey.record)
    );
  }

  async removePreKey(id: number): Promise<void> {
    await this.prisma.signalPreKey.delete({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
    });
  }

  /**
   * Get all unused pre-keys for this user
   */
  async getUnusedPreKeys(): Promise<SignalProtocol.PreKeyRecord[]> {
    const preKeys = await this.prisma.signalPreKey.findMany({
      where: {
        userId: this.userId,
        isUsed: false,
      },
    });

    return preKeys.map((pk) =>
      SignalProtocol.PreKeyRecord.deserialize(new Uint8Array(pk.record))
    );
  }

  /**
   * Mark a pre-key as used
   */
  async markPreKeyAsUsed(id: number): Promise<void> {
    await this.prisma.signalPreKey.update({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });
  }
}

/**
 * Prisma Signed Pre-Key Store
 */
export class PrismaSignedPreKeyStore extends SignalProtocol.SignedPreKeyStore {
  constructor(
    private prisma: PrismaClient,
    private userId: string
  ) {
    super();
  }

  async saveSignedPreKey(
    id: number,
    record: SignalProtocol.SignedPreKeyRecord
  ): Promise<void> {
    const serialized = record.serialize();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

    await this.prisma.signalSignedPreKey.upsert({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
      create: {
        userId: this.userId,
        keyId: id,
        record: Buffer.from(serialized),
        expiresAt,
      },
      update: {
        record: Buffer.from(serialized),
        expiresAt,
      },
    });
  }

  async getSignedPreKey(id: number): Promise<SignalProtocol.SignedPreKeyRecord> {
    const signedPreKey = await this.prisma.signalSignedPreKey.findUnique({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
    });

    if (!signedPreKey) {
      throw new Error(`SignedPreKey ${id} not found for user ${this.userId}`);
    }

    return SignalProtocol.SignedPreKeyRecord.deserialize(
      new Uint8Array(signedPreKey.record)
    );
  }

  /**
   * Get the current signed pre-key (most recent)
   */
  async getCurrentSignedPreKey(): Promise<SignalProtocol.SignedPreKeyRecord | null> {
    const signedPreKey = await this.prisma.signalSignedPreKey.findFirst({
      where: { userId: this.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!signedPreKey) {
      return null;
    }

    return SignalProtocol.SignedPreKeyRecord.deserialize(
      new Uint8Array(signedPreKey.record)
    );
  }

  /**
   * Clean up expired signed pre-keys
   */
  async cleanupExpiredSignedPreKeys(): Promise<number> {
    const result = await this.prisma.signalSignedPreKey.deleteMany({
      where: {
        userId: this.userId,
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}

/**
 * Prisma Kyber Pre-Key Store
 */
export class PrismaKyberPreKeyStore extends SignalProtocol.KyberPreKeyStore {
  constructor(
    private prisma: PrismaClient,
    private userId: string
  ) {
    super();
  }

  async saveKyberPreKey(
    id: number,
    record: SignalProtocol.KyberPreKeyRecord
  ): Promise<void> {
    const serialized = record.serialize();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

    await this.prisma.signalKyberPreKey.upsert({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
      create: {
        userId: this.userId,
        keyId: id,
        record: Buffer.from(serialized),
        expiresAt,
      },
      update: {
        record: Buffer.from(serialized),
        expiresAt,
      },
    });
  }

  async getKyberPreKey(id: number): Promise<SignalProtocol.KyberPreKeyRecord> {
    const kyberPreKey = await this.prisma.signalKyberPreKey.findUnique({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: id,
        },
      },
    });

    if (!kyberPreKey) {
      throw new Error(`KyberPreKey ${id} not found for user ${this.userId}`);
    }

    return SignalProtocol.KyberPreKeyRecord.deserialize(
      new Uint8Array(kyberPreKey.record)
    );
  }

  async markKyberPreKeyUsed(
    kyberPreKeyId: number,
    signedPreKeyId: number,
    baseKey: SignalProtocol.PublicKey
  ): Promise<void> {
    await this.prisma.signalKyberPreKey.update({
      where: {
        userId_keyId: {
          userId: this.userId,
          keyId: kyberPreKeyId,
        },
      },
      data: {
        used: true,
        usedAt: new Date(),
        signedPreKeyId,
      },
    });
  }

  /**
   * Get an unused Kyber pre-key
   */
  async getUnusedKyberPreKey(): Promise<SignalProtocol.KyberPreKeyRecord | null> {
    const kyberPreKey = await this.prisma.signalKyberPreKey.findFirst({
      where: {
        userId: this.userId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!kyberPreKey) {
      return null;
    }

    return SignalProtocol.KyberPreKeyRecord.deserialize(
      new Uint8Array(kyberPreKey.record)
    );
  }

  /**
   * Clean up expired Kyber pre-keys
   */
  async cleanupExpiredKyberPreKeys(): Promise<number> {
    const result = await this.prisma.signalKyberPreKey.deleteMany({
      where: {
        userId: this.userId,
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}

/**
 * Initialize Signal Protocol stores for a user
 *
 * This function loads or creates the user's identity key pair and
 * initializes all required stores with Prisma backends
 */
export async function initializeSignalStores(
  prisma: PrismaClient,
  userId: string
): Promise<{
  sessionStore: PrismaSessionStore;
  identityStore: PrismaIdentityKeyStore;
  preKeyStore: PrismaPreKeyStore;
  signedPreKeyStore: PrismaSignedPreKeyStore;
  kyberPreKeyStore: PrismaKyberPreKeyStore;
}> {
  // Load or create identity key pair
  let identityKeyPair = await prisma.signalIdentityKeyPair.findUnique({
    where: { userId },
  });

  let identityKey: SignalProtocol.PrivateKey;
  let registrationId: number;

  if (!identityKeyPair) {
    // Generate new identity
    identityKey = SignalProtocol.PrivateKey.generate();
    registrationId = Math.floor(Math.random() * 16384);

    // TODO: Encrypt private key with user's master key before storing
    // For now, storing unencrypted (NOT production-ready)
    await prisma.signalIdentityKeyPair.create({
      data: {
        userId,
        registrationId,
        privateKeyEnc: Buffer.from(identityKey.serialize()),
        publicKey: Buffer.from(identityKey.getPublicKey().serialize()),
      },
    });
  } else {
    // TODO: Decrypt private key using user's master key
    // For now, reading unencrypted (NOT production-ready)
    identityKey = SignalProtocol.PrivateKey.deserialize(
      new Uint8Array(identityKeyPair.privateKeyEnc)
    );
    registrationId = identityKeyPair.registrationId;
  }

  // Initialize stores
  const sessionStore = new PrismaSessionStore(prisma, userId);
  const identityStore = new PrismaIdentityKeyStore(
    prisma,
    userId,
    identityKey,
    registrationId
  );
  const preKeyStore = new PrismaPreKeyStore(prisma, userId);
  const signedPreKeyStore = new PrismaSignedPreKeyStore(prisma, userId);
  const kyberPreKeyStore = new PrismaKyberPreKeyStore(prisma, userId);

  return {
    sessionStore,
    identityStore,
    preKeyStore,
    signedPreKeyStore,
    kyberPreKeyStore,
  };
}
