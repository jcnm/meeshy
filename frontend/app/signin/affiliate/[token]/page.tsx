import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SigninPageContent } from '../../page';
import { buildOgMetadata } from '@/lib/og-images';
import { LargeLogo } from '@/components/branding';

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
        
        const ogMetadata = buildOgMetadata('affiliate', {
          title,
          description,
          url: `${frontendUrl}/signin/affiliate/${token}`,
          frontendUrl,
        });
        
        return {
          title,
          description,
          openGraph: {
            ...ogMetadata,
            images: ogMetadata.images.map(img => ({
              ...img,
              alt: `${affiliateUser.firstName} ${affiliateUser.lastName} vous invite sur Meeshy`,
            })),
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogMetadata.images[0].url],
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
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-4">
            <LargeLogo href="/" />
            <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <SigninPageContent affiliateToken={token} />
    </Suspense>
  );
}
