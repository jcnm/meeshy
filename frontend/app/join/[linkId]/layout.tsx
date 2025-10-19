import { Metadata } from 'next';

interface JoinLayoutProps {
  children: React.ReactNode;
  params: { linkId: string };
}

export async function generateMetadata({ params }: JoinLayoutProps): Promise<Metadata> {
  const { linkId } = params;
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://meeshy.me';
  
  try {
    // Récupérer les informations du lien de conversation
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://gate.meeshy.me';
    const response = await fetch(`${baseUrl}/api/links/${linkId}/info`, {
      next: { revalidate: 300 } // Cache 5 minutes
    });
    
    if (response.ok) {
      const data = await response.json();
      const shareLink = data.data?.shareLink;
      
      if (shareLink && shareLink.conversation) {
        const title = `${shareLink.conversation.title || 'Conversation Meeshy'} - Rejoignez la discussion`;
        const description = shareLink.description || `Rejoignez cette conversation sur Meeshy et discutez en temps réel avec traduction automatique dans plus de 100 langues.`;
        
        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: `${frontendUrl}/join/${linkId}`,
            siteName: 'Meeshy',
            images: [
              {
                url: `${frontendUrl}/images/meeshy-og-conversation.jpg`,
                width: 1200,
                height: 630,
                alt: `Conversation: ${shareLink.conversation.title}`,
              },
            ],
            locale: 'fr_FR',
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`${frontendUrl}/images/meeshy-og-conversation.jpg`],
            creator: '@meeshy_app',
          },
          alternates: {
            canonical: `${frontendUrl}/join/${linkId}`,
          },
        };
      }
    }
  } catch (error) {
    console.error('Erreur génération métadonnées conversation:', error);
  }

  // Métadonnées par défaut
  return {
    title: 'Rejoindre une conversation - Meeshy',
    description: 'Rejoignez une conversation multilingue en temps réel sur Meeshy. Traduction automatique, partage de fichiers et discussions globales.',
    openGraph: {
      title: 'Rejoindre une conversation - Meeshy',
      description: 'Rejoignez une conversation multilingue en temps réel sur Meeshy. Traduction automatique, partage de fichiers et discussions globales.',
      url: `${frontendUrl}/join/${linkId}`,
      siteName: 'Meeshy',
      images: [
        {
          url: `${frontendUrl}/images/meeshy-og-join.jpg`,
          width: 1200,
          height: 630,
          alt: 'Rejoindre une conversation sur Meeshy',
        },
      ],
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Rejoindre une conversation - Meeshy',
      description: 'Rejoignez une conversation multilingue en temps réel sur Meeshy. Traduction automatique, partage de fichiers et discussions globales.',
      images: [`${frontendUrl}/images/meeshy-og-join.jpg`],
      creator: '@meeshy_app',
    },
    alternates: {
      canonical: `${frontendUrl}/join/${linkId}`,
    },
  };
}

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
