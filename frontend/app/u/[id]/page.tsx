'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  MessageSquare,
  Users,
  Activity,
} from 'lucide-react';
import { usersService, conversationsService, type UserStats } from '@/services';
import { type User } from '@/types';
import { useI18n } from '@/hooks/useI18n';

interface ProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const router = useRouter();
  const { t } = useI18n('profile');
  const { t: tCommon } = useI18n('common');
  
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Résoudre les paramètres asynchrones
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      
      if (!id || id === 'me') {
        router.push('/u');
        return;
      }
      
      setUserId(id);
    };
    resolveParams();
  }, [params, router]);

  const loadCurrentUser = async () => {
    try {
      const response = await usersService.getMyProfile();
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await usersService.getUserProfile(userId);
      setUser(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error(t('userNotFound'));
    }
  }, [userId, t]);

  const loadUserStats = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await usersService.getUserStats(userId);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const loadData = async () => {
      await loadCurrentUser();
      await Promise.all([
        loadUserProfile(),
        loadUserStats(),
      ]);
    };
    
    loadData();
  }, [userId, loadUserProfile, loadUserStats]);

  const handleStartConversation = async () => {
    if (!user || !currentUser) return;

    // Validate that user has a valid ID
    if (!user.id || user.id.trim().length === 0) {
      toast.error('Impossible de créer la conversation: utilisateur invalide');
      return;
    }

    try {
      // Créer le nom de la conversation avec les deux usernames
      const conversationName = `${currentUser.username} & ${user.username}`;
      
      const response = await conversationsService.createConversation({
        type: 'direct',
        title: conversationName,
        participantIds: [user.id], // Don't include currentUser.id - backend adds creator automatically
      });

      router.push(`/conversations/${response.id}`);
      toast.success('Conversation créée');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Impossible de créer la conversation');
    }
  };

  const getUserDisplayName = (userData: User): string => {
    if (userData.displayName) return userData.displayName;
    
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    return fullName || userData.username || 'User';
  };

  const isMyProfile = currentUser?.id === userId;

  if (loading) {
    return (
      <DashboardLayout title={t('title')} hideSearch>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4 mb-8">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
            <div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout title={t('title')} hideSearch>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {tCommon('back')}
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          </div>
          
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('userNotFound')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center max-w-sm">
                {t('userNotFoundDescription')}
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={getUserDisplayName(user)} hideSearch>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tCommon('back')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('userProfile')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start space-x-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {getUserDisplayName(user).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online status indicator */}
                    <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-white dark:border-gray-800 ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {getUserDisplayName(user)}
                      </h2>
                      {user.username && (
                        <p className="text-gray-600 dark:text-gray-400">@{user.username}</p>
                      )}
                    </div>

                    {user.createdAt && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('memberSince')} {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    )}

                    {!isMyProfile && (
                      <Button 
                        onClick={handleStartConversation} 
                        className="w-full sm:w-auto"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {t('sendMessage')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Stats */}
          {stats && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>{t('userStats')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {stats.messagesSent || 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('messagesSent')}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {stats.messagesReceived || 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('messagesReceived')}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {stats.conversationsCount || 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('conversations')}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600">
                        {stats.groupsCount || 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('groups')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
