'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { User } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { CompleteUserSettings } from '@/components/settings/complete-user-settings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState<Partial<User>>({});

  useEffect(() => {
    const loadUserSettings = async () => {
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
          setLocalSettings({
            systemLanguage: userData.systemLanguage,
            regionalLanguage: userData.regionalLanguage,
            customDestinationLanguage: userData.customDestinationLanguage,
            autoTranslateEnabled: userData.autoTranslateEnabled,
            translateToSystemLanguage: userData.translateToSystemLanguage,
            translateToRegionalLanguage: userData.translateToRegionalLanguage,
            useCustomDestination: userData.useCustomDestination,
          });
        } else {
          localStorage.removeItem('auth_token');
          router.push('/');
        }
      } catch (error) {
        console.error('Erreur chargement paramètres:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserSettings();
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl('/users/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(localSettings)
      });

      if (response.ok) {
        toast.success('Paramètres sauvegardés avec succès');
        const updatedUser = await response.json();
        setCurrentUser(updatedUser);
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <DashboardLayout title="Paramètres">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Paramètres de {currentUser?.username}</h1>
          </div>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
        
        <CompleteUserSettings 
          user={currentUser}
          onUserUpdate={(updatedUser: Partial<User>) => {
            setCurrentUser({ ...currentUser, ...updatedUser });
            setLocalSettings({ ...localSettings, ...updatedUser });
          }}
        />
      </div>
    </DashboardLayout>
  );
}
