/**
 * Signal Protocol Adapter
 *
 * Implements E2E encryption using the Signal Protocol
 * Library: @signalapp/libsignal-client
 */

import * as SignalProtocol from '@signalapp/libsignal-client';
import {
  EncryptionAdapter,
  EncryptedMessage,
  KeyBundle,
} from './base.adapter';

/**
 * In-memory Session Store implementation
 */
class InMemorySessionStore extends SignalProtocol.SessionStore {
  private sessions = new Map<string, SignalProtocol.SessionRecord>();

  async saveSession(
    name: SignalProtocol.ProtocolAddress,
    record: SignalProtocol.SessionRecord
  ): Promise<void> {
    const key = `${name.name()}.${name.deviceId()}`;
    this.sessions.set(key, record);
  }

  async getSession(
    name: SignalProtocol.ProtocolAddress
  ): Promise<SignalProtocol.SessionRecord | null> {
    const key = `${name.name()}.${name.deviceId()}`;
    return this.sessions.get(key) || null;
  }

  async getExistingSessions(
    addresses: SignalProtocol.ProtocolAddress[]
  ): Promise<SignalProtocol.SessionRecord[]> {
    const records: SignalProtocol.SessionRecord[] = [];
    for (const addr of addresses) {
      const record = await this.getSession(addr);
      if (record) {
        records.push(record);
      }
    }
    return records;
  }
}

/**
 * In-memory Identity Key Store implementation
 */
class InMemoryIdentityKeyStore extends SignalProtocol.IdentityKeyStore {
  private identityKey: SignalProtocol.PrivateKey;
  private registrationId: number;
  private identities = new Map<string, SignalProtocol.PublicKey>();

  constructor(identityKey: SignalProtocol.PrivateKey, registrationId: number) {
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
    const identifier = name.name();
    const existing = this.identities.get(identifier);

    this.identities.set(identifier, key);

    if (existing && existing.compare(key) !== 0) {
      return SignalProtocol.IdentityChange.ReplacedExisting;
    }
    return SignalProtocol.IdentityChange.NewOrUnchanged;
  }

  async isTrustedIdentity(
    name: SignalProtocol.ProtocolAddress,
    key: SignalProtocol.PublicKey,
    direction: SignalProtocol.Direction
  ): Promise<boolean> {
    const identifier = name.name();
    const trusted = this.identities.get(identifier);

    if (!trusted) {
      // First time seeing this identity, trust it
      return true;
    }

    return trusted.compare(key) === 0;
  }

  async getIdentity(
    name: SignalProtocol.ProtocolAddress
  ): Promise<SignalProtocol.PublicKey | null> {
    const identifier = name.name();
    return this.identities.get(identifier) || null;
  }
}

/**
 * In-memory Pre-Key Store implementation
 */
class InMemoryPreKeyStore extends SignalProtocol.PreKeyStore {
  private preKeys = new Map<number, SignalProtocol.PreKeyRecord>();

  async savePreKey(
    id: number,
    record: SignalProtocol.PreKeyRecord
  ): Promise<void> {
    this.preKeys.set(id, record);
  }

  async getPreKey(id: number): Promise<SignalProtocol.PreKeyRecord> {
    const preKey = this.preKeys.get(id);
    if (!preKey) {
      throw new Error(`PreKey ${id} not found`);
    }
    return preKey;
  }

  async removePreKey(id: number): Promise<void> {
    this.preKeys.delete(id);
  }

  getAllPreKeys(): Array<{ id: number; record: SignalProtocol.PreKeyRecord }> {
    return Array.from(this.preKeys.entries()).map(([id, record]) => ({
      id,
      record,
    }));
  }
}

/**
 * In-memory Signed Pre-Key Store implementation
 */
class InMemorySignedPreKeyStore extends SignalProtocol.SignedPreKeyStore {
  private signedPreKeys = new Map<number, SignalProtocol.SignedPreKeyRecord>();

  async saveSignedPreKey(
    id: number,
    record: SignalProtocol.SignedPreKeyRecord
  ): Promise<void> {
    this.signedPreKeys.set(id, record);
  }

  async getSignedPreKey(id: number): Promise<SignalProtocol.SignedPreKeyRecord> {
    const signedPreKey = this.signedPreKeys.get(id);
    if (!signedPreKey) {
      throw new Error(`SignedPreKey ${id} not found`);
    }
    return signedPreKey;
  }

  getFirstSignedPreKey(): SignalProtocol.SignedPreKeyRecord | undefined {
    return Array.from(this.signedPreKeys.values())[0];
  }
}

/**
 * In-memory Kyber Pre-Key Store implementation
 */
