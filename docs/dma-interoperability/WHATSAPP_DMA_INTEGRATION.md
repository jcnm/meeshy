# WhatsApp DMA Integration Guide

## Overview

This guide covers the integration of WhatsApp Business API (DMA - Direct Message API) with Meeshy, enabling seamless interoperability between Meeshy users and WhatsApp users.

## Table of Contents

1. [Architecture](#architecture)
2. [Setup & Configuration](#setup--configuration)
3. [API Integration](#api-integration)
4. [Signal Protocol Encryption](#signal-protocol-encryption)
5. [Webhook Handling](#webhook-handling)
6. [Message Flow](#message-flow)
7. [Database Schema](#database-schema)
8. [Testing](#testing)
9. [Deployment](#deployment)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Meeshy Platform                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ProtocolAdapterManager                                     │
│  ├── WhatsAppDMAAdapter                                     │
│  ├── WhatsAppSignalProtocolBridge                           │
│  └── Future: iMessageAdapter, TelegramAdapter, etc.        │
│                                                             │
│  Services:                                                  │
│  ├── MessagingService (routing)                             │
│  ├── WhatsAppWebhookService (webhook handling)              │
│  └── ProtocolAdapterManager (adapter lifecycle)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ▲                                    ▼
         │                           WhatsApp Business API
         │                           (cloud.google.com)
    Meeshy REST API                           │
    Meeshy WebSocket                          │
         │                                    ▼
    ┌────┴──────────────────────────────┐
    │  WhatsApp User / Device           │
    └──────────────────────────────────┘
```

### Adapter Pattern

Meeshy uses a flexible adapter pattern for protocol integration:

```typescript
// All adapters implement IProtocolAdapter interface
interface IProtocolAdapter {
  protocol: string;
  configure(config: ProtocolAdapterConfig): Promise<void>;
  sendMessage(message: ProtocolMessage): Promise<ProtocolAdapterOutcome>;
  processIncomingWebhook(payload: any): Promise<ProtocolMessage | null>;
  getMessageStatus(externalMessageId: string): Promise<MessageStatus | null>;
  supportsEncryption(): boolean;
  verifyConnection(): Promise<boolean>;
}
```

## Setup & Configuration

### Prerequisites

1. **WhatsApp Business Account** - Create account at https://www.whatsapp.com/business/
2. **WhatsApp Business API Access** - Apply for API access
3. **Phone Number** - Verify business phone number with WhatsApp
4. **Webhooks** - Prepare webhook endpoint for incoming messages
5. **API Credentials** - Obtain API key, business account ID, phone number ID

### Environment Configuration

Create `.env` file with WhatsApp credentials:

```env
# WhatsApp DMA Configuration
WHATSAPP_ENABLED=true
WHATSAPP_API_KEY=your_api_key_here
WHATSAPP_API_SECRET=your_api_secret_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret
WHATSAPP_API_VERSION=v18.0
WHATSAPP_WEBHOOK_URL=https://your-domain.com/api/webhooks/whatsapp
WHATSAPP_VERIFY_TOKEN=your_verification_token

# Signal Protocol Configuration
SIGNAL_PROTOCOL_ENABLED=true
SIGNAL_PRIVATE_KEY_PATH=/path/to/signal/keys
```

### Programmatic Configuration

```typescript
import { ProtocolAdapterManager } from './services/ProtocolAdapterManager';

const adapterManager = new ProtocolAdapterManager();

// Configure WhatsApp adapter
await adapterManager.configureAdapter('whatsapp-dma', {
  enabled: true,
  apiKey: process.env.WHATSAPP_API_KEY,
  apiSecret: process.env.WHATSAPP_API_SECRET,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  webhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
  apiVersion: 'v18.0'
});

// Verify connection
const connected = await adapterManager.verifyConnection('whatsapp-dma');
console.log('WhatsApp connected:', connected);
```

## API Integration

### Sending Messages

#### Simple Text Message

```typescript
import { WhatsAppDMAAdapter } from './adapters/WhatsAppDMAAdapter';

const adapter = new WhatsAppDMAAdapter();
await adapter.configure(config);

const message = {
  protocolMessageId: 'msg-123',
  senderId: 'user-123',
  recipientPhoneNumber: '+1234567890',
  text: 'Hello from Meeshy!',
  timestamp: new Date(),
  isEncrypted: false,
  metadata: {}
};

const result = await adapter.sendMessage(message);

if (result.success) {
  console.log('Message sent:', result.externalMessageId);
} else {
  console.error('Failed:', result.error);
}
```

#### Message with Media

```typescript
const message = {
  protocolMessageId: 'msg-124',
  senderId: 'user-123',
  recipientPhoneNumber: '+1234567890',
  text: 'Check out this image!',
  media: [
    {
      type: 'image',
      url: 'https://example.com/image.jpg',
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
      size: 102400
    }
  ],
  timestamp: new Date(),
  isEncrypted: false,
  metadata: {}
};

const result = await adapter.sendMessage(message);
```

#### Bulk Messages

```typescript
const messages = [
  { /* message 1 */ },
  { /* message 2 */ },
  { /* message 3 */ }
];

const results = await adapter.sendBulkMessages(messages);

// results[i].success = true/false
// results[i].externalMessageId = WhatsApp message ID
```

### Supported Media Types

- **Image**: `image/jpeg`, `image/png`, `image/webp`
- **Video**: `video/mp4`, `video/3gp`
- **Audio**: `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/opus`
- **Document**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT

### Message Status Tracking

```typescript
// Get message status
const status = await adapter.getMessageStatus('wamid.123456789');

// Returns:
// {
//   status: 'delivered' | 'sent' | 'read' | 'pending' | 'failed',
//   updatedAt: Date,
//   metadata: { ... }
// }
```

## Signal Protocol Encryption

### Bridge Architecture

The WhatsApp + Signal Protocol bridge provides additional encryption layer:

```
User Message (plaintext)
    ↓
Signal Protocol Encryption
    ↓
WhatsApp API Encryption (E2EE)
    ↓
WhatsApp Backend
```

### Using Signal Protocol Bridge

```typescript
import { WhatsAppSignalProtocolBridge } from './adapters/WhatsAppSignalProtocolBridge';

const bridge = new WhatsAppSignalProtocolBridge();

// Configure with Signal Protocol support
await bridge.configure({
  enabled: true,
  apiKey: process.env.WHATSAPP_API_KEY,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET
});

// Send encrypted message
const result = await bridge.sendMessage({
  protocolMessageId: 'msg-125',
  senderId: 'user-123',
  recipientPhoneNumber: '+1234567890',
  text: 'This message is encrypted with Signal Protocol!',
  timestamp: new Date(),
  isEncrypted: false,
  metadata: {}
});

// Bridge automatically encrypts before sending to WhatsApp
```

## Webhook Handling

### Webhook Verification

WhatsApp verifies the webhook endpoint during setup. Implement the verification handler:

```typescript
import express from 'express';
import { WhatsAppWebhookService } from './services/WhatsAppWebhookService';

const app = express();
const webhookService = new WhatsAppWebhookService(
  prisma,
  messagingService,
  process.env.WHATSAPP_VERIFY_TOKEN
);

// GET /webhooks/whatsapp - Webhook verification
app.get('/webhooks/whatsapp', (req, res) => {
  try {
    const challenge = webhookService.verifyWebhook({
      'hub.mode': req.query['hub.mode'] as string,
      'hub.challenge': req.query['hub.challenge'] as string,
      'hub.verify_token': req.query['hub.verify_token'] as string
    });

    if (challenge) {
      res.send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    res.status(403).send('Forbidden');
  }
});

// POST /webhooks/whatsapp - Incoming messages
app.post('/webhooks/whatsapp', async (req, res) => {
  try {
    const result = await webhookService.handleWebhook(
      req.body,
      req.headers['x-hub-signature-256'] as string
    );

    console.log(`Processed ${result.processed} webhook events`);

    if (result.errors.length > 0) {
      console.warn('Webhook processing errors:', result.errors);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).send('Error');
  }
});
```

### Webhook Payload Example

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "123456789",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+1234567890",
              "phone_number_id": "1234567890"
            },
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                },
                "wa_id": "919876543210"
              }
            ],
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.123456789",
                "timestamp": "1234567890",
                "type": "text",
                "text": {
                  "body": "Hello from WhatsApp!"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

## Message Flow

### Outgoing Message Flow

```
User sends message in Meeshy
    ↓
MessagingService.handleMessage()
    ↓
Check destination protocol (WhatsApp)
    ↓
ProtocolAdapterManager.getAdapter('whatsapp-dma')
    ↓
WhatsAppDMAAdapter.sendMessage() or WhatsAppSignalProtocolBridge.sendMessage()
    ↓
Encrypt (if Signal Protocol enabled)
    ↓
WhatsApp Business API (graph.instagram.com)
    ↓
WhatsApp User receives message
```

### Incoming Message Flow

```
WhatsApp User sends message
    ↓
WhatsApp sends webhook to Meeshy
    ↓
POST /webhooks/whatsapp
    ↓
WhatsAppWebhookService.handleWebhook()
    ↓
WhatsAppDMAAdapter.processIncomingWebhook()
    ↓
Decrypt (if Signal Protocol encrypted)
    ↓
Get or create User in Meeshy
    ↓
Get or create Conversation (DM)
    ↓
MessagingService.handleMessage() to store in DB
    ↓
Broadcast to Meeshy Socket.IO clients
    ↓
Meeshy users see WhatsApp message
```

## Database Schema

### User Model Extensions

```prisma
model User {
  // Existing fields...

  // WhatsApp DMA Integration
  whatsAppId                String?
  whatsAppPhoneNumber       String?              @unique
  protocol                  String?              // 'whatsapp-dma'
  whatsAppConnectedAt       DateTime?
  whatsAppMetadata          Json?
}
```

### Message Model Extensions

```prisma
model Message {
  // Existing fields...

  // Protocol Integration
  protocol                  String?              // 'whatsapp-dma'
  protocolMessageId         String?
  externalMessageId         String?              // WhatsApp wamid
  status                    String               @default("pending")
  isSignalEncrypted         Boolean              @default(false)
  encryptionType            String?
  protocolMetadata          Json?
}
```

### Conversation Model Extensions

```prisma
model Conversation {
  // Existing fields...

  // Protocol Integration
  protocol                  String?
  isPrivate                 Boolean              @default(false)
  metadata                  Json?
}
```

### New Models

```prisma
// Protocol Message Mapping
model ProtocolMessageMapping {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId
  internalMessageId     String   @unique @db.ObjectId
  externalMessageId     String
  protocol              String
  protocolMetadata      Json?
  createdAt             DateTime @default(now())

  @@index([externalMessageId])
  @@index([protocol])
}

// WhatsApp Webhook Log (for debugging)
model WhatsAppWebhookLog {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId
  webhookEventType      String
  externalMessageId     String?
  phoneNumberId         String
  userId                String?  @db.ObjectId
  payload               Json
  processed             Boolean  @default(false)
  processedAt           DateTime?
  error                 String?
  metadata              Json?
  createdAt             DateTime @default(now())

  @@index([phoneNumberId])
  @@index([externalMessageId])
  @@index([processed])
}
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run WhatsApp adapter tests
npm test -- WhatsAppDMAAdapter

# Run with coverage
npm test -- --coverage
```

### Integration Tests

```typescript
// Example integration test
describe('WhatsApp DMA Integration', () => {
  it('should send and receive messages', async () => {
    // Setup
    const adapter = new WhatsAppDMAAdapter();
    await adapter.configure(config);

    // Send message
    const result = await adapter.sendMessage(testMessage);
    expect(result.success).toBe(true);

    // Simulate incoming webhook
    const incomingMessage = await adapter.processIncomingWebhook(webhookPayload);
    expect(incomingMessage?.text).toBe('Hello from WhatsApp!');
  });
});
```

### Manual Testing with curl

```bash
# Test webhook verification
curl "http://localhost:3000/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=your_token"

# Send test webhook (POST)
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d @webhook-payload.json \
  -H "X-Hub-Signature-256: sha256=signature_here"
```

## Deployment

### Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] WhatsApp Business API access verified
- [ ] Webhook endpoint accessible from WhatsApp servers
- [ ] HTTPS enabled on webhook endpoint
- [ ] Database migrations applied
- [ ] Signal Protocol keys generated (if using encryption)
- [ ] Tests passing (100% critical path coverage)
- [ ] Rate limiting configured
- [ ] Error handling and monitoring set up

### Production Configuration

```typescript
// Use environment variables for all secrets
const config: WhatsAppDMAConfig = {
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  apiKey: process.env.WHATSAPP_API_KEY,
  apiSecret: process.env.WHATSAPP_API_SECRET,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  webhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
  apiVersion: 'v18.0'
};

// Initialize on startup
const adapterManager = new ProtocolAdapterManager();
await adapterManager.configureAdapter('whatsapp-dma', config);
const connected = await adapterManager.verifyConnection('whatsapp-dma');

if (!connected) {
  console.error('Failed to connect to WhatsApp DMA');
  process.exit(1);
}
```

### Monitoring & Logging

```typescript
// Log important events
logger.info('WhatsApp adapter configured', { protocol: 'whatsapp-dma' });
logger.warn('WhatsApp webhook processing error', { error, messageId });
logger.error('WhatsApp API connection failed', { reason });

// Monitor metrics
metrics.increment('whatsapp.messages.sent');
metrics.increment('whatsapp.messages.received');
metrics.timing('whatsapp.api.response_time', duration);
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Webhook not receiving | Check HTTPS, firewall, webhook URL configuration |
| Messages not sending | Verify API key, phone number format (+country code) |
| High latency | Check API rate limits, network connectivity |
| Encryption errors | Verify Signal Protocol keys, cryptography library versions |

### Debug Mode

```typescript
// Enable verbose logging
process.env.DEBUG = 'meeshy:*';

// Get adapter statistics
const stats = adapterManager.getStatistics();
console.log('Adapter stats:', stats);

// Check configuration
const config = adapterManager.getConfig('whatsapp-dma');
console.log('WhatsApp config:', { ...config, apiKey: '***' });
```

## References

- [WhatsApp Business Platform](https://www.whatsapp.com/business/)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Signal Protocol Library](https://signal.org/docs/)
- [Meeshy DMA Implementation Plan](./DMA_IMPLEMENTATION_PLAN.md)
