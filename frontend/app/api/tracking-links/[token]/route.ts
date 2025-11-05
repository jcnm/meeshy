/**
 * BFF API Route: /api/tracking-links/:token
 * Proxies tracking link detail requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  return proxyToGateway(request, `/api/tracking-links/${token}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  return proxyToGateway(request, `/api/tracking-links/${token}`);
}
