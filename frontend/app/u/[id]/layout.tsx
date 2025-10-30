import { Metadata } from 'next';
import { ReactNode } from 'react';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://meeshy.me';
  const { id } = params;

  // TODO: Récupérer les informations de l'utilisateur via une API pour personnaliser les meta tags
  // Pour l'instant, on utilise des meta tags génériques

  return {
    title: 'Profil utilisateur - Meeshy',
    description: 'Découvrez le profil de cet utilisateur Meeshy. Consultez ses informations, langues parlées et démarrez une conversation multilingue.',
    openGraph: {
      type: 'profile',
      locale: 'fr_FR',
      url: `${frontendUrl}/u/${id}`,
      siteName: 'Meeshy',
      title: 'Profil utilisateur - Meeshy',
      description: 'Découvrez le profil de cet utilisateur Meeshy. Consultez ses informations, langues parlées et démarrez une conversation multilingue.',
      images: [
        {
          url: `${frontendUrl}/images/meeshy-og-profile.jpg`,
          width: 1200,
          height: 630,
          alt: 'Profil utilisateur Meeshy',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Profil utilisateur - Meeshy',
      description: 'Découvrez le profil de cet utilisateur Meeshy.',
      images: [`${frontendUrl}/images/meeshy-og-profile.jpg`],
      creator: '@meeshy_app',
    },
    alternates: {
      canonical: `${frontendUrl}/u/${id}`,
    },
  };
}

export default function UserProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
