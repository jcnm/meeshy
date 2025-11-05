/**
 * BFF API Route: /api/notifications
 * Proxies notification requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  return proxyToGateway(request, '/api/notifications');
}
