/**
 * Page de redirection pour les liens de tracking Meeshy
 * Route: /l/[token]
 * 
 * Cette page:
 * 1. Récupère le token du lien de tracking
 * 2. Enregistre le clic avec les informations du visiteur (IP, user-agent, etc.)
 * 3. Redirige vers l'URL originale
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

interface TrackingLinkPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Génère une empreinte simple de l'appareil côté serveur
 */
function generateServerDeviceFingerprint(userAgent: string, ip: string): string {
  let hash = 0;
  const data = `${userAgent}-${ip}`;
  
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  
  return `fp-server-${Math.abs(hash)}`;
}

/**
 * Détecte le navigateur depuis le user agent
 */
function detectBrowser(userAgent: string): string {
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  return 'Other';
}

/**
 * Détecte l'OS depuis le user agent
 */
function detectOS(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Other';
}

/**
 * Détecte le type d'appareil depuis le user agent
 */
function detectDevice(userAgent: string): string {
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    return 'mobile';
  }
  if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Enregistre le clic et retourne l'URL originale
 */
async function recordClickAndGetUrl(token: string, clickData: any): Promise<string | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    const response = await fetch(`${apiUrl}/api/tracking-links/${token}/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clickData),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to record tracking link click:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.data?.originalUrl || null;
  } catch (error) {
    console.error('Error recording tracking link click:', error);
    return null;
  }
}

/**
 * Page de redirection pour les liens de tracking
 */
export default async function TrackingLinkPage({ params }: TrackingLinkPageProps) {
  const { token } = await params;
  
  // Récupérer les headers
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
  const referrer = headersList.get('referer') || headersList.get('referrer') || '';
  const acceptLanguage = headersList.get('accept-language') || '';
  
  // Extraire la langue principale
  const language = acceptLanguage.split(',')[0]?.split('-')[0] || 'en';
  
  // Détection des informations du visiteur
  const browser = detectBrowser(userAgent);
  const os = detectOS(userAgent);
  const device = detectDevice(userAgent);
  const deviceFingerprint = generateServerDeviceFingerprint(userAgent, ip);

  // Préparer les données du clic
  const clickData = {
    userAgent,
    browser,
    os,
    device,
    language,
    referrer,
    deviceFingerprint,
    ipAddress: ip,
  };


  // Enregistrer le clic et récupérer l'URL originale
  const originalUrl = await recordClickAndGetUrl(token, clickData);

  if (originalUrl) {
    redirect(originalUrl);
  } else {
    console.error(`[TrackingLink] Failed to get original URL for token: ${token}`);
    // Rediriger vers la page d'accueil ou une page d'erreur
    redirect('/?error=invalid-tracking-link');
  }
}

/**
 * Métadonnées dynamiques pour la page
 */
export async function generateMetadata({ params }: TrackingLinkPageProps) {
  const { token } = await params;
  
  return {
    title: 'Redirection Meeshy',
    description: 'Vous êtes en cours de redirection...',
    robots: 'noindex, nofollow',
  };
}
