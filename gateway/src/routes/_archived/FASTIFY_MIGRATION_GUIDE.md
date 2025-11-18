# Fastify Migration Guide for Webhook Routes

## Overview
This directory contains webhook routes and services migrated from Express to Fastify.

**Status**: ✅ Fastify migration COMPLETE
**Framework**: Fastify 5.6.1
**TypeScript**: Fully typed with FastifyRequest/FastifyReply

## Files Migrated

### Routes
- ✅ `whatsapp-webhook.routes.ts` - WhatsApp webhook handler
- ✅ `imessage-webhook.routes.ts` - iMessage webhook handler

### Services
- ✅ `../services/_archived/WhatsAppWebhookService.ts`
- ✅ `../services/_archived/iMessageWebhookService.ts`

## Migration Patterns

### Express → Fastify Route Pattern

**Express (Old)**:
```typescript
import { Router, Request, Response } from 'express';

export function createRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const value = req.query['hub.mode'];
    res.status(200).json({ success: true });
  });

  return router;
}
```

**Fastify (New)**:
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerRoutes(
  fastify: FastifyInstance,
  prisma: PrismaClient
): Promise<void> {
  fastify.get('/webhooks/whatsapp', async (
    request: FastifyRequest<{
      Querystring: {
        'hub.mode'?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const value = request.query['hub.mode'];
    reply.code(200).send({ success: true });
  });
}
```

### Key Differences

| Express | Fastify |
|---------|---------|
| `req.query` | `request.query` |
| `req.body` | `request.body` |
| `req.headers` | `request.headers` |
| `res.status(200).json()` | `reply.code(200).send()` |
| `res.send()` | `reply.send()` |
| `Router()` | `fastify.get()`, `fastify.post()`, etc |
| Return `Router` | Register routes directly on `fastify` instance |

## Typing Request/Reply

### Typed Query String
```typescript
fastify.get('/path', async (
  request: FastifyRequest<{
    Querystring: {
      'hub.mode'?: string;
      'hub.challenge'?: string;
    };
  }>,
  reply: FastifyReply
) => {
  const mode = request.query['hub.mode'];
});
```

### Typed Headers
```typescript
fastify.post('/path', async (
  request: FastifyRequest<{
    Headers: {
      'x-hub-signature-256'?: string;
    };
  }>,
  reply: FastifyReply
) => {
  const signature = request.headers['x-hub-signature-256'];
});
```

### Typed Body
```typescript
fastify.post('/path', async (
  request: FastifyRequest<{
    Body: Record<string, any>;
  }>,
  reply: FastifyReply
) => {
  const payload = request.body;
});
```

## Integration with Main Server

### Register Routes in server.ts

```typescript
import { registerWhatsAppWebhookRoutes } from './routes/_archived/whatsapp-webhook.routes';
import { registeriMessageWebhookRoutes } from './routes/_archived/imessage-webhook.routes';

async function startServer() {
  const fastify = Fastify();

  // Register webhook routes
  await registerWhatsAppWebhookRoutes(fastify, prisma);
  await registeriMessageWebhookRoutes(fastify, prisma);

  await fastify.listen({ port: 3000 });
}
```

## Logging

### Express → Fastify Logging Pattern

**Express (Old)**:
```typescript
console.error('Error:', message);
console.log('Info:', message);
```

**Fastify (New)**:
```typescript
fastify.log.error('Error:', message);
fastify.log.info('Info:', message);
```

Fastify uses structured logging with log levels:
- `fastify.log.error()` - Error level
- `fastify.log.warn()` - Warning level
- `fastify.log.info()` - Info level
- `fastify.log.debug()` - Debug level
- `fastify.log.trace()` - Trace level

## Async Error Handling

### Fire-and-Forget Async Tasks

In Fastify, you should explicitly handle promise rejections:

**Good**:
```typescript
reply.code(200).send({ success: true });

// Fire and forget with error handling
processWebhookAsync(payload).catch((error) => {
  fastify.log.error('Async processing failed:', error);
});
```

**Not Recommended**:
```typescript
// This might leave unhandled promise rejections
reply.code(200).send({ success: true });
processWebhookAsync(payload); // Fire and forget without error handling
```

## Service Classes in Fastify

Services remain largely unchanged - they're framework-agnostic:

```typescript
export class WhatsAppWebhookService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly messagingService: MessagingService,
    private readonly verifyToken: string
  ) {}

  // Methods remain the same - they don't depend on Express/Fastify
  async handleWebhook(payload: any): Promise<{ processed: number; errors: string[] }> {
    // Implementation
  }
}
```

## Restoring Full Functionality

To restore complete webhook handling:

1. **Restore Adapters**:
   - `WhatsAppDMAAdapter` - Convert WhatsApp messages to Meeshy format
   - `iMessageAdapter` - Convert iMessage events to Meeshy format

2. **Update Services**:
   - Uncomment adapter initialization
   - Restore message conversion logic
   - Implement status update handling

3. **Testing**:
   ```bash
   # Build
   pnpm run build

   # Run tests
   pnpm run test

   # Start server
   pnpm run start
   ```

## Endpoints

### WhatsApp
- `GET /webhooks/whatsapp` - Webhook verification
- `POST /webhooks/whatsapp` - Incoming messages and status updates
- `GET /webhooks/whatsapp/status` - Service health check

### iMessage
- `POST /webhooks/imessage` - Incoming messages and events
- `GET /webhooks/imessage/status` - Service health check
- `GET /webhooks/imessage/health` - Health check endpoint

## Related Documentation

- [Fastify Documentation](https://www.fastify.io)
- [Fastify Routing Guide](https://www.fastify.io/docs/latest/Guides/Getting-Started/#your-first-route)
- [TypeScript Support](https://www.fastify.io/docs/latest/Guides/TypeScript)

## Status

✅ **Migration Complete** - All Express code converted to Fastify
✅ **Compilation** - No TypeScript errors
✅ **Testing** - Ready for integration testing
⏳ **Full Implementation** - Requires adapter restoration

## Questions?

Refer to the Fastify documentation or check the inline comments in the route files.
