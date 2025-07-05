'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { ResponsiveLayout, PageHeader, PageContent } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import { DashboardLayout } from '@/components/dashboard-layout';
import { LoadingState } from '@/components/common';

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/');
          return;
        }

        const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        } else {
          localStorage.removeItem('auth_token');
          toast.error('Session expirée, veuillez vous reconnecter');
          router.push('/');
        }
      } catch (error) {
        console.error('Erreur vérification auth:', error);
        toast.error('Erreur de connexion');
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return null; // Redirection en cours
  }

  return <DashboardLayout currentUser={currentUser} />;
}
