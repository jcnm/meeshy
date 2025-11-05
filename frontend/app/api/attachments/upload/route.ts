/**
 * BFF API Route: /api/attachments/upload
 * Proxies file upload requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyFileUploadToGateway } from '@/lib/bff-proxy';

export async function POST(request: NextRequest) {
  return proxyFileUploadToGateway(request, '/api/attachments/upload');
}