class InMemoryKyberPreKeyStore extends SignalProtocol.KyberPreKeyStore {
  private kyberPreKeys = new Map<number, SignalProtocol.KyberPreKeyRecord>();

  async saveKyberPreKey(
    id: number,
    record: SignalProtocol.KyberPreKeyRecord
  ): Promise<void> {
    this.kyberPreKeys.set(id, record);
  }

  async getKyberPreKey(id: number): Promise<SignalProtocol.KyberPreKeyRecord> {
    const kyberPreKey = this.kyberPreKeys.get(id);
    if (!kyberPreKey) {
      throw new Error(`KyberPreKey ${id} not found`);
    }
    return kyberPreKey;
  }

  async markKyberPreKeyUsed(
    kyberPreKeyId: number,
    signedPreKeyId: number,
    baseKey: SignalProtocol.PublicKey
  ): Promise<void> {
    // In a real implementation, you might track used keys
    // For now, we just acknowledge the usage
  }

  getFirstKyberPreKey(): SignalProtocol.KyberPreKeyRecord | undefined {
    return Array.from(this.kyberPreKeys.values())[0];
  }
}

/**
 * Signal Protocol Encryption Adapter
 */
export class SignalProtocolAdapter implements EncryptionAdapter {
  private sessionStore: InMemorySessionStore | null = null;
  private identityStore: InMemoryIdentityKeyStore | null = null;
  private preKeyStore: InMemoryPreKeyStore | null = null;
  private signedPreKeyStore: InMemorySignedPreKeyStore | null = null;
  private kyberPreKeyStore: InMemoryKyberPreKeyStore | null = null;
  private userId: string = '';

  async initialize(userId: string): Promise<void> {
    this.userId = userId;

    // Generate identity key pair
    const identityKey = SignalProtocol.PrivateKey.generate();
    const registrationId = Math.floor(Math.random() * 16384);

    // Initialize stores
    this.sessionStore = new InMemorySessionStore();
    this.identityStore = new InMemoryIdentityKeyStore(identityKey, registrationId);
    this.preKeyStore = new InMemoryPreKeyStore();
    this.signedPreKeyStore = new InMemorySignedPreKeyStore();
    this.kyberPreKeyStore = new InMemoryKyberPreKeyStore();

    // Generate pre-keys (100 one-time pre-keys)
    for (let i = 1; i <= 100; i++) {
      const keyPair = SignalProtocol.PrivateKey.generate();
      const preKeyRecord = SignalProtocol.PreKeyRecord.new(
        i,
        keyPair.getPublicKey(),
        keyPair
      );
      await this.preKeyStore.savePreKey(i, preKeyRecord);
    }

    // Generate signed pre-key
    const signedPreKeyPair = SignalProtocol.PrivateKey.generate();
    const signedPreKeyPublic = signedPreKeyPair.getPublicKey();
    const signedPreKeySignature = identityKey.sign(
      signedPreKeyPublic.serialize()
    );
    const signedPreKeyRecord = SignalProtocol.SignedPreKeyRecord.new(
      1,
      Date.now(),
      signedPreKeyPublic,
      signedPreKeyPair,
      signedPreKeySignature
    );
    await this.signedPreKeyStore.saveSignedPreKey(1, signedPreKeyRecord);

    // Generate Kyber pre-key (post-quantum)
    const kyberKeyPair = SignalProtocol.KEMKeyPair.generate();
    const kyberPublicKey = kyberKeyPair.getPublicKey();
    const kyberSignature = identityKey.sign(kyberPublicKey.serialize());
    const kyberPreKeyRecord = SignalProtocol.KyberPreKeyRecord.new(
      1,
      Date.now(),
      kyberKeyPair,
      kyberSignature
    );
    await this.kyberPreKeyStore.saveKyberPreKey(1, kyberPreKeyRecord);
  }

  async encrypt(
    recipientId: string,
    message: string
  ): Promise<EncryptedMessage> {
    this.ensureInitialized();

    const address = SignalProtocol.ProtocolAddress.new(recipientId, 1);
    const messageBuffer = Buffer.from(message, 'utf-8');

    // Encrypt using Signal Protocol
    const ciphertext = await SignalProtocol.signalEncrypt(
      messageBuffer,
      address,
      this.sessionStore!,
      this.identityStore!
    );

    return {
      type: ciphertext.type(),
      body: ciphertext.serialize(),
      recipientId,
      timestamp: Date.now(),
    };
  }

