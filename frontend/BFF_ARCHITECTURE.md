# Backend for Frontend (BFF) Architecture

## Overview

The Meeshy frontend now implements a **Backend for Frontend (BFF)** pattern to ensure secure and controlled communication between the frontend and backend services.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Browser)                                      │
│  - React Components                                      │
│  - Service Layer (api.service.ts, etc.)                 │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP/HTTPS (Port 3100)
                    ↓
┌─────────────────────────────────────────────────────────┐
│  BFF Layer (Next.js API Routes)                          │
│  - /app/api/auth/login/route.ts                         │
│  - /app/api/conversations/route.ts                      │
│  - /app/api/messages/route.ts                           │
│  - etc.                                                  │
│                                                          │
│  Proxy Utility: /lib/bff-proxy.ts                       │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP (Internal Network)
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Backend Gateway (Fastify)                               │
│  - Port 3000 (Internal)                                 │
│  - Database, Redis, Translation Service                 │
└─────────────────────────────────────────────────────────┘
```

## Key Components

### 1. BFF Proxy Utility (`/lib/bff-proxy.ts`)

The proxy utility handles forwarding requests from Next.js API routes to the backend gateway:

- **`proxyToGateway()`**: Forwards HTTP requests (GET, POST, PUT, DELETE, PATCH)
- **`proxyFileUploadToGateway()`**: Forwards file upload requests with FormData
- **`appendQueryParams()`**: Appends query parameters to endpoints
- **`getInternalBackendUrl()`**: Gets the backend URL for server-side requests

**Features**:
- Automatic authentication header forwarding (Bearer tokens, session tokens)
- User-agent and language header forwarding
- Error handling and logging
- Support for JSON and FormData requests

### 2. Next.js API Routes (`/app/api/`)

All API endpoints are now exposed as Next.js API routes:

#### Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/refresh`

#### Conversations
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation details
- `PUT /api/conversations/:id` - Update conversation
- `POST /api/conversations/join` - Join conversation
- `POST /api/conversations/:id/invite` - Invite users
- `GET /api/conversations/:id/links` - Get share links
- `GET /api/conversations/:id/attachments` - Get attachments

#### Messages
- `GET /api/messages/conversation` - List messages
- `POST /api/messages` - Send message
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message
- `GET /api/messages/:id/translate/:lang` - Translate message

#### Users
- `GET /api/users` - List users
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update current user
- `GET /api/users/search` - Search users

#### Attachments
- `POST /api/attachments/upload` - Upload file
- `POST /api/attachments/upload-text` - Upload text
- `GET /api/attachments/:id` - Get attachment
- `DELETE /api/attachments/:id` - Delete attachment
- `GET /api/attachments/:id/thumbnail` - Get thumbnail

#### Communities
- `GET /api/communities` - List communities
- `POST /api/communities` - Create community
- `GET /api/communities/:id` - Get community details
- `PUT /api/communities/:id` - Update community
- `GET /api/communities/:id/members` - Get members
- `POST /api/communities/:id/members` - Add member
- `DELETE /api/communities/:id/members/:userId` - Remove member

#### Other Endpoints
- `POST /api/links` - Create share link
- `POST /api/translate` - Translate text
- `GET /api/tracking-links` - List tracking links
- `POST /api/tracking-links` - Create tracking link
- `GET /api/notifications` - Get notifications
- `GET /api/admin` - Admin operations

### 3. Frontend Configuration (`/lib/config.ts`)

The configuration has been updated to implement the BFF pattern:

**Client-Side** (Browser):
```typescript
getBackendUrl() // Returns: http://localhost:3100 (or window.location.origin)
buildApiUrl('/conversations') // Returns: http://localhost:3100/api/conversations
```

**Server-Side** (Next.js API Routes, SSR):
```typescript
getBackendUrl() // Returns: http://localhost:3000 (INTERNAL_BACKEND_URL)
buildApiUrl('/conversations') // Returns: http://localhost:3000/api/conversations
```

## Environment Variables

### Required Variables

#### `INTERNAL_BACKEND_URL`
- **Purpose**: Backend URL for server-side requests (Next.js API routes → Gateway)
- **Development**: `http://localhost:3000`
- **Production**: `http://gateway:3000` (Docker internal network)

#### `NEXT_PUBLIC_BACKEND_URL`
- **Purpose**: Fallback for SSR if INTERNAL_BACKEND_URL is not set
- **Development**: `http://localhost:3000`
- **Production**: `https://gate.meeshy.me`

### Optional Variables

- `NEXT_PUBLIC_FRONTEND_URL`: Frontend URL (default: `http://localhost:3100`)
- `NEXT_PUBLIC_WS_URL`: WebSocket URL (default: `ws://localhost:3000`)
- `NEXT_PUBLIC_TRANSLATION_URL`: Translation service URL

## Security Benefits

