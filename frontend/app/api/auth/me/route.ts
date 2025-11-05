/**
 * BFF API Route: GET /api/auth/me
 * Proxies authentication me requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  return proxyToGateway(request, '/api/auth/me');
}
