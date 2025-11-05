/**
 * BFF API Route: /api/users
 * Proxies users list requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway, appendQueryParams } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  const endpoint = appendQueryParams(request, '/api/users');
  return proxyToGateway(request, endpoint);
}