1. **Single Entry Point**: All API requests from the browser go through Next.js API routes
2. **Token Management**: Authentication tokens are managed server-side in API routes
3. **Request Validation**: API routes can validate and sanitize requests before forwarding
4. **Rate Limiting**: Can implement rate limiting at the BFF layer
5. **Logging & Monitoring**: Centralized logging of all API requests
6. **CORS Management**: Simplified CORS configuration (frontend and BFF on same domain)

## How It Works

### Request Flow Example: Get Conversations

1. **Frontend Component** calls service:
   ```typescript
   import { conversationsService } from '@/services/conversations.service';
   const conversations = await conversationsService.getConversations();
   ```

2. **Service** uses `apiService`:
   ```typescript
   // In conversations.service.ts
   async getConversations() {
     return await apiService.get<Conversation[]>('/conversations');
   }
   ```

3. **API Service** builds URL and makes request:
   ```typescript
   // In api.service.ts
   const url = buildApiUrl('/conversations');
   // url = http://localhost:3100/api/conversations (BFF route)
   const response = await fetch(url, { headers: { Authorization: ... } });
   ```

4. **Next.js API Route** receives request:
   ```typescript
   // In /app/api/conversations/route.ts
   export async function GET(request: NextRequest) {
     return proxyToGateway(request, '/api/conversations');
   }
   ```

5. **BFF Proxy** forwards to gateway:
   ```typescript
   // In /lib/bff-proxy.ts
   const backendUrl = getInternalBackendUrl(); // http://localhost:3000
   const url = `${backendUrl}/api/conversations`;
   const response = await fetch(url, {
     headers: {
       Authorization: request.headers.get('authorization'),
       // ... other headers
     }
   });
   ```

6. **Backend Gateway** processes request and returns response

7. **BFF Proxy** returns response to frontend

## WebSocket Connections

**Note**: WebSocket connections (`Socket.IO`) still connect directly to the backend gateway because Next.js API routes don't easily proxy WebSocket connections. This is acceptable because:
- WebSocket authentication is handled via auth tokens
- WebSocket is a different protocol than HTTP
- The gateway properly handles WebSocket security

## Testing

To test the BFF implementation:

1. **Start the backend gateway**:
   ```bash
   cd gateway
   npm run dev
   ```

2. **Set environment variables**:
   ```bash
   cd frontend
   export INTERNAL_BACKEND_URL=http://localhost:3000
   export NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
   ```

3. **Start the frontend**:
   ```bash
   npm run dev
   ```

4. **Verify BFF routing**:
   - Open browser DevTools → Network tab
   - Make an API request (e.g., login, get conversations)
   - Verify requests go to `http://localhost:3100/api/...` (not directly to gateway)
   - Check server logs to see proxy forwarding to gateway

## Troubleshooting

### Issue: API requests fail with 404

**Cause**: Next.js API routes not found

**Solution**: Ensure the API route file exists and is named correctly:
- Route files must be named `route.ts`
- Dynamic segments use `[param]` folder syntax
- Example: `/app/api/conversations/[id]/route.ts`

### Issue: Authentication fails

**Cause**: Headers not forwarded correctly

**Solution**: Check that `proxyToGateway()` is forwarding auth headers:
- Verify `Authorization` header is present in request
- Check server logs for header forwarding
- Ensure `INTERNAL_BACKEND_URL` is set correctly

### Issue: CORS errors

**Cause**: CORS configuration issue

**Solution**:
- BFF pattern should eliminate CORS issues (same origin)
- Check `next.config.ts` for any restrictive settings
- Verify frontend and BFF are on the same origin

## Adding New Endpoints

To add a new BFF endpoint:

1. **Create Next.js API route**:
   ```typescript
   // /app/api/your-endpoint/route.ts
   import { NextRequest } from 'next/server';
   import { proxyToGateway } from '@/lib/bff-proxy';

   export async function GET(request: NextRequest) {
     return proxyToGateway(request, '/api/your-endpoint');
   }
   ```

2. **Frontend service calls the endpoint**:
   ```typescript
   // No changes needed - services already use buildApiUrl()
   const response = await apiService.get('/your-endpoint');
   ```

3. **Test the endpoint**:
   ```bash
   curl http://localhost:3100/api/your-endpoint \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Migration Checklist

- [x] Create BFF proxy utility (`/lib/bff-proxy.ts`)
- [x] Create Next.js API routes for all endpoints
- [x] Update frontend configuration (`/lib/config.ts`)
- [x] Add environment variables documentation (`.env.example`)
- [x] Update architecture documentation
- [ ] Test all API endpoints
- [ ] Update deployment configuration (Docker, Kubernetes, etc.)
- [ ] Monitor production logs for issues

## Future Enhancements

1. **Request Caching**: Add Redis caching at the BFF layer
2. **Rate Limiting**: Implement per-user rate limiting
3. **Request Aggregation**: Combine multiple backend requests into single frontend call
4. **Response Transformation**: Optimize response payloads for frontend needs
5. **GraphQL Layer**: Add GraphQL for more flexible queries
6. **Circuit Breaker**: Add resilience patterns for backend failures
