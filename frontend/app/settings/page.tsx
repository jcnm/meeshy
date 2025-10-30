'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { CompleteUserSettings } from '@/components/settings/complete-user-settings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Footer } from '@/components/layout/Footer';
import { useI18n } from '@/hooks/useI18n';
import { toast } from 'sonner';
import { Settings as SettingsIcon } from 'lucide-react';
import { authManager } from '@/services/auth-manager.service';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n('settings');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const token = authManager.getAuthToken();
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
          authManager.clearAllSessions();
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
      const token = authManager.getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      // Filtrer uniquement les champs autorisés par le backend
      const filteredData: Record<string, any> = {};
      
      // Copier uniquement les champs autorisés
      if ('firstName' in updatedUser) filteredData.firstName = updatedUser.firstName;
      if ('lastName' in updatedUser) filteredData.lastName = updatedUser.lastName;
      if ('displayName' in updatedUser) filteredData.displayName = updatedUser.displayName;
      if ('email' in updatedUser) filteredData.email = updatedUser.email;
      if ('phoneNumber' in updatedUser) filteredData.phoneNumber = updatedUser.phoneNumber;
      if ('bio' in updatedUser) filteredData.bio = updatedUser.bio;
      if ('systemLanguage' in updatedUser) filteredData.systemLanguage = updatedUser.systemLanguage;
      if ('regionalLanguage' in updatedUser) filteredData.regionalLanguage = updatedUser.regionalLanguage;
      if ('customDestinationLanguage' in updatedUser) filteredData.customDestinationLanguage = updatedUser.customDestinationLanguage;
      if ('autoTranslateEnabled' in updatedUser) filteredData.autoTranslateEnabled = updatedUser.autoTranslateEnabled;
      if ('translateToSystemLanguage' in updatedUser) filteredData.translateToSystemLanguage = updatedUser.translateToSystemLanguage;
      if ('translateToRegionalLanguage' in updatedUser) filteredData.translateToRegionalLanguage = updatedUser.translateToRegionalLanguage;
      if ('useCustomDestination' in updatedUser) filteredData.useCustomDestination = updatedUser.useCustomDestination;

      const response = await fetch(buildApiUrl('/users/me'), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(filteredData)
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('loadingSettings')}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <DashboardLayout title={t('title')} className="!h-auto flex flex-col !max-w-none">
      {/* Hero Section */}
      <section className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b dark:border-gray-700 shadow-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                <SettingsIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                  {t('title')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {t('pageTitle', { username: currentUser?.username })}
                </p>
              </div>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {t('subtitle') || 'Gérez vos préférences de compte, de langue et de confidentialité'}
          </p>
        </div>
      </section>

      {/* Settings Content */}
      <section className="py-6 lg:py-8 flex-1">
        <div className="w-full">
          <CompleteUserSettings 
            user={currentUser}
            onUserUpdate={handleUserUpdate}
          />
        </div>
      </section>

      {/* Footer pleine largeur */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 mt-auto">
        <Footer />
      </div>
    </DashboardLayout>
  );
}
