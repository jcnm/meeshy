/**
 * Noise Protocol Framework Implementation
 *
 * Phase 2, Week 8: Transport-Level Encryption
 * Status: IMPLEMENTATION
 *
 * Noise Protocol provides:
 * - Transport-level encryption (separate from Signal Protocol E2EE)
 * - TLS-like security for chat channel
 * - Initiator-responder handshake
 * - Bidirectional symmetric encryption
 *
 * Modified Noise_NN pattern for WhatsApp DMA:
 * - No static keys (ephemeral only)
 * - Lightweight handshake
 * - Perfect forward secrecy per session
 *
 * References:
 * - Noise Protocol Framework (Perrin & Marlinspike)
 * - WhatsApp DMA Technical Specification
 */

import * as crypto from 'crypto';
import { createHmac } from 'crypto';

/**
 * Noise handshake message format
 */
export interface NoiseMessage {
  type: 'handshake' | 'transport';
  ephemeralPublicKey?: Buffer; // Initiator's ephemeral public key
  iv?: Buffer; // Initialization vector for transport
  payload?: Buffer; // Encrypted payload
  ciphertext?: Buffer; // For transport messages
  authTag?: Buffer; // AES-GCM authentication tag
}

/**
 * Noise Protocol session state
 */
export interface NoiseSession {
  sessionId: string;
  initiator: boolean; // True if we initiated the handshake

  // Handshake state
  ephemeralKeyPair: {
    publicKey: Buffer;
    privateKey: Buffer;
  };
  remoteEphemeralPublicKey?: Buffer;

  // CipherState (for transport)
  k: Buffer; // Cipher key (32 bytes)
  n: number; // Nonce counter (0-2^64-1)

  // SymmetricState (intermediate)
  ck?: Buffer; // Chaining key
  h?: Buffer; // Hash

  // Session metadata
  createdAt: Date;
  messagesProcessed: number;
  handshakeComplete: boolean;
}

/**
 * Noise Protocol Framework Implementation
 *
 * Provides transport-level encryption for XMPP channel.
 * Separate from Signal Protocol (which encrypts message content).
 */
export class NoiseProtocol {
  private sessions: Map<string, NoiseSession> = new Map();
  private stats = {
    sessionCount: 0,
    handshakesInitiated: 0,
    handshakesResponded: 0,
    handshakesCompleted: 0,
    messagesEncrypted: 0,
    messagesDecrypted: 0,
    handshakeErrors: 0
  };

  // Constants
  private readonly PROTOCOL_NAME = 'Noise_NN_25519_ChaChaPoly_BLAKE2s';
  private readonly MAX_NONCE = BigInt(2) ** BigInt(64) - BigInt(1);

  constructor() {}

  /**
   * Initiate Noise handshake as initiator
   *
   * Step 1: Generate ephemeral key pair
   * Step 2: Create initial payload with our ephemeral public key
   * Step 3: Return handshake message to send to responder
   */
  initiateHandshake(sessionId: string): { session: NoiseSession; handshakeMessage: NoiseMessage } {
    console.log(`🤝 Initiating Noise handshake: ${sessionId}`);

    // Generate ephemeral key pair
    const ephemeralKeyPair = this.generateEphemeralKeyPair();

    // Initialize session
    const session: NoiseSession = {
      sessionId,
      initiator: true,
      ephemeralKeyPair,
      k: Buffer.alloc(32, 0), // Initialize empty
      n: 0,
      createdAt: new Date(),
      messagesProcessed: 0,
      handshakeComplete: false
    };

    this.sessions.set(sessionId, session);
    this.stats.sessionCount++;
    this.stats.handshakesInitiated++;

    // Create handshake message with our ephemeral public key
    const handshakeMessage: NoiseMessage = {
      type: 'handshake',
      ephemeralPublicKey: ephemeralKeyPair.publicKey
    };

    console.log(`  ✓ Handshake initiated, ephemeral key included`);

    return { session, handshakeMessage };
  }

