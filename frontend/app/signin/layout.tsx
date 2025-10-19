import { Metadata } from 'next';
import { getOgImageUrl } from '@/lib/og-images';

const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://meeshy.me';
const ogImageUrl = getOgImageUrl('signin', frontendUrl);

export const metadata: Metadata = {
  title: 'Inscription - Meeshy',
  description: 'Créez votre compte Meeshy et rejoignez la communauté mondiale de messagerie multilingue en temps réel.',
  openGraph: {
    title: 'Inscription - Meeshy',
    description: 'Créez votre compte Meeshy et rejoignez la communauté mondiale de messagerie multilingue en temps réel.',
    url: '/signin',
    siteName: 'Meeshy',
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: 'Inscription sur Meeshy - Messagerie multilingue',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inscription - Meeshy',
    description: 'Créez votre compte Meeshy et rejoignez la communauté mondiale de messagerie multilingue en temps réel.',
    images: [ogImageUrl],
    creator: '@meeshy_app',
  },
  alternates: {
    canonical: '/signin',
  },
};

export default function SigninLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}