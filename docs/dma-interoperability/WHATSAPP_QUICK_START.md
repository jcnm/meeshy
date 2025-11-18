# WhatsApp DMA Quick Start Guide

Get WhatsApp integration up and running in 10 minutes!

## Prerequisites

- Node.js 16+
- MongoDB running
- WhatsApp Business Account
- WhatsApp API credentials

## Step 1: Set Environment Variables

```bash
# .env.local or .env
WHATSAPP_ENABLED=true
WHATSAPP_API_KEY=your_api_key_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret
WHATSAPP_VERIFY_TOKEN=meeshy-verify-token-12345
WHATSAPP_WEBHOOK_URL=https://yourdomain.com/api/webhooks/whatsapp
WHATSAPP_API_VERSION=v18.0
```

## Step 2: Register Webhook with WhatsApp

1. Go to WhatsApp Business Platform
2. Navigate to App → Configuration
3. In "Webhook" section, add your webhook URL: `https://yourdomain.com/api/webhooks/whatsapp`
4. Set verification token to match `WHATSAPP_VERIFY_TOKEN`
5. Click "Verify and Save"

## Step 3: Initialize the Adapter

```typescript
import { ProtocolAdapterManager } from 'src/services/ProtocolAdapterManager';

const manager = new ProtocolAdapterManager();

await manager.configureAdapter('whatsapp-dma', {
  enabled: true,
  apiKey: process.env.WHATSAPP_API_KEY!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
  webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET!,
  webhookUrl: process.env.WHATSAPP_WEBHOOK_URL!,
  apiVersion: 'v18.0'
});

// Verify connection
const connected = await manager.verifyConnection('whatsapp-dma');
console.log('WhatsApp connected:', connected);
```

## Step 4: Register Routes

```typescript
import { createWhatsAppWebhookRouter } from './routes/whatsapp-webhook.routes';

// In your Express app setup
app.use('/api/webhooks/whatsapp', createWhatsAppWebhookRouter(prisma));
```

## Step 5: Send Your First Message

```typescript
import { WhatsAppDMAAdapter } from 'src/adapters/WhatsAppDMAAdapter';

const adapter = new WhatsAppDMAAdapter();
await adapter.configure(config);

const result = await adapter.sendMessage({
  protocolMessageId: 'msg-001',
  senderId: 'user-123',
  recipientPhoneNumber: '+1234567890',
  text: 'Hello from Meeshy via WhatsApp!',
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

### Test Webhook Verification

```bash
curl "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=meeshy-verify-token-12345"
```

Should return: `test123`

### Test Webhook Processing

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456789",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "+1234567890",
            "phone_number_id": "1234567890"
          },
          "messages": [{
            "from": "919876543210",
            "id": "wamid.123456789",
            "timestamp": "1234567890",
            "type": "text",
            "text": {"body": "Hello Meeshy!"}
          }]
        }
      }]
    }]
  }'
```

### Run Unit Tests

```bash
npm test -- WhatsAppDMAAdapter.test
npm test -- ProtocolAdapterManager.test
```

## Common Issues

### "Invalid API Key"
- Verify API key in environment variable
- Check API key hasn't expired
- Ensure you're using the correct API version

### "Webhook verification failed"
- Verify token must match exactly
- Check webhook URL is accessible from WhatsApp servers
- Ensure HTTPS is enabled

### "Phone number not registered"
- Register phone number with WhatsApp Business
- Verify phone number has been activated
- Check phoneNumberId in configuration

## Next Steps

1. **Add Signal Protocol Encryption**: See [WHATSAPP_DMA_INTEGRATION.md](./WHATSAPP_DMA_INTEGRATION.md#signal-protocol-encryption)
2. **Customize Message Handling**: Extend `WhatsAppWebhookService`
3. **Add Rate Limiting**: Implement request throttling
4. **Monitor Webhooks**: Set up logging and alerts
5. **Test in Production**: Use WhatsApp's sandbox first

## Full Integration Checklist

- [ ] Environment variables configured
- [ ] Webhook registered with WhatsApp
- [ ] Routes registered in Express app
- [ ] Adapter initialized and connected
- [ ] Test message sent successfully
- [ ] Incoming webhook processed successfully
- [ ] Unit tests passing
- [ ] Error handling and logging working
- [ ] Rate limiting implemented
- [ ] Production deployment ready

## Support & Resources

- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp/
- Meeshy Integration Docs: [WHATSAPP_DMA_INTEGRATION.md](./WHATSAPP_DMA_INTEGRATION.md)
- Protocol Adapter Pattern: [DMA_IMPLEMENTATION_PLAN.md](./DMA_IMPLEMENTATION_PLAN.md)
