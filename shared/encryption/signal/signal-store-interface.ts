/**
 * Signal Protocol Store Interface
 *
 * Platform-agnostic interfaces for Signal Protocol storage.
 * Implementations will use database (Node.js) or IndexedDB (Browser).
 */

import type {
  ProtocolAddress,
  IdentityKeyPair,
  PublicKey,
  PreKeyRecord,
  SignedPreKeyRecord,
  KyberPreKeyRecord,
  SessionRecord,
  SenderKeyRecord,
} from '@signalapp/libsignal-client';

/**
 * Direction for identity key trust decisions
 */
export enum Direction {
  Sending = 0,
  Receiving = 1,
}

/**
 * Identity Key Store
 * Manages identity keys and trust decisions
 */
export interface SignalIdentityKeyStore {
  /**
   * Get the local identity key pair
   */
  getIdentityKeyPair(): Promise<IdentityKeyPair>;

  /**
   * Get the local registration ID
   */
  getLocalRegistrationId(): Promise<number>;

  /**
   * Save an identity key for a remote address
   */
  saveIdentity(address: ProtocolAddress, identityKey: PublicKey): Promise<boolean>;

  /**
   * Check if an identity is trusted
   */
  isTrustedIdentity(
    address: ProtocolAddress,
    identityKey: PublicKey,
    direction: Direction
  ): Promise<boolean>;

  /**
   * Get the identity key for a remote address
   */
  getIdentity(address: ProtocolAddress): Promise<PublicKey | null>;
}

/**
 * Pre-Key Store
 * Manages one-time pre-keys
 */
export interface SignalPreKeyStore {
  /**
   * Get a pre-key record by ID
   */
  getPreKey(preKeyId: number): Promise<PreKeyRecord>;

  /**
   * Save a pre-key record
   */
  savePreKey(preKeyId: number, record: PreKeyRecord): Promise<void>;

  /**
   * Remove a pre-key record (after it's been used)
   */
  removePreKey(preKeyId: number): Promise<void>;
}

/**
 * Signed Pre-Key Store
 * Manages signed pre-keys (rotated periodically)
 */
export interface SignalSignedPreKeyStore {
  /**
   * Get a signed pre-key record by ID
   */
  getSignedPreKey(signedPreKeyId: number): Promise<SignedPreKeyRecord>;

  /**
   * Save a signed pre-key record
   */
  saveSignedPreKey(signedPreKeyId: number, record: SignedPreKeyRecord): Promise<void>;
}

/**
 * Kyber Pre-Key Store
 * Manages post-quantum Kyber pre-keys
 */
export interface SignalKyberPreKeyStore {
  /**
   * Get a Kyber pre-key record by ID
   */
  getKyberPreKey(kyberPreKeyId: number): Promise<KyberPreKeyRecord>;

  /**
   * Save a Kyber pre-key record
   */
  saveKyberPreKey(kyberPreKeyId: number, record: KyberPreKeyRecord): Promise<void>;

  /**
   * Mark a Kyber pre-key as used
   */
  markKyberPreKeyUsed(kyberPreKeyId: number): Promise<void>;
}

/**
 * Session Store
 * Manages Signal Protocol sessions with other users
 */
export interface SignalSessionStore {
  /**
   * Get a session record
   */
  getSession(address: ProtocolAddress): Promise<SessionRecord | null>;

  /**
   * Save a session record
   */
  saveSession(address: ProtocolAddress, record: SessionRecord): Promise<void>;

  /**
   * Get all session records for a name (across devices)
   */
  getExistingSessions(addresses: ProtocolAddress[]): Promise<ProtocolAddress[]>;
}

/**
 * Sender Key Store
 * Manages sender keys for group messaging
 */
export interface SignalSenderKeyStore {
  /**
   * Store a sender key record
   */
  storeSenderKey(
    sender: ProtocolAddress,
    distributionId: string,
    record: SenderKeyRecord
  ): Promise<void>;

  /**
   * Load a sender key record
   */
  loadSenderKey(
    sender: ProtocolAddress,
    distributionId: string
  ): Promise<SenderKeyRecord | null>;
}

/**
 * Combined Signal Protocol stores
 */
export interface SignalProtocolStores {
  identityStore: SignalIdentityKeyStore;
  preKeyStore: SignalPreKeyStore;
  signedPreKeyStore: SignalSignedPreKeyStore;
  kyberPreKeyStore: SignalKyberPreKeyStore;
  sessionStore: SignalSessionStore;
  senderKeyStore: SignalSenderKeyStore;
}

/**
 * Configuration for Signal Protocol store initialization
 */
export interface SignalStoreConfig {
  userId: string;
  deviceId?: number;
}
