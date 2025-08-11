'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { CompleteUserSettings } from '@/components/settings/complete-user-settings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Paramètres de {currentUser?.username}</h1>
        </div>
        
        <CompleteUserSettings 
          user={currentUser}
          onUserUpdate={(updatedUser: Partial<User>) => {
            setCurrentUser({ ...currentUser, ...updatedUser });
          }}
        />
      </div>
    </DashboardLayout>
  );
}
