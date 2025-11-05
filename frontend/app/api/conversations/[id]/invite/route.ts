/**
 * BFF API Route: /api/conversations/:id/invite
 * Proxies conversation invite requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/conversations/${id}/invite`);
}
