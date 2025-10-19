import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SigninPageContent from '../page';

interface AffiliateSigninPageProps {
  params: { token: string };
}

export async function generateMetadata({ params }: AffiliateSigninPageProps): Promise<Metadata> {
  const { token } = params;
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
                url: affiliateUser.avatar || `${frontendUrl}/api/og-image?type=affiliate&title=Rejoignez Meeshy&subtitle=Invitation d'un ami`,
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
            images: [affiliateUser.avatar || `${frontendUrl}/api/og-image?type=affiliate&title=Rejoignez Meeshy&subtitle=Invitation d'un ami`],
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

export default function AffiliateSigninPage({ params }: AffiliateSigninPageProps) {
  return <SigninPageContent affiliateToken={params.token} />;
}
