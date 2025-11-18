# iMessage Integration Quick Start

Get iMessage bridge up and running in 15 minutes!

## Prerequisites

- Node.js 16+
- MongoDB running
- Apple Developer Account with Team ID and Key ID
- macOS or Linux (for key management)

## Step 1: Get Apple Credentials

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Log in with your Apple Developer account
3. Navigate to **Certificates, Identifiers & Profiles**
4. Under **Identifiers**, click **App IDs**
5. Create or select your App ID
6. Record your **Team ID** (in top right under your name)
7. Under **Keys**, create a new key:
   - Name: "iMessage Integration"
   - Check "App ID Primary Functionality"
   - Generate and download the `.p8` file
   - Record the **Key ID**
8. Keep the private key (`.p8`) file secure

## Step 2: Set Environment Variables

```bash
# .env.local or .env
IMESSAGE_ENABLED=true
APPLE_TEAM_ID=ABCD123456
APPLE_KEY_ID=DEF789GHI012
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
...
-----END PRIVATE KEY-----"
APPLE_BUNDLE_ID=com.example.meeshy
APPLE_WEBHOOK_SECRET=your-webhook-secret-here
APPLE_WEBHOOK_URL=https://yourdomain.com/api/webhooks/imessage
APPLE_API_VERSION=1.0
```

> **Important**: Don't commit the private key to git! Use a `.env.local` file that's in `.gitignore`

## Step 3: Initialize the Adapter

```typescript
import { ProtocolAdapterManager } from 'src/services/ProtocolAdapterManager';

const manager = new ProtocolAdapterManager();

await manager.configureAdapter('imessage', {
  enabled: true,
  appleTeamId: process.env.APPLE_TEAM_ID!,
  appleKeyId: process.env.APPLE_KEY_ID!,
  applePrivateKey: process.env.APPLE_PRIVATE_KEY!,
  bundleId: process.env.APPLE_BUNDLE_ID!,
  webhookSecret: process.env.APPLE_WEBHOOK_SECRET!,
  webhookUrl: process.env.APPLE_WEBHOOK_URL!,
  apiVersion: '1.0'
});

// Verify connection
const connected = await manager.verifyConnection('imessage');
console.log('iMessage connected:', connected);
```

## Step 4: Register Routes

```typescript
import { createiMessageWebhookRouter } from './routes/imessage-webhook.routes';

// In your Express app setup
app.use('/api/webhooks/imessage', createiMessageWebhookRouter(prisma));
```

## Step 5: Configure Webhook in Apple Console

1. Go to **App Configuration** in Apple Developer Console
2. Find **Webhooks** section
3. Add your webhook URL: `https://yourdomain.com/api/webhooks/imessage`
4. Set webhook secret: Same as `APPLE_WEBHOOK_SECRET`
5. Enable events:
   - ✅ Messages
   - ✅ Delivery receipts
   - ✅ Read receipts
   - ✅ Typing indicators
   - ✅ Connection status
6. Click **Save**

## Step 6: Send Your First Message

```typescript
import { iMessageAdapter } from 'src/adapters/iMessageAdapter';

const adapter = new iMessageAdapter();
await adapter.configure(config);

const result = await adapter.sendMessage({
  protocolMessageId: 'msg-001',
  senderId: 'user-123',
  recipientId: 'user@icloud.com',
  text: 'Hello from Meeshy via iMessage!',
  timestamp: new Date(),
  isEncrypted: false,
  metadata: {}
});

if (result.success) {
  console.log('Message sent! ID:', result.externalMessageId);
} else {
  console.error('Failed:', result.error);
}
```

## Testing the Integration

### Check Configuration Status

```bash
curl http://localhost:3000/api/webhooks/imessage/status
```

Response:
```json
{
  "status": "ok",
  "imessage": {
    "configured": true,
    "hasKeyId": true,
    "hasBundleId": true,
    "apiVersion": "1.0"
  }
}
```

### Check Webhook Health

```bash
curl http://localhost:3000/api/webhooks/imessage/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-18T10:30:00Z",
  "service": "iMessage Webhook Service"
}
```

### Test Message Sending

```bash
# In your app
const result = await adapter.sendMessage({
  protocolMessageId: 'test-msg-001',
  senderId: 'you@example.com',
  recipientId: 'recipient@icloud.com',
  text: 'Test message from Meeshy!',
  timestamp: new Date(),
  isEncrypted: false,
  metadata: {}
});

console.log(result); // Should show success: true
```

### Test Webhook Receiving

```bash
# Simulate an incoming message webhook (POST)
curl -X POST http://localhost:3000/api/webhooks/imessage \
  -H "Content-Type: application/json" \
  -H "X-Signature: abc123def456" \
  -d '{
    "event": "message",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "sender": {
      "appleId": "test@icloud.com",
      "displayName": "Test User",
      "conversationId": "conv-test-001"
    },
    "conversationId": "conv-test-001",
    "payload": {
      "type": "text",
      "text": { "body": "Test message from iMessage!" }
    },
    "metadata": {}
  }'
```

### Run Unit Tests

```bash
npm test -- iMessageAdapter.test
npm test -- iMessageSignalProtocolBridge.test
```

## Troubleshooting

### "Invalid Apple credentials"

- Verify Team ID is correct
- Check Key ID matches the `.p8` file
- Ensure private key is properly formatted
- Verify key hasn't expired in Apple Console

### "Webhook not receiving"

- Confirm HTTPS is enabled
- Check firewall allows Apple servers
- Verify webhook URL in Apple Console matches exactly
- Check logs for signature verification errors

### "Messages not sending"

- Verify iMessage adapter is configured
- Check recipient ID format (email or phone number)
- Ensure bundle ID matches your app
- Check API version compatibility

### "Read receipts not working"

- Verify "read receipts" are enabled in Apple Console
- Ensure iMessage app settings allow read receipts
- Check webhook configuration includes read events

## Next Steps

1. **Enable Signal Protocol**: See [IMESSAGE_INTEGRATION.md](./IMESSAGE_INTEGRATION.md#signal-protocol-encryption)
2. **Production Deployment**: Follow deployment guide
3. **Multi-device Support**: Configure for iPad/Mac
4. **Sticker Pack Integration**: Add custom iMessage stickers
5. **Rich Messages**: Implement interactive message types

## Quick Reference

| Task | Command/Code |
|------|-------------|
| Check status | `curl /api/webhooks/imessage/status` |
| Check health | `curl /api/webhooks/imessage/health` |
| Send message | `adapter.sendMessage(message)` |
| Get status | `adapter.getMessageStatus(messageId)` |
| Verify connection | `manager.verifyConnection('imessage')` |
| Run tests | `npm test -- iMessageAdapter.test` |

## Support & Resources

- Apple Developer: https://developer.apple.com/
- iMessage Docs: https://developer.apple.com/imessage/
- Meeshy iMessage Guide: [IMESSAGE_INTEGRATION.md](./IMESSAGE_INTEGRATION.md)
- WhatsApp Integration: [WHATSAPP_DMA_INTEGRATION.md](./WHATSAPP_DMA_INTEGRATION.md)
- DMA Plan: [DMA_IMPLEMENTATION_PLAN.md](./DMA_IMPLEMENTATION_PLAN.md)
