/**
 * Signal Protocol Types
 *
 * Type definitions for Signal Protocol implementation.
 * These types are used for E2EE (End-to-End Encryption) with Signal Protocol.
 */

/**
 * Pre-Key Bundle for initial key exchange
 */
export interface PreKeyBundle {
  registrationId: number;
  deviceId: number;
  preKeyId: number;
  preKeyPublic: Uint8Array;
  signedPreKeyId: number;
  signedPreKeyPublic: Uint8Array;
  signedPreKeySignature: Uint8Array;
  identityKey: Uint8Array;
}

/**
 * Signed Pre-Key for key rotation
 */
export interface SignedPreKey {
  keyId: number;
  publicKey: Uint8Array;
  signature: Uint8Array;
}

/**
 * Pre-Key for forward secrecy
 */
export interface PreKey {
  keyId: number;
  publicKey: Uint8Array;
}

/**
 * Identity Key for user identification
 */
export interface IdentityKey {
  publicKey: Uint8Array;
}

/**
 * Key Pair with public and private components
 */
export interface SignalKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Session state for a conversation
 */
export interface SessionState {
  remoteIdentityKey: Uint8Array;
  localIdentityKey: Uint8Array;
  rootKey: Uint8Array;
  chainKey: Uint8Array;
  messageIndex: number;
}

/**
 * Encrypted message with Signal Protocol
 */
export interface SignalMessage {
  type: 'prekey' | 'whisper';
  registrationId: number;
  deviceId: number;
  ciphertext: Uint8Array;
}

/**
 * Direction for identity key trust decisions
 */
export enum Direction {
  Sending = 0,
  Receiving = 1,
}

/**
 * Trust level for identity keys
 */
export enum TrustLevel {
  Untrusted = 0,
  TrustedUnverified = 1,
  TrustedVerified = 2,
}

/**
 * Result of identity key verification
 */
export interface IdentityKeyVerification {
  trusted: boolean;
  trustLevel: TrustLevel;
  fingerprint: string;
}

/**
 * Distribution ID for sender key groups
 */
export type DistributionId = string;

/**
 * Sender Key distribution message
 */
export interface SenderKeyDistributionMessage {
  distributionId: DistributionId;
  chainId: number;
  iteration: number;
  chainKey: Uint8Array;
  signatureKey: Uint8Array;
}
