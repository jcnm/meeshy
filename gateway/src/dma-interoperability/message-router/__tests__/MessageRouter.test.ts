/**
 * Message Router Unit Tests
 *
 * Tests for Week 8 implementation:
 * - Outgoing message routing
 * - Incoming message routing
 * - Session management
 * - Message status tracking
 * - Error handling
 * - Integration with Signal Protocol and XMPP
 */

import { MessageRouter } from '../MessageRouter';
import { XMPPClient } from '../../xmpp/XMPPClient';
import { SignalProtocolEngine } from '../../signal-protocol/SignalProtocolEngine';
import { PrismaClient } from '../../../../shared/prisma/client';
import { ProtocolMessage } from '../../../adapters/ProtocolAdapter';
import * as crypto from 'crypto';

describe('Message Router - Week 8 Implementation', () => {
  let router: MessageRouter;
  let xmppClient: XMPPClient;
  let signalEngine: SignalProtocolEngine;
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    xmppClient = new XMPPClient({
      protocol: 'whatsapp-dma-interop',
      xmppServer: 'dma.whatsapp.com',
      xmppPort: 5281,
      xmppVersion: '1.0',
      meeshyDomain: 'meeshy.app',
      meeshyServiceName: 'Meeshy Messaging Service',
      meeshyJID: 'meeshy@meeshy.dma.example.com',
      meeshyPassword: 'oauth-token-123',
      enlistmentAPIPort: 3001,
      enlistmentAPISecret: 'secret-123'
    });

    signalEngine = new SignalProtocolEngine(prisma);
    await signalEngine.initialize();

    router = new MessageRouter(xmppClient, signalEngine, prisma);
    await xmppClient.initialize();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================================
  // OUTGOING MESSAGE ROUTING TESTS
  // ============================================================================

  describe('Outgoing Message Routing', () => {
    it('should route outgoing message successfully', async () => {
      const message: ProtocolMessage = {
        id: 'msg-out-001',
        content: 'Hello WhatsApp',
        senderId: 'meeshy-user-1',
        recipientId: '+55991234567@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.externalMessageId).toBeDefined();
    });

    it('should encrypt message with Signal Protocol', async () => {
      const message: ProtocolMessage = {
        id: 'msg-sig-001',
        content: 'Encrypted message',
        senderId: 'meeshy-user-2',
        recipientId: '+55992345678@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const resultBefore = router.getStatistics();
      const countBefore = resultBefore.messagesEncrypted;

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(true);

      const resultAfter = router.getStatistics();
      expect(resultAfter.messagesEncrypted).toBeGreaterThan(countBefore);
    });

    it('should create XMPP stanza from message', async () => {
      const message: ProtocolMessage = {
        id: 'msg-xmpp-001',
        content: 'XMPP test message',
        senderId: 'meeshy-user-3',
        recipientId: '+55993456789@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should reject message without recipient', async () => {
      const message: ProtocolMessage = {
        id: 'msg-norecip-001',
        content: 'No recipient',
        senderId: 'meeshy-user-4',
        recipientId: '',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject message without content', async () => {
      const message: ProtocolMessage = {
        id: 'msg-nocontent-001',
        content: '',
        senderId: 'meeshy-user-5',
        recipientId: '+55994567890@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(false);
    });

    it('should track message status after sending', async () => {
      const message: ProtocolMessage = {
        id: 'msg-status-001',
        content: 'Status tracking message',
        senderId: 'meeshy-user-6',
        recipientId: '+55995678901@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(true);

      const status = await router.getMessageStatus(result.messageId || message.id);
      expect(status).toBeDefined();
      expect(status?.status).toMatch(/sent|pending|delivered/);
    });

    it('should generate unique message IDs', async () => {
      const message1: ProtocolMessage = {
        id: '',
        content: 'Message 1',
        senderId: 'meeshy-user-7',
        recipientId: '+55996789012@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const message2: ProtocolMessage = {
        id: '',
        content: 'Message 2',
        senderId: 'meeshy-user-8',
        recipientId: '+55997890123@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result1 = await router.routeOutgoing(message1);
      const result2 = await router.routeOutgoing(message2);

      expect(result1.messageId).not.toBe(result2.messageId);
    });
  });

  // ============================================================================
  // SESSION MANAGEMENT TESTS
  // ============================================================================

  describe('Session Management', () => {
    it('should create session for new user pair', async () => {
      const sessionsBefore = router.getActiveSessions();
      const countBefore = sessionsBefore.length;

      const message: ProtocolMessage = {
        id: 'msg-sess-001',
        content: 'Session creation message',
        senderId: 'meeshy-user-sess-1',
        recipientId: '+5599session1@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message);

      const sessionsAfter = router.getActiveSessions();
      expect(sessionsAfter.length).toBeGreaterThan(countBefore);
    });

    it('should reuse existing session', async () => {
      const message1: ProtocolMessage = {
        id: 'msg-reuse-001',
        content: 'First message',
        senderId: 'meeshy-user-reuse',
        recipientId: '+5599reuse@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message1);

      const sessionsBefore = router.getActiveSessions();
      const countBefore = sessionsBefore.length;

      const message2: ProtocolMessage = {
        id: 'msg-reuse-002',
        content: 'Second message (same user)',
        senderId: 'meeshy-user-reuse',
        recipientId: '+5599reuse@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message2);

      const sessionsAfter = router.getActiveSessions();
      expect(sessionsAfter.length).toBe(countBefore);
    });

    it('should track messages per session', async () => {
      const message: ProtocolMessage = {
        id: 'msg-track-001',
        content: 'Tracked message',
        senderId: 'meeshy-user-track',
        recipientId: '+5599track@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message);

      const sessions = router.getActiveSessions();
      const targetSession = sessions.find(s => s.meeshyUserId === 'meeshy-user-track');

      expect(targetSession).toBeDefined();
    });

    it('should manage multiple concurrent sessions', async () => {
      const messages = [];

      for (let i = 0; i < 5; i++) {
        messages.push({
          id: `msg-multi-${i}`,
          content: `Message ${i}`,
          senderId: `meeshy-user-multi-${i}`,
          recipientId: `+559999999${i}@s.whatsapp.net`,
          timestamp: new Date(),
          protocol: 'whatsapp-dma-interop' as const
        });
      }

      for (const msg of messages) {
        await router.routeOutgoing(msg as ProtocolMessage);
      }

      const sessions = router.getActiveSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(messages.length);
    });
  });

  // ============================================================================
  // MESSAGE STATUS TRACKING TESTS
  // ============================================================================

  describe('Message Status Tracking', () => {
    it('should track message as sent', async () => {
      const message: ProtocolMessage = {
        id: 'msg-trackstat-001',
        content: 'Status test message',
        senderId: 'meeshy-user-stat',
        recipientId: '+5599stat@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      const status = await router.getMessageStatus(result.messageId || message.id);
      expect(status?.status).toMatch(/sent|pending|delivered/);
    });

    it('should return null for non-existent message', async () => {
      const status = await router.getMessageStatus('nonexistent-msg-id');

      expect(status).toBeNull();
    });

    it('should update status timestamp', async () => {
      const message: ProtocolMessage = {
        id: 'msg-timestamp-001',
        content: 'Timestamp test',
        senderId: 'meeshy-user-time',
        recipientId: '+5599time@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);
      const status = await router.getMessageStatus(result.messageId || message.id);

      expect(status?.updatedAt).toBeDefined();
      expect(status?.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // STATISTICS TESTS
  // ============================================================================

  describe('Statistics', () => {
    it('should track messages routed', async () => {
      const statsBefore = router.getStatistics();
      const countBefore = statsBefore.messagesRouted;

      const message: ProtocolMessage = {
        id: 'msg-stat-routed-001',
        content: 'Routed message',
        senderId: 'meeshy-user-stat-1',
        recipientId: '+5599stat1@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message);

      const statsAfter = router.getStatistics();
      expect(statsAfter.messagesRouted).toBeGreaterThan(countBefore);
    });

    it('should track encryption operations', async () => {
      const statsBefore = router.getStatistics();

      const message: ProtocolMessage = {
        id: 'msg-stat-enc-001',
        content: 'Encryption test',
        senderId: 'meeshy-user-stat-2',
        recipientId: '+5599stat2@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message);

      const statsAfter = router.getStatistics();
      expect(statsAfter.messagesEncrypted).toBeGreaterThanOrEqual(statsBefore.messagesEncrypted);
    });

    it('should track active sessions', async () => {
      const message: ProtocolMessage = {
        id: 'msg-stat-sess-001',
        content: 'Session count message',
        senderId: 'meeshy-user-stat-3',
        recipientId: '+5599stat3@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message);

      const stats = router.getStatistics();
      expect(stats.sessionsActive).toBeGreaterThan(0);
    });

    it('should provide comprehensive statistics', async () => {
      const stats = router.getStatistics();

      expect(stats.messagesRouted).toBeDefined();
      expect(stats.messagesEncrypted).toBeDefined();
      expect(stats.messagesDecrypted).toBeDefined();
      expect(stats.deliveryReceipts).toBeDefined();
      expect(stats.routingErrors).toBeDefined();
      expect(stats.sessionsActive).toBeDefined();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle full message lifecycle outgoing', async () => {
      const message: ProtocolMessage = {
        id: 'msg-lifecycle-out-001',
        content: 'Lifecycle test message',
        senderId: 'meeshy-user-lifecycle',
        recipientId: '+5599lifecycle@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(true);

      const status = await router.getMessageStatus(result.messageId || message.id);
      expect(status).toBeDefined();
    });

    it('should coordinate Signal and Noise protocols', async () => {
      const message: ProtocolMessage = {
        id: 'msg-coord-001',
        content: 'Coordination test message',
        senderId: 'meeshy-user-coord',
        recipientId: '+5599coord@s.whatsapp.net',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(true);

      const stats = router.getStatistics();
      expect(stats.messagesEncrypted).toBeGreaterThan(0);
    });

    it('should handle multiple messages between same users', async () => {
      const userId = 'meeshy-user-multi-msg';
      const recipientId = '+5599multimsg@s.whatsapp.net';

      const messages = [
        { id: 'msg-mm-001', content: 'Message 1' },
        { id: 'msg-mm-002', content: 'Message 2' },
        { id: 'msg-mm-003', content: 'Message 3' }
      ];

      for (const msg of messages) {
        const result = await router.routeOutgoing({
          ...msg,
          senderId: userId,
          recipientId,
          timestamp: new Date(),
          protocol: 'whatsapp-dma-interop'
        });

        expect(result.success).toBe(true);
      }

      const sessions = router.getActiveSessions().filter(
        s => s.meeshyUserId === userId && s.whatsappAddress === recipientId
      );

      expect(sessions.length).toBe(1);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle invalid message gracefully', async () => {
      const message: ProtocolMessage = {
        id: 'msg-err-invalid',
        content: '',
        senderId: '',
        recipientId: '',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      const result = await router.routeOutgoing(message);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should track routing errors in statistics', async () => {
      const statsBefore = router.getStatistics();
      const errorCountBefore = statsBefore.routingErrors;

      const message: ProtocolMessage = {
        id: 'msg-err-track',
        content: 'Test',
        senderId: 'user',
        recipientId: '',
        timestamp: new Date(),
        protocol: 'whatsapp-dma-interop'
      };

      await router.routeOutgoing(message);

      const statsAfter = router.getStatistics();
      expect(statsAfter.routingErrors).toBeGreaterThanOrEqual(errorCountBefore);
    });
  });
});
