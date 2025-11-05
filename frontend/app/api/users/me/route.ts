/**
 * BFF API Route: /api/users/me
 * Proxies current user profile requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  return proxyToGateway(request, '/api/users/me');
}

export async function PATCH(request: NextRequest) {
  return proxyToGateway(request, '/api/users/me');
}
