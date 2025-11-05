/**
 * BFF API Route: /api/admin
 * Proxies admin requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway, appendQueryParams } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  const endpoint = appendQueryParams(request, '/api/admin');
  return proxyToGateway(request, endpoint);
}
