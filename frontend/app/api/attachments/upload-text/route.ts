/**
 * BFF API Route: /api/attachments/upload-text
 * Proxies text attachment upload requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

export async function POST(request: NextRequest) {
  return proxyToGateway(request, '/api/attachments/upload-text');
}
