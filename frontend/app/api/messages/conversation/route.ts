/**
 * BFF API Route: /api/messages/conversation
 * Proxies conversation messages list requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway, appendQueryParams } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  const endpoint = appendQueryParams(request, '/api/messages/conversation');
  return proxyToGateway(request, endpoint);
}
