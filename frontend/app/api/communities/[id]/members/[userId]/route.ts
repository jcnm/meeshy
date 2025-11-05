/**
 * BFF API Route: /api/communities/:id/members/:userId
 * Proxies community member removal requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, userId } = await context.params;
  return proxyToGateway(request, `/api/communities/${id}/members/${userId}`);
}