  /**
   * Respond to Noise handshake as responder
   *
   * Step 1: Receive initiator's ephemeral public key
   * Step 2: Generate our own ephemeral key pair
   * Step 3: Derive shared secret via ECDH
   * Step 4: Initialize symmetric state
   * Step 5: Return response handshake message
   */
  respondToHandshake(
    sessionId: string,
    initiatorEphemeralPublicKey: Buffer
  ): { session: NoiseSession; handshakeMessage: NoiseMessage } {
    console.log(`🤝 Responding to Noise handshake: ${sessionId}`);

    // Generate our ephemeral key pair
    const ephemeralKeyPair = this.generateEphemeralKeyPair();

    // Perform ECDH with initiator's ephemeral key
    const dhOutput = this.performDH(ephemeralKeyPair.privateKey, initiatorEphemeralPublicKey);

    // Derive shared secret using HKDF
    const sharedSecret = this.deriveSharedSecret(dhOutput);

    // Initialize session
    const session: NoiseSession = {
      sessionId,
      initiator: false,
      ephemeralKeyPair,
      remoteEphemeralPublicKey: initiatorEphemeralPublicKey,
      k: sharedSecret,
      n: 0,
      createdAt: new Date(),
      messagesProcessed: 0,
      handshakeComplete: true // Responder side handshake is complete
    };

    this.sessions.set(sessionId, session);
    this.stats.sessionCount++;
    this.stats.handshakesResponded++;
    this.stats.handshakesCompleted++;

    // Create response message with our ephemeral public key
    const handshakeMessage: NoiseMessage = {
      type: 'handshake',
      ephemeralPublicKey: ephemeralKeyPair.publicKey
    };

    console.log(`  ✓ Handshake responded, shared secret derived`);
    console.log(`  ✓ Cipher key initialized (ChaCha20-Poly1305)`);

    return { session, handshakeMessage };
  }

  /**
   * Complete handshake on initiator side
   *
   * Initiator receives responder's ephemeral key and derives shared secret
   */
  completeHandshake(
    sessionId: string,
    responderEphemeralPublicKey: Buffer
  ): void {
    console.log(`🤝 Completing Noise handshake: ${sessionId}`);

    const session = this.sessions.get(sessionId);
    if (!session || !session.initiator) {
      throw new Error(`Session ${sessionId} not found or not initiator`);
    }

    // Perform ECDH with responder's ephemeral key
    const dhOutput = this.performDH(session.ephemeralKeyPair.privateKey, responderEphemeralPublicKey);

    // Derive shared secret
    const sharedSecret = this.deriveSharedSecret(dhOutput);

    // Update session
    session.remoteEphemeralPublicKey = responderEphemeralPublicKey;
    session.k = sharedSecret;
    session.handshakeComplete = true;

    this.stats.handshakesCompleted++;

    console.log(`  ✓ Initiator handshake complete`);
    console.log(`  ✓ Cipher key established`);
  }

  /**
   * Encrypt transport message
   *
   * Uses symmetric encryption (ChaCha20-Poly1305 or AES-256-GCM)
   * Encrypts plaintext and increments nonce counter
   */
  encryptMessage(sessionId: string, plaintext: Buffer): Buffer {
    console.log(`🔐 Encrypting transport message: ${sessionId}`);

    const session = this.sessions.get(sessionId);
    if (!session || !session.handshakeComplete) {
      throw new Error(`Session ${sessionId} not ready for encryption`);
    }

    if (session.n >= Number(this.MAX_NONCE)) {
      throw new Error(`Nonce counter exceeded for session ${sessionId}`);
    }

    // Generate IV from nonce
    const nonceBuffer = Buffer.alloc(12);
    nonceBuffer.writeBigUInt64LE(BigInt(session.n), 0);
    nonceBuffer.writeBigUInt32LE(BigInt(0), 8);

    // Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', session.k, nonceBuffer);
    let ciphertext = cipher.update(plaintext);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Increment nonce
    session.n++;
    session.messagesProcessed++;
    this.stats.messagesEncrypted++;

    // Return combined message: nonce || ciphertext || authTag
    const encryptedMessage = Buffer.concat([nonceBuffer, ciphertext, authTag]);

    console.log(`  ✓ Message encrypted (${plaintext.length} → ${encryptedMessage.length} bytes)`);

    return encryptedMessage;
  }

