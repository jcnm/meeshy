/**
 * Frontend Encryption Module
 *
 * Uses shared encryption logic with browser-specific adapters (Web Crypto API + IndexedDB).
 * Includes Signal Protocol support for end-to-end encryption.
 */

import { frontendEncryptionService, FrontendEncryptionService } from './FrontendEncryptionService';

// Export the singleton encryption service
export const encryptionService = frontendEncryptionService;
export { FrontendEncryptionService };

// Re-export adapters for advanced usage
export { webCryptoAdapter, indexedDBKeyStorageAdapter } from './adapters';

// Re-export shared types and utilities
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

export {
  prepareForStorage,
  reconstructPayload,
  validateMetadata,
} from '@/shared/encryption';
