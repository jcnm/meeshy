import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SigninPageContent from '../../page';

interface AffiliateSigninPageProps {
  params: { token: string };
}

export async function generateMetadata({ params }: AffiliateSigninPageProps): Promise<Metadata> {
  const { token } = await params;
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3100';
  
  try {
    // Générer des métadonnées dynamiques pour les liens d'affiliation
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/affiliate/validate/${token}`, {
      next: { revalidate: 300 } // Cache 5 minutes
    });
    
    if (response.ok) {
      const data = await response.json();
      const affiliateUser = data.data?.affiliateUser;
      
      if (affiliateUser) {
        const title = `Rejoignez Meeshy avec ${affiliateUser.firstName} ${affiliateUser.lastName}`;
        const description = `Connectez-vous avec ${affiliateUser.firstName} et des milliers d'utilisateurs du monde entier sur Meeshy, la plateforme de messagerie multilingue en temps réel.`;
        
        // Construire l'URL de l'image dynamique avec les paramètres de l'utilisateur
        const imageParams = new URLSearchParams({
          type: 'affiliate',
          title: 'Rejoignez Meeshy',
          subtitle: "Invitation d'un ami",
          userAvatar: affiliateUser.avatar || '',
          userFirstName: affiliateUser.firstName || '',
          userLastName: affiliateUser.lastName || '',
          userName: affiliateUser.username || ''
        });
        
        const dynamicImageUrl = `${frontendUrl}/api/og-image-dynamic?${imageParams.toString()}`;
        
        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: `${frontendUrl}/signin/affiliate/${token}`,
            siteName: 'Meeshy',
            images: [
              {
                url: dynamicImageUrl,
                width: 1200,
                height: 630,
                alt: `${affiliateUser.firstName} ${affiliateUser.lastName} vous invite sur Meeshy`,
              },
            ],
            locale: 'fr_FR',
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [dynamicImageUrl],
            creator: '@meeshy_app',
          },
          alternates: {
            canonical: `${frontendUrl}/signin/affiliate/${token}`,
          },
        };
      }
    }
  } catch (error) {
    console.error('Erreur génération métadonnées affiliation:', error);
  }

  // Si le token est invalide, rediriger vers la page signin normale
  notFound();
}

export default async function AffiliateSigninPage({ params }: AffiliateSigninPageProps) {
  const { token } = await params;
  return <SigninPageContent affiliateToken={token} />;
}
