/**
 * MLS (Messaging Layer Security) Types
 *
 * Types for end-to-end encrypted messaging following the MLS protocol (RFC 9420)
 * Used for DMA (Digital Markets Act) compliance and interoperability
 *
 * @see https://datatracker.ietf.org/doc/rfc9420/
 * @see docs/dma-interoperability/
 */

// ===== CIPHER SUITES =====

/**
 * Supported MLS cipher suites
 *
 * Phase 1: Using only MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519
 * Phase 2+: May add more cipher suites for interoperability
 */
export type MLSCipherSuite =
  | 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
  | 'MLS_128_DHKEMP256_AES128GCM_SHA256_P256'
  | 'MLS_256_DHKEMX448_AES256GCM_SHA512_Ed448';

/**
 * Default cipher suite for Phase 1
 */
export const DEFAULT_CIPHER_SUITE: MLSCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';

// ===== KEY PACKAGE TYPES =====

/**
 * Information about a KeyPackage
 * Used for initializing encrypted conversations
 */
export interface KeyPackageInfo {
  readonly keyPackageId: string;
  readonly publicKey: string;      // Base64 encoded
  readonly cipherSuite: MLSCipherSuite;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/**
 * Request to generate new KeyPackages
 */
export interface GenerateKeyPackagesRequest {
  readonly userId: string;
  readonly count?: number;          // Default: 5
  readonly cipherSuite?: MLSCipherSuite;
}

/**
 * Response containing generated KeyPackages
 */
export interface GenerateKeyPackagesResponse {
  readonly keyPackages: readonly KeyPackageInfo[];
  readonly userId: string;
  readonly generated: number;
}

// ===== MLS GROUP TYPES =====

/**
 * Member of an MLS group
 */
export interface MLSGroupMember {
  readonly userId: string;
  readonly keyPackageId: string;
  readonly joinedAt?: Date;
}

/**
 * Information about an MLS group state
 */
export interface MLSGroupInfo {
  readonly groupId: string;
  readonly conversationId: string;
  readonly epoch: number;
  readonly cipherSuite: MLSCipherSuite;
  readonly members: readonly MLSGroupMember[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Request to initialize a 1:1 encrypted conversation
 */
export interface InitializeOneToOneConversationRequest {
  readonly conversationId: string;
  readonly initiatorUserId: string;
  readonly recipientUserId: string;
}

/**
 * Response after initializing a 1:1 conversation
 */
export interface InitializeOneToOneConversationResponse {
  readonly groupId: string;
  readonly conversationId: string;
  readonly initiatorKeyPackageId: string;
  readonly recipientKeyPackageId: string;
  readonly epoch: number;
}

/**
 * Request to add a member to an MLS group
 * (Phase 2+: For group conversations)
 */
export interface AddMemberRequest {
  readonly groupId: string;
  readonly userId: string;
  readonly keyPackageId: string;
}

/**
 * Request to remove a member from an MLS group
 * (Phase 2+: For group conversations)
 */
export interface RemoveMemberRequest {
  readonly groupId: string;
  readonly userId: string;
}

// ===== ENCRYPTION TYPES =====

/**
 * Type of encryption used for a message
 */
export type EncryptionType = 'none' | 'mls_1to1' | 'mls_group';

/**
 * Encrypted message data
 */
export interface EncryptedData {
  readonly ciphertext: string;      // Base64 encoded
  readonly nonce: string;           // Base64 encoded IV/nonce
  readonly senderKeyHash: string;   // Hash of the sender's key
  readonly encryptionType: EncryptionType;
  readonly groupEpoch?: number;     // Epoch when encrypted (for MLS groups)
}

/**
 * Request to encrypt a message
 */
export interface EncryptMessageRequest {
  readonly userId: string;
  readonly conversationId: string;
  readonly plaintext: string;
}

/**
 * Response containing encrypted message
 */
export interface EncryptMessageResponse {
  readonly encrypted: EncryptedData;
  readonly groupId?: string;
  readonly epoch?: number;
}

/**
 * Request to decrypt a message
 */
export interface DecryptMessageRequest {
  readonly userId: string;
  readonly conversationId: string;
  readonly ciphertext: string;
  readonly nonce: string;
  readonly groupEpoch?: number;
}

/**
 * Response containing decrypted message
 */
export interface DecryptMessageResponse {
  readonly plaintext: string;
  readonly verified: boolean;       // Signature verification status
  readonly senderUserId?: string;   // Identified sender (if verification succeeded)
}

// ===== CREDENTIAL TYPES =====

/**
 * Type of MLS credential
 */
export type MLSCredentialType = 'basic' | 'x509' | 'verified';

/**
 * MLS Credential information
 */
export interface MLSCredentialInfo {
  readonly userId: string;
  readonly identity: string;        // e.g., "user@meeshy.com" or "username@meeshy"
  readonly credentialType: MLSCredentialType;
  readonly signaturePublicKey: string;  // Base64 encoded
  readonly version: number;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

/**
 * Request to create an MLS credential for a user
 */
export interface CreateMLSCredentialRequest {
  readonly userId: string;
  readonly identity?: string;       // Default: {username}@meeshy
  readonly credentialType?: MLSCredentialType;
}

/**
 * Response after creating MLS credential
 */
export interface CreateMLSCredentialResponse {
  readonly credential: MLSCredentialInfo;
  readonly created: boolean;
}

// ===== AUDIT EVENT TYPES =====

/**
 * Types of MLS audit events
 */
export type MLSAuditEventType =
  | 'key_package_generated'
  | 'key_package_used'
  | 'group_created'
  | 'member_added'
  | 'member_removed'
  | 'epoch_updated'
  | 'encryption_success'
  | 'encryption_failed'
  | 'decryption_success'
  | 'decryption_failed'
  | 'credential_created'
  | 'credential_rotated';

/**
 * Severity levels for audit events
 */
export type MLSAuditSeverity = 'info' | 'warning' | 'error';

/**
 * MLS Audit Event
 */
export interface MLSAuditEvent {
  readonly id: string;
  readonly eventType: MLSAuditEventType;
  readonly severity: MLSAuditSeverity;
  readonly userId?: string;
  readonly conversationId?: string;
  readonly groupId?: string;
  readonly keyPackageId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly timestamp: Date;
}

/**
 * Request to log an MLS audit event
 */
export interface LogMLSAuditEventRequest {
  readonly eventType: MLSAuditEventType;
  readonly severity?: MLSAuditSeverity;
  readonly userId?: string;
  readonly conversationId?: string;
  readonly groupId?: string;
  readonly keyPackageId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

// ===== FEATURE FLAGS =====

/**
 * MLS Feature flags configuration
 */
export interface MLSFeatureFlags {
  readonly mlsEnabled: boolean;
  readonly mlsForNewConversations: boolean;
  readonly mlsOptional: boolean;
  readonly mlsFederationEnabled: boolean;
  readonly mlsGroupsEnabled: boolean;       // Phase 2+
  readonly mlsAuditEnabled: boolean;
}

/**
 * Default feature flags for Phase 1
 */
export const DEFAULT_MLS_FEATURE_FLAGS: MLSFeatureFlags = {
  mlsEnabled: true,
  mlsForNewConversations: true,
  mlsOptional: true,
  mlsFederationEnabled: false,      // Phase 3+
  mlsGroupsEnabled: false,          // Phase 2+
  mlsAuditEnabled: true,
};

// ===== STATUS AND HEALTH =====

/**
 * MLS Health status
 */
export interface MLSHealthStatus {
  readonly status: 'healthy' | 'warning' | 'error';
  readonly issues: readonly MLSHealthIssue[];
  readonly timestamp: Date;
}

/**
 * MLS Health issue
 */
export interface MLSHealthIssue {
  readonly severity: 'info' | 'warning' | 'error';
  readonly type: string;
  readonly message: string;
  readonly affectedUsers?: number;
  readonly count?: number;
}

/**
 * MLS Statistics
 */
export interface MLSStatistics {
  readonly users: {
    readonly total: number;
    readonly withKeyPackages: number;
    readonly percentage: string;
  };
  readonly keyPackages: {
    readonly total: number;
    readonly available: number;
    readonly expired: number;
    readonly used: number;
  };
  readonly conversations: {
    readonly total: number;
    readonly encrypted: number;
    readonly adoptionRate: string;
  };
  readonly messages: {
    readonly total: number;
    readonly encrypted: number;
    readonly encryptionRate: string;
  };
  readonly timestamp: Date;
}

// ===== ERROR TYPES =====

/**
 * MLS Error codes
 */
export enum MLSErrorCode {
  // KeyPackage errors
  NO_KEY_PACKAGES_AVAILABLE = 'NO_KEY_PACKAGES_AVAILABLE',
  KEY_PACKAGE_EXPIRED = 'KEY_PACKAGE_EXPIRED',
  KEY_PACKAGE_ALREADY_USED = 'KEY_PACKAGE_ALREADY_USED',

  // Group errors
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',
  GROUP_EPOCH_MISMATCH = 'GROUP_EPOCH_MISMATCH',
  NOT_GROUP_MEMBER = 'NOT_GROUP_MEMBER',

  // Encryption/Decryption errors
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',

  // Credential errors
  CREDENTIAL_NOT_FOUND = 'CREDENTIAL_NOT_FOUND',
  CREDENTIAL_EXPIRED = 'CREDENTIAL_EXPIRED',

  // General errors
  MLS_NOT_ENABLED = 'MLS_NOT_ENABLED',
  CONVERSATION_NOT_ENCRYPTED = 'CONVERSATION_NOT_ENCRYPTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * MLS Error
 */
export class MLSError extends Error {
  constructor(
    public readonly code: MLSErrorCode,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'MLSError';
  }
}

// ===== VALIDATION =====

/**
 * Validates a KeyPackage ID format
 */
export function isValidKeyPackageId(keyPackageId: string): boolean {
  // UUID v4 format
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(keyPackageId);
}

/**
 * Validates an MLS Group ID format
 */
export function isValidGroupId(groupId: string): boolean {
  // Format: mls_group_{conversationId}
  return groupId.startsWith('mls_group_') && groupId.length > 10;
}

/**
 * Validates an MLS identity format
 */
export function isValidMLSIdentity(identity: string): boolean {
  // Format: {username}@meeshy or {user}@meeshy.com
  const identityRegex = /^[a-zA-Z0-9_-]+@(meeshy|meeshy\.com)$/;
  return identityRegex.test(identity);
}

// ===== UTILITIES =====

/**
 * Generates an MLS Group ID for a conversation
 */
export function generateGroupId(conversationId: string): string {
  return `mls_group_${conversationId}`;
}

/**
 * Generates an MLS identity for a user
 */
export function generateMLSIdentity(username: string, domain: 'meeshy' | 'meeshy.com' = 'meeshy'): string {
  return `${username}@${domain}`;
}

/**
 * Checks if a KeyPackage is expired
 */
export function isKeyPackageExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Calculates KeyPackage expiration date (30 days from now)
 */
export function calculateKeyPackageExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt;
}

// ===== CONSTANTS =====

/**
 * Minimum number of available KeyPackages per user
 */
export const MIN_KEY_PACKAGES_PER_USER = 3;

/**
 * Default number of KeyPackages to generate
 */
export const DEFAULT_KEY_PACKAGES_COUNT = 5;

/**
 * Maximum number of KeyPackages to generate at once
 */
export const MAX_KEY_PACKAGES_COUNT = 10;

/**
 * KeyPackage expiration duration in days
 */
export const KEY_PACKAGE_EXPIRATION_DAYS = 30;

/**
 * MLS Group epoch increment
 */
export const MLS_GROUP_EPOCH_INCREMENT = 1;

// ===== HYBRID ENCRYPTION TYPES =====

/**
 * Mode de chiffrement pour les conversations
 *
 * - `none`: Pas de chiffrement E2E (traduction serveur instantanée, compatibilité maximale)
 * - `hybrid`: Chiffrement E2E + traduction serveur (recommandé - privacy + UX)
 * - `e2e_only`: Chiffrement E2E pur (privacy maximale, pas de traduction serveur)
 */
export type EncryptionMode = 'none' | 'hybrid' | 'e2e_only';

/**
 * Encryption type for encrypted data
 *
 * - `mls_1_1`: 1:1 conversation with MLS/TweetNaCl
 * - `mls_group`: Group conversation with full MLS protocol
 * - `hybrid_double`: Double encryption (E2E + server layer)
 */
export type EncryptionType = 'mls_1_1' | 'mls_group' | 'hybrid_double';

/**
 * Extended encrypted data for hybrid encryption
 * Includes server layer nonce for double encryption
 */
export interface HybridEncryptedData extends EncryptedData {
  readonly encryptionType: 'hybrid_double';
  readonly serverLayerNonce: string; // Base64 encoded nonce for server layer decryption
}

/**
 * Request to update user encryption preferences
 */
export interface UpdateEncryptionPreferencesRequest {
  readonly userId: string;
  /** true = enable (set to now()), false = disable (set to null) */
  readonly allowServerSideTranslation?: boolean;
  readonly defaultEncryptionMode?: EncryptionMode;
}

/**
 * Response for encryption preferences update
 */
export interface UpdateEncryptionPreferencesResponse {
  readonly userId: string;
  /** Date when server-side translation was enabled (null = disabled) */
  readonly allowServerSideTranslationAt: Date | null;
  readonly defaultEncryptionMode: EncryptionMode;
  readonly updatedAt: Date;
}

/**
 * Request to update conversation encryption mode
 * ⚠️ WARNING: Cannot change encryption mode after conversation creation
 */
export interface UpdateConversationEncryptionRequest {
  readonly conversationId: string;
  readonly encryptionMode: EncryptionMode;
}

/**
 * Response for conversation encryption update
 */
export interface UpdateConversationEncryptionResponse {
  readonly conversationId: string;
  readonly encryptionMode: EncryptionMode;
  readonly serverKeyCreatedAt?: Date;
  readonly serverKeyExpiresAt?: Date;
  readonly error?: string; // If encryption mode cannot be changed
}

/**
 * Conversation encryption status
 */
export interface ConversationEncryptionStatus {
  readonly conversationId: string;
  readonly encryptionMode: EncryptionMode;
  readonly isEncrypted: boolean;
  readonly supportsServerTranslation: boolean;
  readonly serverKeyExists: boolean;
  readonly serverKeyExpiresAt?: Date;
  readonly allParticipantsAllowTranslation: boolean;
  readonly participantsWithTranslationDisabled: string[]; // User IDs
}

// ===== HYBRID ENCRYPTION CONSTANTS =====

/**
 * Server encryption key rotation period in days
 */
export const SERVER_KEY_ROTATION_DAYS = 30;

/**
 * Server encryption key cache duration in hours
 */
export const SERVER_KEY_CACHE_HOURS = 24;

/**
 * Maximum time plaintext can exist in server RAM (milliseconds)
 */
export const MAX_PLAINTEXT_LIFETIME_MS = 100;

/**
 * Default encryption mode for new conversations
 */
export const DEFAULT_ENCRYPTION_MODE: EncryptionMode = 'hybrid';

/**
 * Encryption mode labels for UI
 */
export const ENCRYPTION_MODE_LABELS: Readonly<Record<EncryptionMode, string>> = {
  none: 'Aucun chiffrement',
  hybrid: 'Chiffrement hybride (Recommandé)',
  e2e_only: 'Chiffrement E2E pur',
};

/**
 * Encryption mode descriptions for UI
 */
export const ENCRYPTION_MODE_DESCRIPTIONS: Readonly<Record<EncryptionMode, string>> = {
  none: 'Traduction instantanée, compatibilité maximale. Pas de chiffrement E2E.',
  hybrid: 'Privacy + Traduction serveur. Le serveur peut déchiffrer temporairement pour traduire.',
  e2e_only: 'Privacy maximale. Le serveur ne peut jamais déchiffrer. Pas de traduction serveur.',
};

/**
 * Encryption mode icons for UI
 */
export const ENCRYPTION_MODE_ICONS: Readonly<Record<EncryptionMode, string>> = {
  none: '🔓',
  hybrid: '🔐',
  e2e_only: '🔒',
};
