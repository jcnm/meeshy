/**
 * BFF API Route: /api/conversations/:id/attachments
 * Proxies conversation attachments requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway, appendQueryParams } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const endpoint = appendQueryParams(request, `/api/conversations/${id}/attachments`);
  return proxyToGateway(request, endpoint);
}
