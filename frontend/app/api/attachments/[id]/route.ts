/**
 * BFF API Route: /api/attachments/:id
 * Proxies attachment detail requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/attachments/${id}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/attachments/${id}`);
}
