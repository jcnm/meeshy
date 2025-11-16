/**
 * @meeshy/mls-core
 *
 * MLS (Messaging Layer Security) implementation for Meeshy
 * End-to-end encryption library for secure messaging
 *
 * Phase 1: Simple 1:1 conversations with TweetNaCl
 * Phase 2+: Full MLS protocol with OpenMLS (Rust bindings)
 *
 * @see https://datatracker.ietf.org/doc/rfc9420/
 * @see docs/dma-interoperability/
 */

// Re-export from shared types
export type {
  MLSCipherSuite,
  KeyPackageInfo,
  MLSGroupInfo,
  MLSGroupMember,
  EncryptedData,
  EncryptionType,
  MLSCredentialInfo,
  MLSCredentialType,
  MLSFeatureFlags,
  MLSStatistics,
  MLSHealthStatus,
  MLSAuditEvent,
  MLSAuditEventType,
  GenerateKeyPackagesRequest,
  GenerateKeyPackagesResponse,
  InitializeOneToOneConversationRequest,
  InitializeOneToOneConversationResponse,
  EncryptMessageRequest,
  EncryptMessageResponse,
  DecryptMessageRequest,
  DecryptMessageResponse,
} from '@meeshy/shared/types/mls';

export {
  MLSError,
  MLSErrorCode,
  DEFAULT_CIPHER_SUITE,
  DEFAULT_MLS_FEATURE_FLAGS,
  MIN_KEY_PACKAGES_PER_USER,
  DEFAULT_KEY_PACKAGES_COUNT,
  MAX_KEY_PACKAGES_COUNT,
  KEY_PACKAGE_EXPIRATION_DAYS,
  isValidKeyPackageId,
  isValidGroupId,
  isValidMLSIdentity,
  generateGroupId,
  generateMLSIdentity,
  isKeyPackageExpired,
  calculateKeyPackageExpiration,
} from '@meeshy/shared/types/mls';

// Export client
export { MLSClient, KeyPackageManager } from './client/index.js';

// Export utils
export * as crypto from './utils/index.js';
