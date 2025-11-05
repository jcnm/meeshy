/**
 * BFF API Route: /api/messages/:id/translate/:lang
 * Proxies message translation requests to the backend gateway
 */

import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/bff-proxy';

interface RouteContext {
  params: Promise<{ id: string; lang: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id, lang } = await context.params;
  return proxyToGateway(request, `/api/messages/${id}/translate/${lang}`);
}
