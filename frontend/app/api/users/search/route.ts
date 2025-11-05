/**
 * BFF API Route: /api/users/search
 * Proxies user search requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway, appendQueryParams } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  const endpoint = appendQueryParams(request, '/api/users/search');
  return proxyToGateway(request, endpoint);
}
