/**
 * Encryption Module Exports
 *
 * Main entry point for encryption functionality
 */

export { encryptionService, EncryptionService } from './encryption-service';
export { keyStorage } from './key-storage';
export * from './crypto-utils';

// Re-export types from shared
export type {
  EncryptionMode,
  EncryptionProtocol,
  EncryptionPreference,
  EncryptedPayload,
  EncryptionMetadata,
  SignalKeyBundle,
  ServerEncryptionKey,
  EncryptionStatus,
} from '@/shared/types/encryption';

export {
  isMessageEncrypted,
  canAutoTranslate,
  getEncryptionStatus,
} from '@/shared/types/encryption';
