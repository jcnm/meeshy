/**
 * BFF API Route: /api/messages/:id
 * Proxies message detail requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/messages/${id}`);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/messages/${id}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyToGateway(request, `/api/messages/${id}`);
}
