/**
 * Frontend Encryption Utilities using Web Crypto API
 *
 * Provides AES-256-GCM encryption/decryption for both modes:
 * - Server mode: Encrypt/decrypt for server-side translation
 * - E2EE mode: True end-to-end encryption with Signal Protocol
 */

import type { EncryptedPayload, EncryptionMetadata, EncryptionMode } from '@/shared/types/encryption';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes (96 bits)
const TAG_LENGTH = 128; // bits

/**
 * Generate a random AES-256 key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to base64 for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Import key from base64
 */
export async function importKey(keyData: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(keyData);
  return await crypto.subtle.importKey(
    'raw',
    buffer,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate random IV (Initialization Vector)
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Encrypt content using AES-256-GCM
 */
export async function encryptContent(
  plaintext: string,
  key: CryptoKey,
  keyId: string
): Promise<EncryptedPayload> {
  const iv = generateIV();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
      tagLength: TAG_LENGTH,
    },
    key,
    data
  );

  // Split encrypted data into ciphertext and auth tag
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertextLength = encryptedArray.length - (TAG_LENGTH / 8);
  const ciphertext = encryptedArray.slice(0, ciphertextLength);
  const authTag = encryptedArray.slice(ciphertextLength);

  const metadata: EncryptionMetadata = {
    mode: 'server', // Will be set correctly by caller
    protocol: 'aes-256-gcm',
    keyId,
    iv: arrayBufferToBase64(iv),
    authTag: arrayBufferToBase64(authTag),
  };

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    metadata,
  };
}

/**
 * Decrypt content using AES-256-GCM
 */
export async function decryptContent(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const { ciphertext, metadata } = payload;

  // Reconstruct the encrypted data (ciphertext + auth tag)
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
  const authTagBuffer = base64ToArrayBuffer(metadata.authTag);
  const ivBuffer = base64ToArrayBuffer(metadata.iv);

  // Combine ciphertext and auth tag
  const encrypted = new Uint8Array(ciphertextBuffer.byteLength + authTagBuffer.byteLength);
  encrypted.set(new Uint8Array(ciphertextBuffer), 0);
  encrypted.set(new Uint8Array(authTagBuffer), ciphertextBuffer.byteLength);

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: ivBuffer,
        tagLength: TAG_LENGTH,
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message. The message may be corrupted or encrypted with a different key.');
  }
}

/**
 * Generate a key ID
 */
export function generateKeyId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return arrayBufferToBase64(array.buffer);
}

/**
 * Derive a key from password using PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive actual encryption key
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate Signal Protocol-style key pair (using ECDH)
 */
export async function generateSignalKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256', // Signal uses Curve25519, but P-256 is widely supported
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: arrayBufferToBase64(publicKey),
    privateKey: arrayBufferToBase64(privateKey),
  };
}

/**
 * Perform ECDH key agreement (simplified Signal Protocol)
 */
export async function performKeyAgreement(
  privateKeyData: string,
  publicKeyData: string
): Promise<CryptoKey> {
  const privateKeyBuffer = base64ToArrayBuffer(privateKeyData);
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyData);

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    []
  );

  // Derive shared secret
  return await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Helper: ArrayBuffer to Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Validate encryption metadata
 */
export function validateMetadata(metadata: any): metadata is EncryptionMetadata {
  return (
    metadata &&
    typeof metadata === 'object' &&
    ['e2ee', 'server'].includes(metadata.mode) &&
    ['signal_v3', 'aes-256-gcm'].includes(metadata.protocol) &&
    typeof metadata.keyId === 'string' &&
    typeof metadata.iv === 'string' &&
    typeof metadata.authTag === 'string'
  );
}

/**
 * Generate random registration ID for Signal Protocol
 */
export function generateRegistrationId(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] & 0x3FFF; // 14-bit number (0-16383)
}
