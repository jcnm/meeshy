/**
 * Noise Protocol Unit Tests
 *
 * Tests for Week 8 implementation:
 * - Initiator handshake
 * - Responder handshake
 * - Handshake completion
 * - Message encryption/decryption
 * - Forward secrecy
 * - Session management
 */

import { NoiseProtocol, NoiseSession } from '../NoiseProtocol';
import * as crypto from 'crypto';

describe('Noise Protocol Framework - Week 8 Implementation', () => {
  let noise: NoiseProtocol;

  beforeEach(() => {
    noise = new NoiseProtocol();
  });

  // ============================================================================
  // HANDSHAKE TESTS
  // ============================================================================

  describe('Handshake - Initiator Side', () => {
    it('should initiate handshake as initiator', () => {
      const sessionId = 'session-initiator-001';
      const { session, handshakeMessage } = noise.initiateHandshake(sessionId);

      expect(session).toBeDefined();
      expect(session.initiator).toBe(true);
      expect(session.handshakeComplete).toBe(false);
      expect(handshakeMessage.type).toBe('handshake');
      expect(handshakeMessage.ephemeralPublicKey).toBeDefined();
    });

    it('should generate ephemeral key pair', () => {
      const { session } = noise.initiateHandshake('session-initiator-002');

      expect(session.ephemeralKeyPair.publicKey).toBeDefined();
      expect(session.ephemeralKeyPair.privateKey).toBeDefined();

      // P-256 public key in SPKI format is ~91 bytes
      expect(session.ephemeralKeyPair.publicKey.length).toBeGreaterThan(70);
      expect(session.ephemeralKeyPair.publicKey.length).toBeLessThan(120);
    });

    it('should mark session as not complete until responder response', () => {
      const { session } = noise.initiateHandshake('session-initiator-003');

      expect(session.handshakeComplete).toBe(false);
    });

    it('should initialize nonce to 0', () => {
      const { session } = noise.initiateHandshake('session-initiator-004');

      expect(session.n).toBe(0);
    });

    it('should set initiator flag to true', () => {
      const { session } = noise.initiateHandshake('session-initiator-005');

      expect(session.initiator).toBe(true);
    });

    it('should return handshake message with ephemeral key', () => {
      const { handshakeMessage } = noise.initiateHandshake('session-initiator-006');

      expect(handshakeMessage.type).toBe('handshake');
      expect(handshakeMessage.ephemeralPublicKey).toBeDefined();
      expect(handshakeMessage.ephemeralPublicKey?.length).toBeGreaterThan(0);
    });
  });

  describe('Handshake - Responder Side', () => {
    it('should respond to handshake as responder', () => {
      const initiatorSessionId = 'session-responder-initiator-001';
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);

      const responderSessionId = 'session-responder-responder-001';
      const { session, handshakeMessage } = noise.respondToHandshake(
        responderSessionId,
        initiatorHandshake.ephemeralPublicKey!
      );

      expect(session).toBeDefined();
      expect(session.initiator).toBe(false);
      expect(session.handshakeComplete).toBe(true);
      expect(handshakeMessage.type).toBe('handshake');
      expect(handshakeMessage.ephemeralPublicKey).toBeDefined();
    });

    it('should perform ECDH on responder side', () => {
      const initiatorSessionId = 'session-responder-initiator-002';
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);

      const responderSessionId = 'session-responder-responder-002';
      const { session } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);

      expect(session.k).toBeDefined();
      expect(session.k.length).toBe(32); // Cipher key is 32 bytes
    });

    it('should derive cipher key on responder side', () => {
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake('session-responder-initiator-003');
      const { session } = noise.respondToHandshake('session-responder-responder-003', initiatorHandshake.ephemeralPublicKey!);

      expect(session.k).toBeDefined();
      expect(session.k.length).toBe(32);
      expect(session.k.toString('hex')).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
    });

    it('should mark handshake complete on responder', () => {
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake('session-responder-initiator-004');
      const { session } = noise.respondToHandshake('session-responder-responder-004', initiatorHandshake.ephemeralPublicKey!);

      expect(session.handshakeComplete).toBe(true);
    });

    it('should set initiator flag to false on responder', () => {
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake('session-responder-initiator-005');
      const { session } = noise.respondToHandshake('session-responder-responder-005', initiatorHandshake.ephemeralPublicKey!);

      expect(session.initiator).toBe(false);
    });
  });

  describe('Handshake - Completion', () => {
    it('should complete handshake on initiator side', () => {
      const initiatorSessionId = 'session-completion-initiator-001';
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);

      const responderSessionId = 'session-completion-responder-001';
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);

      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      const initiatorSession = noise.getSession(initiatorSessionId);
      expect(initiatorSession?.handshakeComplete).toBe(true);
    });

    it('should derive same cipher key on both sides', () => {
      const initiatorSessionId = 'session-completion-initiator-002';
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);

      const responderSessionId = 'session-completion-responder-002';
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);

      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      const initiatorSession = noise.getSession(initiatorSessionId);
      const responderSession = noise.getSession(responderSessionId);

      // Both should have derived the same key
      expect(initiatorSession?.k).toBeDefined();
      expect(responderSession?.k).toBeDefined();
      expect(initiatorSession?.k.equals(responderSession?.k!)).toBe(true);
    });

    it('should transition to transport mode after handshake', () => {
      const initiatorSessionId = 'session-completion-initiator-003';
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);

      const responderSessionId = 'session-completion-responder-003';
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);

      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      expect(noise.isSessionReady(initiatorSessionId)).toBe(true);
      expect(noise.isSessionReady(responderSessionId)).toBe(true);
    });
  });

  // ============================================================================
  // MESSAGE ENCRYPTION/DECRYPTION TESTS
  // ============================================================================

  describe('Message Encryption', () => {
    let initiatorSessionId: string;
    let responderSessionId: string;

    beforeEach(() => {
      initiatorSessionId = 'session-encryption-initiator';
      responderSessionId = 'session-encryption-responder';

      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);
    });

    it('should encrypt message from initiator to responder', () => {
      const plaintext = Buffer.from('Hello from initiator');
      const encryptedMessage = noise.encryptMessage(initiatorSessionId, plaintext);

      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage.length).toBeGreaterThan(plaintext.length);
      expect(encryptedMessage).not.toEqual(plaintext);
    });

    it('should encrypt message from responder to initiator', () => {
      const plaintext = Buffer.from('Hello from responder');
      const encryptedMessage = noise.encryptMessage(responderSessionId, plaintext);

      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage.length).toBeGreaterThan(plaintext.length);
    });

    it('should produce different ciphertexts for same plaintext (due to nonce)', () => {
      const plaintext = Buffer.from('Same message');

      const encrypted1 = noise.encryptMessage(initiatorSessionId, plaintext);
      const encrypted2 = noise.encryptMessage(initiatorSessionId, plaintext);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should include nonce in encrypted message', () => {
      const plaintext = Buffer.from('Test message');
      const encryptedMessage = noise.encryptMessage(initiatorSessionId, plaintext);

      // Nonce is first 12 bytes
      expect(encryptedMessage.length).toBeGreaterThan(12);
    });

    it('should include auth tag in encrypted message', () => {
      const plaintext = Buffer.from('Test message');
      const encryptedMessage = noise.encryptMessage(initiatorSessionId, plaintext);

      // Auth tag is last 16 bytes
      expect(encryptedMessage.length).toBeGreaterThan(16);
    });
  });

  describe('Message Decryption', () => {
    let initiatorSessionId: string;
    let responderSessionId: string;

    beforeEach(() => {
      initiatorSessionId = 'session-decryption-initiator';
      responderSessionId = 'session-decryption-responder';

      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);
    });

    it('should decrypt message from initiator', () => {
      const plaintext = Buffer.from('Hello from initiator');
      const encryptedMessage = noise.encryptMessage(initiatorSessionId, plaintext);
      const decryptedMessage = noise.decryptMessage(responderSessionId, encryptedMessage);

      expect(decryptedMessage.toString()).toBe(plaintext.toString());
    });

    it('should decrypt message from responder', () => {
      const plaintext = Buffer.from('Hello from responder');
      const encryptedMessage = noise.encryptMessage(responderSessionId, plaintext);
      const decryptedMessage = noise.decryptMessage(initiatorSessionId, encryptedMessage);

      expect(decryptedMessage.toString()).toBe(plaintext.toString());
    });

    it('should support bidirectional communication', () => {
      const message1 = Buffer.from('First message');
      const message2 = Buffer.from('Response message');

      const encrypted1 = noise.encryptMessage(initiatorSessionId, message1);
      const decrypted1 = noise.decryptMessage(responderSessionId, encrypted1);

      const encrypted2 = noise.encryptMessage(responderSessionId, message2);
      const decrypted2 = noise.decryptMessage(initiatorSessionId, encrypted2);

      expect(decrypted1.toString()).toBe(message1.toString());
      expect(decrypted2.toString()).toBe(message2.toString());
    });

    it('should handle large messages', () => {
      const largeMessage = Buffer.alloc(65536, 'test data');
      const encryptedMessage = noise.encryptMessage(initiatorSessionId, largeMessage);
      const decryptedMessage = noise.decryptMessage(responderSessionId, encryptedMessage);

      expect(decryptedMessage).toEqual(largeMessage);
    });

    it('should fail on tampered ciphertext', () => {
      const plaintext = Buffer.from('Original message');
      const encryptedMessage = noise.encryptMessage(initiatorSessionId, plaintext);

      // Tamper with ciphertext
      const tamperedMessage = Buffer.from(encryptedMessage);
      tamperedMessage[15] ^= 0xff; // Flip bits in the middle

      expect(() => {
        noise.decryptMessage(responderSessionId, tamperedMessage);
      }).toThrow();
    });

    it('should fail on wrong session for decryption', () => {
      const plaintext = Buffer.from('Test message');
      const encryptedMessage = noise.encryptMessage(initiatorSessionId, plaintext);

      // Try to decrypt with wrong session
      expect(() => {
        noise.decryptMessage('wrong-session-id', encryptedMessage);
      }).toThrow();
    });
  });

  // ============================================================================
  // FORWARD SECRECY TESTS
  // ============================================================================

  describe('Forward Secrecy', () => {
    it('should use ephemeral keys for forward secrecy', () => {
      const initiatorSessionId = 'session-fs-initiator';
      const responderSessionId = 'session-fs-responder';

      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      const initiatorSession = noise.getSession(initiatorSessionId);

      // Both sides use ephemeral keys
      expect(initiatorSession?.ephemeralKeyPair).toBeDefined();
      expect(initiatorSession?.remoteEphemeralPublicKey).toBeDefined();
    });

    it('should support session reuse with nonce counter', () => {
      const initiatorSessionId = 'session-fs-nonce-001';
      const responderSessionId = 'session-fs-nonce-002';

      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      const message1 = Buffer.from('Message 1');
      const message2 = Buffer.from('Message 2');
      const message3 = Buffer.from('Message 3');

      const enc1 = noise.encryptMessage(initiatorSessionId, message1);
      const enc2 = noise.encryptMessage(initiatorSessionId, message2);
      const enc3 = noise.encryptMessage(initiatorSessionId, message3);

      const initiatorSession = noise.getSession(initiatorSessionId);
      expect(initiatorSession?.n).toBe(3); // Nonce should be 3
    });
  });

  // ============================================================================
  // SESSION MANAGEMENT TESTS
  // ============================================================================

  describe('Session Management', () => {
    it('should track active sessions', () => {
      const session1Id = 'session-mgmt-001';
      const session2Id = 'session-mgmt-002';

      noise.initiateHandshake(session1Id);
      noise.initiateHandshake(session2Id);

      const activeSessions = noise.getActiveSessions();
      expect(activeSessions.length).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve session by ID', () => {
      const sessionId = 'session-mgmt-retrieve-001';
      const { session: originalSession } = noise.initiateHandshake(sessionId);

      const retrievedSession = noise.getSession(sessionId);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.sessionId).toBe(originalSession.sessionId);
    });

    it('should check session readiness', () => {
      const initiatorSessionId = 'session-mgmt-ready-initiator';
      const responderSessionId = 'session-mgmt-ready-responder';

      noise.initiateHandshake(initiatorSessionId);
      expect(noise.isSessionReady(initiatorSessionId)).toBe(false);

      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, noise.getSession(initiatorSessionId)!.ephemeralKeyPair.publicKey);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      expect(noise.isSessionReady(initiatorSessionId)).toBe(true);
    });

    it('should destroy session and cleanup', () => {
      const sessionId = 'session-mgmt-destroy-001';
      noise.initiateHandshake(sessionId);

      expect(noise.getSession(sessionId)).toBeDefined();

      noise.destroySession(sessionId);

      expect(noise.getSession(sessionId)).toBeUndefined();
    });

    it('should prevent operations on destroyed sessions', () => {
      const sessionId = 'session-mgmt-destroyed-ops';
      const { handshakeMessage } = noise.initiateHandshake(sessionId);
      noise.respondToHandshake('responder-' + sessionId, handshake.ephemeralPublicKey!);
      noise.completeHandshake(sessionId, Buffer.alloc(91)); // Dummy responder key

      noise.destroySession(sessionId);

      expect(() => {
        noise.encryptMessage(sessionId, Buffer.from('test'));
      }).toThrow();
    });
  });

  // ============================================================================
  // STATISTICS TESTS
  // ============================================================================

  describe('Statistics and Monitoring', () => {
    it('should track handshakes initiated', () => {
      const stats1 = noise.getStatistics();
      const count1 = stats1.handshakesInitiated;

      noise.initiateHandshake('session-stats-001');
      const stats2 = noise.getStatistics();
      const count2 = stats2.handshakesInitiated;

      expect(count2).toBe(count1 + 1);
    });

    it('should track handshakes responded', () => {
      const stats1 = noise.getStatistics();
      const count1 = stats1.handshakesResponded;

      const { handshakeMessage } = noise.initiateHandshake('session-stats-resp-001');
      noise.respondToHandshake('session-stats-resp-002', handshakeMessage.ephemeralPublicKey!);

      const stats2 = noise.getStatistics();
      const count2 = stats2.handshakesResponded;

      expect(count2).toBe(count1 + 1);
    });

    it('should track messages encrypted', () => {
      const initiatorSessionId = 'session-stats-enc-001';
      const responderSessionId = 'session-stats-enc-002';

      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      const stats1 = noise.getStatistics();
      const count1 = stats1.messagesEncrypted;

      noise.encryptMessage(initiatorSessionId, Buffer.from('test'));
      const stats2 = noise.getStatistics();
      const count2 = stats2.messagesEncrypted;

      expect(count2).toBe(count1 + 1);
    });

    it('should track messages decrypted', () => {
      const initiatorSessionId = 'session-stats-dec-001';
      const responderSessionId = 'session-stats-dec-002';

      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      const stats1 = noise.getStatistics();
      const count1 = stats1.messagesDecrypted;

      const encrypted = noise.encryptMessage(initiatorSessionId, Buffer.from('test'));
      noise.decryptMessage(responderSessionId, encrypted);

      const stats2 = noise.getStatistics();
      const count2 = stats2.messagesDecrypted;

      expect(count2).toBe(count1 + 1);
    });

    it('should provide comprehensive statistics', () => {
      const stats = noise.getStatistics();

      expect(stats.sessionCount).toBeDefined();
      expect(stats.handshakesInitiated).toBeDefined();
      expect(stats.handshakesResponded).toBeDefined();
      expect(stats.handshakesCompleted).toBeDefined();
      expect(stats.messagesEncrypted).toBeDefined();
      expect(stats.messagesDecrypted).toBeDefined();
      expect(stats.handshakeErrors).toBeDefined();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle missing sessions gracefully', () => {
      expect(() => {
        noise.encryptMessage('nonexistent-session', Buffer.from('test'));
      }).toThrow();
    });

    it('should prevent encryption before handshake complete', () => {
      const sessionId = 'session-error-001';
      noise.initiateHandshake(sessionId);

      expect(() => {
        noise.encryptMessage(sessionId, Buffer.from('test'));
      }).toThrow();
    });

    it('should prevent decryption before handshake complete', () => {
      const sessionId = 'session-error-002';
      noise.initiateHandshake(sessionId);

      expect(() => {
        noise.decryptMessage(sessionId, Buffer.alloc(50));
      }).toThrow();
    });

    it('should handle tampered messages gracefully', () => {
      const initiatorSessionId = 'session-error-tamper-001';
      const responderSessionId = 'session-error-tamper-002';

      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      const encrypted = noise.encryptMessage(initiatorSessionId, Buffer.from('test'));
      const tampered = Buffer.from(encrypted);
      tampered[20] ^= 0xff;

      expect(() => {
        noise.decryptMessage(responderSessionId, tampered);
      }).toThrow();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should support full handshake and message exchange', () => {
      const initiatorSessionId = 'session-integration-initiator';
      const responderSessionId = 'session-integration-responder';

      // Step 1: Initiator starts handshake
      const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorSessionId);

      // Step 2: Responder responds to handshake
      const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderSessionId, initiatorHandshake.ephemeralPublicKey!);

      // Step 3: Initiator completes handshake
      noise.completeHandshake(initiatorSessionId, responderHandshake.ephemeralPublicKey!);

      // Step 4: Bidirectional message exchange
      const msg1 = Buffer.from('Hello from initiator');
      const enc1 = noise.encryptMessage(initiatorSessionId, msg1);
      const dec1 = noise.decryptMessage(responderSessionId, enc1);

      const msg2 = Buffer.from('Hello back from responder');
      const enc2 = noise.encryptMessage(responderSessionId, msg2);
      const dec2 = noise.decryptMessage(initiatorSessionId, enc2);

      expect(dec1.toString()).toBe(msg1.toString());
      expect(dec2.toString()).toBe(msg2.toString());
    });

    it('should support multiple concurrent sessions', () => {
      const sessions = [];

      for (let i = 0; i < 5; i++) {
        const initiatorId = `session-concurrent-init-${i}`;
        const responderId = `session-concurrent-resp-${i}`;

        const { handshakeMessage: initiatorHandshake } = noise.initiateHandshake(initiatorId);
        const { handshakeMessage: responderHandshake } = noise.respondToHandshake(responderId, initiatorHandshake.ephemeralPublicKey!);
        noise.completeHandshake(initiatorId, responderHandshake.ephemeralPublicKey!);

        sessions.push({ initiatorId, responderId });
      }

      // All sessions should be ready
      for (const { initiatorId, responderId } of sessions) {
        expect(noise.isSessionReady(initiatorId)).toBe(true);
        expect(noise.isSessionReady(responderId)).toBe(true);
      }
    });

    it('should handle session creation and destruction', () => {
      const sessionId = 'session-lifecycle-001';
      const { handshakeMessage } = noise.initiateHandshake(sessionId);
      noise.respondToHandshake('responder-' + sessionId, handshakeMessage.ephemeralPublicKey!);
      noise.completeHandshake(sessionId, Buffer.alloc(91));

      // Encrypt/decrypt messages
      const msg = Buffer.from('test');
      const enc = noise.encryptMessage(sessionId, msg);
      expect(enc).toBeDefined();

      // Destroy session
      noise.destroySession(sessionId);
      expect(noise.getSession(sessionId)).toBeUndefined();
    });
  });
});
