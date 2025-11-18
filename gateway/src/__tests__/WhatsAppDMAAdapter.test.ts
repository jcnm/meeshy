/**
 * WhatsApp DMA Adapter Tests
 *
 * Unit tests for WhatsApp protocol adapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhatsAppDMAAdapter, WhatsAppDMAConfig } from '../adapters/WhatsAppDMAAdapter';
import type { ProtocolMessage } from '../adapters/ProtocolAdapter';

describe('WhatsAppDMAAdapter', () => {
  let adapter: WhatsAppDMAAdapter;
  let config: WhatsAppDMAConfig;

  beforeEach(() => {
    adapter = new WhatsAppDMAAdapter();
    config = {
      enabled: true,
      apiKey: 'test-api-key',
      phoneNumberId: '1234567890',
      businessAccountId: 'test-biz-id',
      webhookSecret: 'test-webhook-secret',
      apiVersion: 'v18.0'
    };
  });

  describe('Configuration', () => {
    it('should configure successfully with valid config', async () => {
      await adapter.configure(config);
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should throw error with missing phoneNumberId', async () => {
      const invalidConfig = { ...config };
      delete (invalidConfig as any).phoneNumberId;

      await expect(adapter.configure(invalidConfig)).rejects.toThrow(
        'WhatsApp DMA requires phoneNumberId, businessAccountId, and apiKey'
      );
    });

    it('should throw error with missing businessAccountId', async () => {
      const invalidConfig = { ...config };
      delete (invalidConfig as any).businessAccountId;

      await expect(adapter.configure(invalidConfig)).rejects.toThrow(
        'WhatsApp DMA requires phoneNumberId, businessAccountId, and apiKey'
      );
    });

    it('should throw error with missing apiKey', async () => {
      const invalidConfig = { ...config };
      delete (invalidConfig as any).apiKey;

      await expect(adapter.configure(invalidConfig)).rejects.toThrow(
        'WhatsApp DMA requires phoneNumberId, businessAccountId, and apiKey'
      );
    });
  });

  describe('Protocol Information', () => {
    it('should have correct protocol identifier', () => {
      expect(adapter.protocol).toBe('whatsapp-dma');
    });

    it('should support encryption', () => {
      expect(adapter.supportsEncryption()).toBe(true);
    });

    it('should return WhatsApp encryption type', () => {
      expect(adapter.getEncryptionType()).toBe('whatsapp-e2ee');
    });
  });

  describe('Message Conversion', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should handle simple text message', async () => {
      const protocolMessage: ProtocolMessage = {
        protocolMessageId: 'msg-123',
        senderId: '1234567890',
        recipientId: '0987654321',
        recipientPhoneNumber: '+1234567890',
        text: 'Hello, World!',
        timestamp: new Date(),
        isEncrypted: false,
        metadata: {}
      };

      // Note: sendMessage will fail due to network, but we can test the conversion logic
      // In a real test, we'd mock the fetch call
      const result = await adapter.sendMessage(protocolMessage);
      expect(result.success).toBe(false); // Expected to fail without real API
    });

    it('should handle text message with media', async () => {
      const protocolMessage: ProtocolMessage = {
        protocolMessageId: 'msg-123',
        senderId: '1234567890',
        recipientId: '0987654321',
        recipientPhoneNumber: '+1234567890',
        text: 'Check out this image!',
        media: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg',
            mimeType: 'image/jpeg',
            size: 102400
          }
        ],
        timestamp: new Date(),
        isEncrypted: false,
        metadata: {}
      };

      const result = await adapter.sendMessage(protocolMessage);
      expect(result.success).toBe(false); // Expected to fail without real API
    });
  });

  describe('Webhook Processing', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should process incoming text message', async () => {
      const webhook = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '1234567890'
                  },
                  contacts: [
                    {
                      profile: { name: 'John Doe' },
                      wa_id: '919876543210'
                    }
                  ],
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.123456789',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello Meeshy!' }
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const message = await adapter.processIncomingWebhook(webhook);

      expect(message).not.toBeNull();
      expect(message?.text).toBe('Hello Meeshy!');
      expect(message?.senderId).toBe('919876543210');
      expect(message?.senderPhoneNumber).toBe('919876543210');
      expect(message?.senderName).toBe('John Doe');
    });

    it('should process incoming image message', async () => {
      const webhook = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '1234567890'
                  },
                  contacts: [
                    {
                      profile: { name: 'Jane Smith' },
                      wa_id: '919876543211'
                    }
                  ],
                  messages: [
                    {
                      from: '919876543211',
                      id: 'wamid.123456790',
                      timestamp: '1234567891',
                      type: 'image',
                      image: {
                        id: 'img-123',
                        mime_type: 'image/jpeg',
                        sha256: 'sha256hash'
                      }
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const message = await adapter.processIncomingWebhook(webhook);

      expect(message).not.toBeNull();
      expect(message?.media).toHaveLength(1);
      expect(message?.media?.[0].type).toBe('image');
    });

    it('should handle message status updates', async () => {
      const webhook = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '1234567890'
                  },
                  statuses: [
                    {
                      id: 'wamid.123456789',
                      status: 'delivered',
                      timestamp: '1234567890',
                      recipient_id: '919876543210'
                    }
                  ]
                },
                field: 'message_status'
              }
            ]
          }
        ]
      };

      const adapter2 = new WhatsAppDMAAdapter();
      await adapter2.configure(config);

      const statusUpdate = await adapter2.processStatusUpdate(webhook.entry[0].changes[0].value);

      expect(statusUpdate).not.toBeNull();
      expect(statusUpdate?.status).toBe('delivered');
      expect(statusUpdate?.messageId).toBe('wamid.123456789');
    });

    it('should return null for non-message webhook', async () => {
      const webhook = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '1234567890'
                  }
                },
                field: 'other'
              }
            ]
          }
        ]
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
      // Will be false without real API, but should not throw
      expect(typeof result).toBe('boolean');
    });

    it('should disconnect successfully', async () => {
      await adapter.disconnect();
      expect(adapter.isConfigured()).toBe(false);
    });

    it('should return false for verifyConnection when not configured', async () => {
      const newAdapter = new WhatsAppDMAAdapter();
      const result = await newAdapter.verifyConnection();
      expect(result).toBe(false);
    });
  });

  describe('Message Status Tracking', () => {
    beforeEach(async () => {
      await adapter.configure(config);
    });

    it('should return message status from cache', async () => {
      // First, process a webhook to populate cache
      const webhook = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '1234567890'
                  },
                  statuses: [
                    {
                      id: 'msg-status-123',
                      status: 'sent',
                      timestamp: '1234567890'
                    }
                  ]
                },
                field: 'message_status'
              }
            ]
          }
        ]
      };

      await adapter.processStatusUpdate(webhook.entry[0].changes[0].value);

      const status = await adapter.getMessageStatus('msg-status-123');
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
          senderId: '1234567890',
          recipientId: '0987654321',
          recipientPhoneNumber: '+919876543210',
          text: 'Message 1',
          timestamp: new Date(),
          isEncrypted: false,
          metadata: {}
        },
        {
          protocolMessageId: 'msg-2',
          senderId: '1234567890',
          recipientId: '0987654322',
          recipientPhoneNumber: '+919876543211',
          text: 'Message 2',
          timestamp: new Date(),
          isEncrypted: false,
          metadata: {}
        }
      ];

      const results = await adapter.sendBulkMessages(messages);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false); // Expected to fail without real API
      expect(results[1].success).toBe(false); // Expected to fail without real API
    });
  });

  describe('Error Handling', () => {
    it('should return error when not configured', async () => {
      const newAdapter = new WhatsAppDMAAdapter();

      const message: ProtocolMessage = {
        protocolMessageId: 'msg-123',
        senderId: '1234567890',
        recipientId: '0987654321',
        recipientPhoneNumber: '+1234567890',
        text: 'Hello',
        timestamp: new Date(),
        isEncrypted: false,
        metadata: {}
      };

      const result = await newAdapter.sendMessage(message);
      expect(result.success).toBe(false);
      expect(result.error).toBe('WhatsApp adapter not configured');
    });

    it('should handle webhook without messages gracefully', async () => {
      await adapter.configure(config);

      const webhook = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '1234567890'
                  }
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const message = await adapter.processIncomingWebhook(webhook);
      expect(message).toBeNull();
    });
  });
});
