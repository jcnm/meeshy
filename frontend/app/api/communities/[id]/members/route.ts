/**
 * BFF API Route: /api/communities/:id/members
 * Proxies community members requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/communities/${id}/members`);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/communities/${id}/members`);
}