  async decrypt(
    senderId: string,
    encrypted: EncryptedMessage
  ): Promise<string> {
    this.ensureInitialized();

    const address = SignalProtocol.ProtocolAddress.new(senderId, 1);
    let plaintext: Uint8Array;

    if (encrypted.type === SignalProtocol.CiphertextMessageType.PreKey) {
      // PreKey message - establish new session
      const prekeyMessage = SignalProtocol.PreKeySignalMessage.deserialize(
        Buffer.from(encrypted.body)
      );

      plaintext = await SignalProtocol.signalDecryptPreKey(
        prekeyMessage,
        address,
        this.sessionStore!,
        this.identityStore!,
        this.preKeyStore!,
        this.signedPreKeyStore!,
        this.kyberPreKeyStore!
      );
    } else {
      // Normal message
      const signalMessage = SignalProtocol.SignalMessage.deserialize(
        Buffer.from(encrypted.body)
      );

      plaintext = await SignalProtocol.signalDecrypt(
        signalMessage,
        address,
        this.sessionStore!,
        this.identityStore!
      );
    }

    return Buffer.from(plaintext).toString('utf-8');
  }

  getProtocolName(): 'signal' | 'mls' {
    return 'signal';
  }

  async getKeyBundle(): Promise<KeyBundle> {
    this.ensureInitialized();

    const identityKey = await this.identityStore!.getIdentityKey();
    const registrationId = await this.identityStore!.getLocalRegistrationId();
    const signedPreKey = this.signedPreKeyStore!.getFirstSignedPreKey();
    const kyberPreKey = this.kyberPreKeyStore!.getFirstKyberPreKey();

    if (!signedPreKey) {
      throw new Error('No signed pre-key available');
    }

    if (!kyberPreKey) {
      throw new Error('No Kyber pre-key available');
    }

    // Get first 10 one-time pre-keys
    const preKeys = this.preKeyStore!.getAllPreKeys().slice(0, 10);

    return {
      identityKey: identityKey.getPublicKey().serialize(),
      registrationId,
      signedPreKey: {
        keyId: signedPreKey.id(),
        publicKey: signedPreKey.publicKey().serialize(),
        signature: signedPreKey.signature(),
      },
      preKeys: preKeys.map((pk) => ({
        keyId: pk.id,
        publicKey: pk.record.publicKey().serialize(),
      })),
    };
  }

  async processKeyBundle(
    userId: string,
    keyBundle: KeyBundle
  ): Promise<void> {
    this.ensureInitialized();

    const address = SignalProtocol.ProtocolAddress.new(userId, 1);

    // Parse keys from bundle
    const identityKey = SignalProtocol.PublicKey.deserialize(
      Buffer.from(keyBundle.identityKey)
    );
    const signedPreKeyPublic = SignalProtocol.PublicKey.deserialize(
      Buffer.from(keyBundle.signedPreKey.publicKey)
    );

    // Get one-time pre-key (if available)
    const oneTimePreKey =
      keyBundle.preKeys.length > 0 ? keyBundle.preKeys[0] : null;
    const oneTimePreKeyPublic = oneTimePreKey
      ? SignalProtocol.PublicKey.deserialize(
          Buffer.from(oneTimePreKey.publicKey)
        )
      : null;

    // For now, create a simple PreKeyBundle without Kyber support
    // In production, you would parse and include Kyber keys from the bundle
    const dummyKyberKeyPair = SignalProtocol.KEMKeyPair.generate();
    const dummyKyberPublic = dummyKyberKeyPair.getPublicKey();
    const dummyKyberSignature = new Uint8Array(64); // Placeholder

    const preKeyBundle = SignalProtocol.PreKeyBundle.new(
      keyBundle.registrationId,
      1, // device ID
      oneTimePreKey ? oneTimePreKey.keyId : null,
      oneTimePreKeyPublic,
      keyBundle.signedPreKey.keyId,
      signedPreKeyPublic,
      Buffer.from(keyBundle.signedPreKey.signature),
      identityKey,
      1, // Kyber pre-key ID (placeholder)
      dummyKyberPublic,
      dummyKyberSignature
    );

    // Process the bundle to establish session
    await SignalProtocol.processPreKeyBundle(
      preKeyBundle,
      address,
      this.sessionStore!,
      this.identityStore!
    );
  }

  async cleanup(): Promise<void> {
    this.sessionStore = null;
    this.identityStore = null;
    this.preKeyStore = null;
    this.signedPreKeyStore = null;
    this.kyberPreKeyStore = null;
    this.userId = '';
  }

  private ensureInitialized(): void {
    if (
      !this.sessionStore ||
      !this.identityStore ||
      !this.preKeyStore ||
      !this.signedPreKeyStore ||
      !this.kyberPreKeyStore
    ) {
      throw new Error('Signal adapter not initialized');
    }
  }
}
