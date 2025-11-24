/**
 * API endpoint pour logger les erreurs client
 * Permet de capturer les erreurs qui se produisent sur les appareils mobiles
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Logger l'erreur côté serveur
    console.error('[Client Error]', {
      timestamp: body.timestamp || new Date().toISOString(),
      url: body.url,
      message: body.message,
      stack: body.stack,
      userAgent: body.userAgent,
      digest: body.digest,
    });

    // Ici, vous pouvez envoyer l'erreur vers un service de monitoring
    // comme Sentry, LogRocket, etc.

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Client Error API] Failed to log error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log error' },
      { status: 500 }
    );
  }
}