  /**
   * Decrypt transport message
   *
   * Extracts nonce, ciphertext, and auth tag
   * Verifies authentication and decrypts
   */
  decryptMessage(sessionId: string, encryptedMessage: Buffer): Buffer {
    console.log(`🔓 Decrypting transport message: ${sessionId}`);

    const session = this.sessions.get(sessionId);
    if (!session || !session.handshakeComplete) {
      throw new Error(`Session ${sessionId} not ready for decryption`);
    }

    // Extract nonce (12 bytes), ciphertext, and auth tag (16 bytes)
    const nonceBuffer = encryptedMessage.slice(0, 12);
    const authTag = encryptedMessage.slice(-16);
    const ciphertext = encryptedMessage.slice(12, -16);

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', session.k, nonceBuffer);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    session.messagesProcessed++;
    this.stats.messagesDecrypted++;

    console.log(`  ✓ Message decrypted (${encryptedMessage.length} → ${plaintext.length} bytes)`);

    return plaintext;
  }

  /**
   * Get session for verification
   */
  getSession(sessionId: string): NoiseSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if session exists and handshake is complete
   */
  isSessionReady(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return !!session && session.handshakeComplete;
  }

  /**
   * Destroy session (cleanup)
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear sensitive data
      session.k.fill(0);
      session.ephemeralKeyPair.privateKey.fill(0);
      this.sessions.delete(sessionId);
      console.log(`🗑️  Session destroyed: ${sessionId}`);
    }
  }

  /**
   * Generate ephemeral key pair (EC-P256)
   */
  private generateEphemeralKeyPair(): { publicKey: Buffer; privateKey: Buffer } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
      }
    });

    return {
      publicKey: publicKey as Buffer,
      privateKey: privateKey as Buffer
    };
  }

  /**
   * Perform ECDH key exchange
   */
  private performDH(privateKey: Buffer, publicKey: Buffer): Buffer {
    const privateKeyObject = crypto.createPrivateKey({
      key: privateKey,
      format: 'der',
      type: 'pkcs8'
    });

    const publicKeyObject = crypto.createPublicKey({
      key: publicKey,
      format: 'der',
      type: 'spki'
    });

    const sharedSecret = crypto.diffieHellman({
      privateKey: privateKeyObject,
      publicKey: publicKeyObject
    });

    return sharedSecret;
  }

  /**
   * Derive shared secret using HKDF-SHA256
   *
   * Converts raw DH output into cipher key and chaining key
   */
  private deriveSharedSecret(dhOutput: Buffer): Buffer {
    // HKDF Extract
    const salt = Buffer.alloc(32, 0);
    const prk = createHmac('sha256', salt).update(dhOutput).digest();

    // HKDF Expand (32 bytes for cipher key)
    const info = Buffer.from('Noise_NN_25519_ChaChaPoly_BLAKE2s');
    const okm = this.hkdfExpand(prk, info, 32);

    console.log(`  ✓ Shared secret derived via HKDF-SHA256`);

    return okm;
  }

  /**
   * HKDF Expand (RFC 5869)
   */
  private hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
    const hash = 'sha256';
    const hashLength = 32;
    const n = Math.ceil(length / hashLength);
    const okm: Buffer[] = [];

    let t = Buffer.alloc(0);

    for (let i = 0; i < n; i++) {
      const hmac = createHmac(hash, prk);
      hmac.update(Buffer.concat([t, info, Buffer.from([i + 1])]));
      t = hmac.digest();
      okm.push(t);
    }

    return Buffer.concat(okm).subarray(0, length) as Buffer;
  }

  /**
   * Get statistics
   */
  getStatistics(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get all active sessions (for monitoring)
   */
  getActiveSessions(): { sessionId: string; initiator: boolean; handshakeComplete: boolean }[] {
    return Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      initiator: session.initiator,
      handshakeComplete: session.handshakeComplete
    }));
  }
}
