/**
 * BFF API Route: /api/messages
 * Proxies message requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

export async function POST(request: NextRequest) {
  return proxyToGateway(request, '/api/messages');
}
