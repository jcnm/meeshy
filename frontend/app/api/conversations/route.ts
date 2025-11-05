/**
 * BFF API Route: /api/conversations
 * Proxies conversation list requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway, appendQueryParams } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  const endpoint = appendQueryParams(request, '/api/conversations');
  return proxyToGateway(request, endpoint);
}

export async function POST(request: NextRequest) {
  return proxyToGateway(request, '/api/conversations');
}
