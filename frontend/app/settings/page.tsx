'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { CompleteUserSettings } from '@/components/settings/complete-user-settings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { toast } from 'sonner';
export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations('settings');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Utiliser l'endpoint /auth/me pour récupérer les données utilisateur
        const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data && result.data.user) {
            setCurrentUser(result.data.user);
          } else {
            throw new Error(result.error || 'Erreur lors du chargement du profil');
          }
        } else if (response.status === 401) {
          localStorage.removeItem('auth_token');
          router.push('/login');
          return;
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors du chargement du profil');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
        toast.error(error instanceof Error ? error.message : 'Erreur lors du chargement des paramètres');
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserSettings();
  }, [router]);

  const handleUserUpdate = async (updatedUser: Partial<User>) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(buildApiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedUser)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setCurrentUser({ ...currentUser, ...result.data });
          toast.success('Paramètres mis à jour avec succès');
        } else {
          throw new Error(result.error || 'Erreur lors de la mise à jour');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingSettings')}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <DashboardLayout title={t('title')}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('pageTitle', { username: currentUser?.username })}</h1>
        </div>
        
        <CompleteUserSettings 
          user={currentUser}
          onUserUpdate={handleUserUpdate}
        />
      </div>
    </DashboardLayout>
  );
}
