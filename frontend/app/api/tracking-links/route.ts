/**
 * BFF API Route: /api/tracking-links
 * Proxies tracking links requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

export async function GET(request: NextRequest) {
  return proxyToGateway(request, '/api/tracking-links');
}

export async function POST(request: NextRequest) {
  return proxyToGateway(request, '/api/tracking-links');
}
