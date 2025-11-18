# iMessage Integration Guide

Integrate Apple iMessage with Meeshy for seamless cross-platform messaging between iMessage users and Meeshy users.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [API Integration](#api-integration)
5. [Signal Protocol Encryption](#signal-protocol-encryption)
6. [Webhook Handling](#webhook-handling)
7. [Message Flow](#message-flow)
8. [Testing](#testing)
9. [Deployment](#deployment)

## Overview

This guide covers integrating Apple iMessage with Meeshy using the same adapter pattern as WhatsApp DMA. iMessage integration enables:

- ✅ Send/receive messages with iMessage users
- ✅ Support for media (images, videos, audio, files)
- ✅ Message status tracking (sent, delivered, read)
- ✅ Typing indicators and presence
- ✅ Signal Protocol encryption layer
- ✅ Automatic user/conversation creation

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Meeshy Platform                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ProtocolAdapterManager                                     │
│  ├── iMessageAdapter                                        │
│  ├── iMessageSignalProtocolBridge                           │
│  ├── WhatsAppDMAAdapter                                     │
│  └── Future: TelegramAdapter, SignalAdapter, etc.          │
│                                                             │
│  Services:                                                  │
│  ├── MessagingService (routing)                             │
│  ├── iMessageWebhookService (webhook handling)              │
│  └── ProtocolAdapterManager (adapter lifecycle)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ▲                                    ▼
         │                           Apple iMessage API
         │                           (APNs, BusinessChat)
    Meeshy REST API                           │
    Meeshy WebSocket                          │
         │                                    ▼
    ┌────┴──────────────────────────────┐
    │  iMessage User / iOS/macOS App    │
    └──────────────────────────────────┘
```

### Integration Options

iMessage integration supports multiple approaches:

1. **Apple BusinessChat API** - For business accounts
2. **Direct iMessage via APNs** - Using Apple Push Notification service
3. **MacOS/iOS App Bridge** - Direct app-to-app integration
4. **iCloud Mail Bridge** - Message routing through iCloud infrastructure

## Setup & Configuration

### Prerequisites

1. **Apple Developer Account** - With an active developer membership
2. **App ID** - Created in Apple Developer Console
3. **Certificates & Keys** - Code signing certificates and private keys
4. **Bundle ID** - Unique identifier for your application
5. **APNs Configuration** - Push notification certificates (if using APNs)
6. **Webhook Endpoint** - HTTPS endpoint for receiving webhooks

### Environment Configuration

```bash
# .env or .env.local

# Apple iMessage Configuration
IMESSAGE_ENABLED=true
APPLE_TEAM_ID=ABCD123456
APPLE_KEY_ID=DEF789
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
APPLE_BUNDLE_ID=com.example.meeshy
APPLE_WEBHOOK_SECRET=your_webhook_secret
APPLE_WEBHOOK_URL=https://yourdomain.com/api/webhooks/imessage
APPLE_API_VERSION=1.0

# Optional: Business Chat specific
APPLE_BUSINESS_CHAT_ID=your_business_id
APPLE_BUSINESS_DOMAIN=your-business-domain.com
```

### Programmatic Configuration

```typescript
import { ProtocolAdapterManager } from './services/ProtocolAdapterManager';

const adapterManager = new ProtocolAdapterManager();

// Configure iMessage adapter
await adapterManager.configureAdapter('imessage', {
  enabled: true,
  appleTeamId: process.env.APPLE_TEAM_ID,
  appleKeyId: process.env.APPLE_KEY_ID,
  applePrivateKey: process.env.APPLE_PRIVATE_KEY,
  bundleId: process.env.APPLE_BUNDLE_ID,
  webhookSecret: process.env.APPLE_WEBHOOK_SECRET,
  webhookUrl: process.env.APPLE_WEBHOOK_URL,
  apiVersion: '1.0'
});

// Verify connection
const connected = await adapterManager.verifyConnection('imessage');
console.log('iMessage connected:', connected);
```

## API Integration

### Sending Messages

#### Simple Text Message

```typescript
import { iMessageAdapter } from './adapters/iMessageAdapter';

const adapter = new iMessageAdapter();
await adapter.configure(config);

const message = {
  protocolMessageId: 'msg-001',
  senderId: 'user-123',
  recipientId: 'user@icloud.com',
  text: 'Hello from Meeshy via iMessage!',
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
  protocolMessageId: 'msg-002',
  senderId: 'user-123',
  recipientId: 'user@icloud.com',
  text: 'Check out this photo!',
  media: [
    {
      type: 'image',
      url: 'https://example.com/photo.jpg',
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg'
    }
  ],
  timestamp: new Date(),
  isEncrypted: false,
  metadata: {}
};

const result = await adapter.sendMessage(message);
```

### Supported Media Types

- **Image**: JPEG, PNG, HEIC, WebP
- **Video**: MP4, MOV, HEVC
- **Audio**: AAC, M4A, MP3, OGG, WAV
- **File**: PDF, DOC, DOCX, XLS, XLSX, TXT (any file type Apple supports)
- **Location**: Coordinates with address/name
- **Sticker**: Custom sticker packs

### Message Status Tracking

```typescript
// Get message status
const status = await adapter.getMessageStatus('imsg-msg-001');

// Returns:
// {
//   status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed',
//   updatedAt: Date,
//   metadata: { conversationId, recipientAppleId, ... }
// }
```

## Signal Protocol Encryption

### Bridge Architecture

The iMessage + Signal Protocol bridge provides additional encryption:

```
User Message (plaintext)
    ↓
Signal Protocol Encryption
    ↓
iMessage E2EE (built-in)
    ↓
Apple iMessage Service
```

### Using the Bridge

```typescript
import { iMessageSignalProtocolBridge } from './adapters/iMessageSignalProtocolBridge';

const bridge = new iMessageSignalProtocolBridge();

// Configure with Signal Protocol support
await bridge.configure({
  enabled: true,
  appleTeamId: process.env.APPLE_TEAM_ID,
  appleKeyId: process.env.APPLE_KEY_ID,
  applePrivateKey: process.env.APPLE_PRIVATE_KEY,
  bundleId: process.env.APPLE_BUNDLE_ID,
  enableSignalEncryption: true
});

// Send encrypted message
const result = await bridge.sendMessage({
  protocolMessageId: 'msg-003',
  senderId: 'user-123',
  recipientId: 'user@icloud.com',
  text: 'This message uses Signal Protocol encryption!',
  timestamp: new Date(),
  isEncrypted: false,
  metadata: {}
});

// Bridge automatically encrypts before sending to iMessage
```

## Webhook Handling

### Webhook Events

iMessage webhooks support the following event types:

```typescript
type iMessageEventType =
  | 'message'     // Incoming message
  | 'delivery'    // Delivery confirmation
  | 'read'        // Read receipt
  | 'typing'      // Typing indicator
  | 'connection'  // User online/offline status
```

### Setting Up Webhooks

1. In Apple Developer Console:
   - Navigate to App Configuration
   - Add webhook URL: `https://yourdomain.com/api/webhooks/imessage`
   - Set secret key for signature verification
   - Enable events: messages, delivery receipts, read receipts, typing, connection

2. In your Meeshy app:
   - Register webhook routes
   - Configure secret key in environment variables
   - Handle incoming events

### Webhook Payload Examples

#### Message Event

```json
{
  "event": "message",
  "timestamp": "2024-11-18T10:30:00Z",
  "sender": {
    "appleId": "user@icloud.com",
    "phoneNumber": "+1234567890",
    "displayName": "John Doe",
    "conversationId": "conv-123"
  },
  "conversationId": "conv-123",
  "payload": {
    "type": "text",
    "text": {
      "body": "Hello Meeshy!"
    }
  },
  "metadata": {
    "deviceType": "iPhone",
    "osVersion": "17.1"
  }
}
```

#### Delivery Status Event

```json
{
  "event": "delivery",
  "timestamp": "2024-11-18T10:30:15Z",
  "messageId": "imsg-msg-001",
  "status": "delivered",
  "sender": {
    "appleId": "user@icloud.com",
    "conversationId": "conv-123"
  },
  "conversationId": "conv-123",
  "metadata": {}
}
```

#### Typing Indicator Event

```json
{
  "event": "typing",
  "timestamp": "2024-11-18T10:30:30Z",
  "sender": {
    "appleId": "user@icloud.com",
    "conversationId": "conv-123"
  },
  "conversationId": "conv-123",
  "metadata": {
    "typing": true
  }
}
```

#### Connection Status Event

```json
{
  "event": "connection",
  "timestamp": "2024-11-18T10:30:45Z",
  "sender": {
    "appleId": "user@icloud.com",
    "conversationId": "conv-123"
  },
  "conversationId": "conv-123",
  "metadata": {
    "online": true,
    "deviceType": "iPhone"
  }
}
```

## Message Flow

### Outgoing Message Flow

```
User sends message in Meeshy
    ↓
MessagingService.handleMessage()
    ↓
Check destination protocol (iMessage)
    ↓
ProtocolAdapterManager.getAdapter('imessage')
    ↓
iMessageAdapter.sendMessage() or iMessageSignalProtocolBridge.sendMessage()
    ↓
Encrypt (if Signal Protocol enabled)
    ↓
Apple iMessage Service
    ↓
iMessage User receives message on iPhone/Mac
```

### Incoming Message Flow

```
iMessage User sends message
    ↓
Apple iMessage Service forwards to webhook
    ↓
POST /webhooks/imessage
    ↓
iMessageWebhookService.handleWebhook()
    ↓
iMessageAdapter.processIncomingWebhook()
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
Meeshy users see iMessage message
```

## Testing

### Unit Tests

```bash
# Run iMessage adapter tests
npm test -- iMessageAdapter.test

# Run all protocol adapter tests
npm test -- .*Adapter.test
```

### Integration Tests

```typescript
describe('iMessage Integration', () => {
  it('should send and receive messages', async () => {
    // Setup
    const adapter = new iMessageAdapter();
    await adapter.configure(config);

    // Send message
    const result = await adapter.sendMessage(testMessage);
    expect(result.success).toBe(true);

    // Simulate incoming webhook
    const incomingMessage = await adapter.processIncomingWebhook(webhookPayload);
    expect(incomingMessage?.text).toBe('Hello from iMessage!');
  });
});
```

### Manual Testing

```bash
# Test webhook endpoint health
curl http://localhost:3000/api/webhooks/imessage/status

# Test webhook health
curl http://localhost:3000/api/webhooks/imessage/health

# Test webhook payload (POST)
curl -X POST http://localhost:3000/api/webhooks/imessage \
  -H "Content-Type: application/json" \
  -d @imessage-webhook-payload.json \
  -H "X-Signature: signature_here"
```

## Deployment

### Pre-Deployment Checklist

- [ ] Apple Developer Account configured
- [ ] Bundle ID and Team ID obtained
- [ ] Private key securely stored in environment
- [ ] Webhook endpoint accessible from Apple servers
- [ ] HTTPS enabled on webhook endpoint
- [ ] Database migrations applied
- [ ] All tests passing
- [ ] Error handling and logging configured
- [ ] Rate limiting implemented
- [ ] Monitoring and alerts set up

### Production Configuration

```typescript
const config: iMessageConfig = {
  enabled: process.env.IMESSAGE_ENABLED === 'true',
  appleTeamId: process.env.APPLE_TEAM_ID,
  appleKeyId: process.env.APPLE_KEY_ID,
  applePrivateKey: process.env.APPLE_PRIVATE_KEY,
  bundleId: process.env.APPLE_BUNDLE_ID,
  webhookSecret: process.env.APPLE_WEBHOOK_SECRET,
  webhookUrl: process.env.APPLE_WEBHOOK_URL,
  apiVersion: '1.0'
};

// Initialize on startup
const adapterManager = new ProtocolAdapterManager();
await adapterManager.configureAdapter('imessage', config);
const connected = await adapterManager.verifyConnection('imessage');

if (!connected) {
  console.error('Failed to connect to iMessage');
  process.exit(1);
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not receiving | Check HTTPS, firewall, webhook URL configuration |
| Messages not sending | Verify Apple Team ID, Key ID, private key |
| High latency | Check network connectivity, Apple API status |
| Encryption errors | Verify Signal Protocol library, key management |
| Webhook signature invalid | Verify webhook secret matches |

## API Limits & Quotas

- **Message Rate**: Up to 1000 messages per day (Apple BusinessChat limits)
- **Attachment Size**: Max 100MB per file
- **Concurrent Connections**: App-level, typically 100+ per bundle ID
- **Webhook Timeout**: 30 seconds per webhook processing

## References

- [Apple Developer Portal](https://developer.apple.com/)
- [iMessage Integration Guide](https://developer.apple.com/imessage/)
- [Apple BusinessChat API](https://developer.apple.com/businesschat/)
- [Signal Protocol Library](https://signal.org/docs/)
- [Meeshy WhatsApp DMA Guide](./WHATSAPP_DMA_INTEGRATION.md)
- [DMA Implementation Plan](./DMA_IMPLEMENTATION_PLAN.md)
