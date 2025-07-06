import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/lib/config';

const BACKEND_URL = APP_CONFIG.getBackendUrl();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ linkId: string }> }
) {
  try {
    const { linkId } = await context.params;
    
    const response = await fetch(`${BACKEND_URL}/conversations/link/${linkId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur de connexion au serveur' },
      { status: 500 }
    );
  }
}
