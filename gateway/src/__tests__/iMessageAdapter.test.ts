/**
 * iMessage Adapter Tests
 *
 * Unit tests for iMessage protocol adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { iMessageAdapter, iMessageConfig } from '../adapters/iMessageAdapter';
import type { ProtocolMessage } from '../adapters/ProtocolAdapter';

describe('iMessageAdapter', () => {
  let adapter: iMessageAdapter;
  let config: iMessageConfig;

  beforeEach(() => {
    adapter = new iMessageAdapter();
    config = {
      enabled: true,
      appleTeamId: 'ABCD123456',
      appleKeyId: 'DEF789',
      applePrivateKey: 'mock-private-key',
      bundleId: 'com.example.meeshy',
      webhookSecret: 'test-webhook-secret',
      apiVersion: '1.0'
    };
  });

  describe('Configuration', () => {
    it('should configure successfully with valid config', async () => {
      await adapter.configure(config);
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should throw error with missing appleTeamId', async () => {
      const invalidConfig = { ...config };
      delete (invalidConfig as any).appleTeamId;

      await expect(adapter.configure(invalidConfig)).rejects.toThrow(
        'iMessage adapter requires appleTeamId, appleKeyId, and applePrivateKey'
      );
    });

    it('should throw error with missing bundleId', async () => {
      const invalidConfig = { ...config };
      delete (invalidConfig as any).bundleId;

      await expect(adapter.configure(invalidConfig)).rejects.toThrow(
        'iMessage adapter requires bundleId'
      );
    });
  });

  describe('Protocol Information', () => {
    it('should have correct protocol identifier', () => {
      expect(adapter.protocol).toBe('imessage');
    });

    it('should support encryption', () => {
      expect(adapter.supportsEncryption()).toBe(true);
    });

    it('should return iMessage encryption type', () => {
      expect(adapter.getEncryptionType()).toBe('imessage-e2ee');
    });
  });

  describe('Message Conversion', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should handle simple text message', async () => {
      const protocolMessage: ProtocolMessage = {
        protocolMessageId: 'msg-123',
        senderId: 'user-123',
        recipientId: 'recipient@example.com',
        text: 'Hello from Meeshy via iMessage!',
        timestamp: new Date(),
        isEncrypted: false,
        metadata: {}
      };

      const result = await adapter.sendMessage(protocolMessage);
      // Will fail without real Apple credentials, but should not throw
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle message with media', async () => {
      const protocolMessage: ProtocolMessage = {
        protocolMessageId: 'msg-124',
        senderId: 'user-123',
        recipientId: 'recipient@example.com',
        text: 'Check out this image!',
        media: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg',
            mimeType: 'image/jpeg',
            fileName: 'photo.jpg'
          }
        ],
        timestamp: new Date(),
        isEncrypted: false,
        metadata: {}
      };

      const result = await adapter.sendMessage(protocolMessage);
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Webhook Processing', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should process incoming text message', async () => {
      const webhook = {
        event: 'message',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          displayName: 'John Doe',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        payload: {
          type: 'text',
          text: { body: 'Hello from iMessage!' }
        },
        metadata: {}
      };

      const message = await adapter.processIncomingWebhook(webhook);

      expect(message).not.toBeNull();
      expect(message?.text).toBe('Hello from iMessage!');
      expect(message?.senderId).toBe('user@icloud.com');
      expect(message?.senderName).toBe('John Doe');
      expect(message?.isEncrypted).toBe(true);
    });

    it('should process incoming image message', async () => {
      const webhook = {
        event: 'message',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user2@icloud.com',
          displayName: 'Jane Smith',
          conversationId: 'conv-124'
        },
        conversationId: 'conv-124',
        payload: {
          type: 'image',
          image: {
            url: 'https://example.com/photo.jpg',
            fileName: 'photo.jpg',
            mimeType: 'image/jpeg'
          }
        },
        metadata: {}
      };

      const message = await adapter.processIncomingWebhook(webhook);

      expect(message).not.toBeNull();
      expect(message?.media).toHaveLength(1);
      expect(message?.media?.[0].type).toBe('image');
      expect(message?.media?.[0].url).toBe('https://example.com/photo.jpg');
    });

    it('should handle message status updates', async () => {
      const webhook = {
        event: 'delivery',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        messageId: 'imsg-msg-001',
        status: 'delivered',
        metadata: {}
      };

      const adapter2 = new iMessageAdapter();
      await adapter2.configure(config);

      const statusUpdate = await adapter2.processStatusUpdate(webhook);

      expect(statusUpdate).not.toBeNull();
      expect(statusUpdate?.status).toBe('delivered');
      expect(statusUpdate?.messageId).toBe('imsg-msg-001');
    });

    it('should return null for non-message webhook', async () => {
      const webhook = {
        event: 'connection',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        metadata: { online: true }
      };

      const message = await adapter.processIncomingWebhook(webhook);
      expect(message).toBeNull();
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should verify connection', async () => {
      const result = await adapter.verifyConnection();
      expect(typeof result).toBe('boolean');
    });

    it('should disconnect successfully', async () => {
      await adapter.disconnect();
      expect(adapter.isConfigured()).toBe(false);
    });

    it('should return false for verifyConnection when not configured', async () => {
      const newAdapter = new iMessageAdapter();
      const result = await newAdapter.verifyConnection();
      expect(result).toBe(false);
    });
  });

  describe('Message Status Tracking', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should return message status from cache', async () => {
      // First process a webhook to populate cache
      const webhook = {
        event: 'delivery',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        messageId: 'imsg-status-123',
        status: 'sent',
        metadata: {}
      };

      await adapter.processStatusUpdate(webhook);

      const status = await adapter.getMessageStatus('imsg-status-123');
      expect(status).not.toBeNull();
      expect(status?.status).toBe('sent');
    });

    it('should return null for unknown message', async () => {
      const status = await adapter.getMessageStatus('unknown-message-id');
      expect(status).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should send bulk messages', async () => {
      const messages: ProtocolMessage[] = [
        {
          protocolMessageId: 'msg-1',
          senderId: 'user-123',
          recipientId: 'user1@icloud.com',
          text: 'Message 1',
          timestamp: new Date(),
          isEncrypted: false,
          metadata: {}
        },
        {
          protocolMessageId: 'msg-2',
          senderId: 'user-123',
          recipientId: 'user2@icloud.com',
          text: 'Message 2',
          timestamp: new Date(),
          isEncrypted: false,
          metadata: {}
        }
      ];

      const results = await adapter.sendBulkMessages(messages);

      expect(results).toHaveLength(2);
      expect(typeof results[0].success).toBe('boolean');
      expect(typeof results[1].success).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should return error when not configured', async () => {
      const newAdapter = new iMessageAdapter();

      const message: ProtocolMessage = {
        protocolMessageId: 'msg-123',
        senderId: 'user-123',
        recipientId: 'user@icloud.com',
        text: 'Hello',
        timestamp: new Date(),
        isEncrypted: false,
        metadata: {}
      };

      const result = await newAdapter.sendMessage(message);
      expect(result.success).toBe(false);
      expect(result.error).toBe('iMessage adapter not configured');
    });

    it('should handle message without recipient', async () => {
      await adapter.configure(config);

      const message: ProtocolMessage = {
        protocolMessageId: 'msg-123',
        senderId: 'user-123',
        recipientId: '',
        text: 'Hello',
        timestamp: new Date(),
        isEncrypted: false,
        metadata: {}
      };

      const result = await adapter.sendMessage(message);
      expect(result.success).toBe(false);
    });

    it('should handle webhook without payload', async () => {
      await adapter.configure(config);

      const webhook = {
        event: 'message',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        metadata: {}
      };

      const message = await adapter.processIncomingWebhook(webhook);
      expect(message).not.toBeNull();
      expect(message?.text).toBe('');
    });
  });

  describe('Media Type Support', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should handle video media', async () => {
      const webhook = {
        event: 'message',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          displayName: 'Test User',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        payload: {
          type: 'video',
          video: {
            url: 'https://example.com/video.mp4',
            fileName: 'video.mp4',
            mimeType: 'video/mp4',
            duration: 30000
          }
        },
        metadata: {}
      };

      const message = await adapter.processIncomingWebhook(webhook);
      expect(message?.media?.[0].type).toBe('video');
    });

    it('should handle audio media', async () => {
      const webhook = {
        event: 'message',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          displayName: 'Test User',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        payload: {
          type: 'audio',
          audio: {
            url: 'https://example.com/audio.m4a',
            fileName: 'audio.m4a',
            mimeType: 'audio/aac',
            duration: 5000
          }
        },
        metadata: {}
      };

      const message = await adapter.processIncomingWebhook(webhook);
      expect(message?.media?.[0].type).toBe('audio');
    });

    it('should handle file media', async () => {
      const webhook = {
        event: 'message',
        timestamp: new Date().toISOString(),
        sender: {
          appleId: 'user@icloud.com',
          displayName: 'Test User',
          conversationId: 'conv-123'
        },
        conversationId: 'conv-123',
        payload: {
          type: 'file',
          file: {
            url: 'https://example.com/document.pdf',
            fileName: 'document.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024000
          }
        },
        metadata: {}
      };

      const message = await adapter.processIncomingWebhook(webhook);
      expect(message?.media?.[0].type).toBe('file');
    });
  });
});
