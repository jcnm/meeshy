/**
 * Signal Protocol Type Definitions
 *
 * Type definitions and interfaces for Signal Protocol integration.
 * These types wrap the @signalapp/libsignal-client types for easier use.
 */

import type {
  ProtocolAddress,
  IdentityKeyPair,
  PublicKey,
  PrivateKey,
  SessionRecord,
  PreKeyRecord,
  SignedPreKeyRecord,
  KyberPreKeyRecord,
  SenderKeyRecord,
} from '@signalapp/libsignal-client';

/**
 * Pre-key bundle used for X3DH key agreement
 */
export interface PreKeyBundle {
  registrationId: number;
  deviceId: number;
  preKeyId: number | null;
  preKeyPublic: Uint8Array | null;
  signedPreKeyId: number;
  signedPreKeyPublic: Uint8Array;
  signedPreKeySignature: Uint8Array;
  identityKey: Uint8Array;
  kyberPreKeyId?: number;
  kyberPreKeyPublic?: Uint8Array;
  kyberPreKeySignature?: Uint8Array;
}

/**
 * Serialized key bundle for storage
 */
export interface SerializedKeyBundle {
  identityKeyPair: Uint8Array;
  registrationId: number;
  deviceId: number;
  preKeys: Array<{
    id: number;
    record: Uint8Array;
  }>;
  signedPreKeys: Array<{
    id: number;
    record: Uint8Array;
    timestamp: number;
  }>;
  kyberPreKeys?: Array<{
    id: number;
    record: Uint8Array;
    timestamp: number;
  }>;
}

/**
 * Session information
 */
export interface SessionInfo {
  recipientAddress: string;
  deviceId: number;
  sessionRecord: Uint8Array;
  createdAt: number;
  lastUsed: number;
}

/**
 * Signal Protocol message types
 */
export enum SignalMessageType {
  PreKey = 3,
  Message = 2,
  SenderKey = 7,
}

/**
 * Encrypted message payload for Signal Protocol
 */
export interface SignalEncryptedMessage {
  type: SignalMessageType;
  registrationId: number;
  body: Uint8Array;
  deviceId?: number;
}

/**
 * Signal Protocol session state
 */
export interface SignalSessionState {
  hasSession: boolean;
  recipientAddress: string;
  deviceId: number;
  lastMessageTime?: number;
}

/**
 * Re-export Signal Protocol types for convenience
 */
export type {
  ProtocolAddress,
  IdentityKeyPair,
  PublicKey,
  PrivateKey,
  SessionRecord,
  PreKeyRecord,
  SignedPreKeyRecord,
  KyberPreKeyRecord,
  SenderKeyRecord,
};
