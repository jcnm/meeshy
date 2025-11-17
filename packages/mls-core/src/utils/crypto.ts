/**
 * Cryptographic utilities for MLS implementation
 *
 * Uses TweetNaCl for Phase 1 (simple and audited)
 * Phase 2+ will migrate to OpenMLS (Rust) for full MLS support
 */

import * as nacl from 'tweetnacl';

/**
 * Generate a new key pair for encryption
 * Uses X25519 (Curve25519) for key agreement
 */
export function generateKeyPair(): nacl.BoxKeyPair {
  return nacl.box.keyPair();
}

/**
 * Generate a signature key pair
 * Uses Ed25519 for digital signatures
 */
export function generateSignatureKeyPair(): nacl.SignKeyPair {
  return nacl.sign.keyPair();
}

/**
 * Encode binary data to Base64 string
 */
export function encodeBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

/**
 * Decode Base64 string to binary data
 */
export function decodeBase64(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}

/**
 * Compute shared secret from public and secret keys (ECDH)
 * This is the core of the key agreement protocol
 */
export function computeSharedSecret(
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array
): Uint8Array {
  return nacl.box.before(theirPublicKey, mySecretKey);
}

/**
 * Encrypt a message using a shared secret
 * Returns ciphertext and nonce
 */
export function encryptWithSharedSecret(
  message: Uint8Array,
  sharedSecret: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box.after(message, nonce, sharedSecret);

  return { ciphertext, nonce };
}

/**
 * Decrypt a message using a shared secret
 * Returns plaintext or null if decryption fails
 */
export function decryptWithSharedSecret(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  sharedSecret: Uint8Array
): Uint8Array | null {
  return nacl.box.open.after(ciphertext, nonce, sharedSecret);
}

/**
 * Sign a message with a signature key pair
 * Returns the signature
 */
export function signMessage(
  message: Uint8Array,
  secretKey: Uint8Array
): Uint8Array {
  return nacl.sign.detached(message, secretKey);
}

/**
 * Verify a message signature
 * Returns true if signature is valid
 */
export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  return nacl.sign.detached.verify(message, signature, publicKey);
}

/**
 * Generate a random nonce
 */
export function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.box.nonceLength);
}

/**
 * Generate random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return nacl.randomBytes(length);
}

/**
 * Hash data using SHA-256 (via nacl.hash which uses SHA-512, we take first 32 bytes)
 * For proper SHA-256, we'll use a simple implementation
 */
export function hash(data: Uint8Array): Uint8Array {
  // TweetNaCl only has SHA-512, so we use it and take first 32 bytes
  const fullHash = nacl.hash(data);
  return fullHash.slice(0, 32);
}

/**
 * Constant-time comparison of two byte arrays
 * Prevents timing attacks
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return result === 0;
}

/**
 * Derive a key from a password using scrypt-like derivation
 * NOTE: This is a simplified version for Phase 1
 * Phase 2+ should use proper PBKDF2 or Argon2
 */
export function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Uint8Array {
  // Simple derivation: hash(password || salt)
  // NOT SUITABLE FOR PRODUCTION - use proper KDF in Phase 2
  const passwordBytes = new TextEncoder().encode(password);
  const combined = new Uint8Array(passwordBytes.length + salt.length);
  combined.set(passwordBytes);
  combined.set(salt, passwordBytes.length);

  return hash(combined);
}

/**
 * Encrypt data with a password (for storing private keys)
 * Returns { ciphertext, nonce, salt }
 */
export function encryptWithPassword(
  data: Uint8Array,
  password: string
): { ciphertext: string; nonce: string; salt: string } {
  const salt = nacl.randomBytes(32);
  const key = deriveKeyFromPassword(password, salt);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

  const ciphertext = nacl.secretbox(data, nonce, key);

  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    salt: encodeBase64(salt),
  };
}

/**
 * Decrypt data with a password
 * Returns plaintext or null if decryption fails
 */
export function decryptWithPassword(
  ciphertext: string,
  nonce: string,
  salt: string,
  password: string
): Uint8Array | null {
  const ciphertextBytes = decodeBase64(ciphertext);
  const nonceBytes = decodeBase64(nonce);
  const saltBytes = decodeBase64(salt);

  const key = deriveKeyFromPassword(password, saltBytes);

  return nacl.secretbox.open(ciphertextBytes, nonceBytes, key);
}

/**
 * Convert string to Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Validate that a Base64 string is properly formatted
 */
export function isValidBase64(str: string): boolean {
  try {
    const decoded = Buffer.from(str, 'base64');
    const reencoded = decoded.toString('base64');
    return str === reencoded;
  } catch {
    return false;
  }
}

/**
 * Securely wipe sensitive data from memory
 * Fills array with zeros
 */
export function secureWipe(data: Uint8Array): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = 0;
  }
}
