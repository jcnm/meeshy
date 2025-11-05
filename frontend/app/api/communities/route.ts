/**
 * BFF API Route: /api/communities
 * Proxies communities list requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway, appendQueryParams } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  const endpoint = appendQueryParams(request, '/api/communities');
  return proxyToGateway(request, endpoint);
}

export async function POST(request: NextRequest) {
  return proxyToGateway(request, '/api/communities');
}
