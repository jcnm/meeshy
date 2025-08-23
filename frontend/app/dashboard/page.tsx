'use client';

import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from 'next-intl';
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Plus,
  User as UserIcon,
  Activity,
  TrendingUp,
  Globe2,
  Zap,
  Link2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CreateLinkModal } from '@/components/conversations/create-link-modal';
import { useState, useEffect } from 'react';
import type { User, Conversation } from '@/types';
import { useUser } from '@/context/AppContext';
import { dashboardService, type DashboardData } from '@/services/dashboard.service';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const t = useTranslations();
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await dashboardService.getDashboardData();
      if (response.data) {
        setDashboardData(response.data);
      } else {
        throw new Error(t('dashboard.dataLoadingError'));
      }
    } catch (err) {
      console.error('Erreur lors du chargement du dashboard:', err);
      setError(err instanceof Error ? err : new Error(t('dashboard.errorUnknown')));
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = () => {
    loadDashboardData();
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Extraction des données du dashboard
  const stats = dashboardData?.stats || {
    totalConversations: 0,
    totalCommunities: 0,
    totalMessages: 0,
    activeConversations: 0,
    translationsToday: 0,
    totalLinks: 0,
    lastUpdated: new Date(),
  };
  const recentConversations = dashboardData?.recentConversations || [];
  const recentCommunities = dashboardData?.recentCommunities || [];

  // Gestion de l'erreur et du chargement
  if (error) {
    return (
      <DashboardLayout>
                    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <div className="text-red-500">
                {t('dashboard.errorLoading', { message: error.message })}
              </div>
              <Button onClick={refresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('dashboard.retry')}
              </Button>
            </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-muted-foreground">{t('dashboard.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Greeting et actions rapides */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {t('dashboard.greeting', { name: user?.firstName || user?.username || t('dashboard.greetingFallback') })}
              </h2>
              <p className="text-gray-600">
                {t('dashboard.overview')}
              </p>
            </div>
          
                                <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button 
              className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none" 
              onClick={() => setIsCreateLinkModalOpen(true)}
            >
              <Link2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('dashboard.actions.createLink')}</span>
              <span className="sm:hidden">{t('dashboard.createLink')}</span>
            </Button>
            <Button 
              onClick={() => router.push('/conversations?new=true')}
              className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('dashboard.actions.newConversation')}</span>
              <span className="sm:hidden">{t('dashboard.newConversation')}</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/groups?new=true')}
              className="flex-1 sm:flex-none"
            >
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('dashboard.actions.createCommunity')}</span>
              <span className="sm:hidden">{t('dashboard.createCommunity')}</span>
            </Button>
          </div>
        </div>
      </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('dashboard.stats.conversations')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalConversations}</p>
                  <p className="text-blue-100 text-sm">{t('dashboard.stats.total')}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('dashboard.stats.communities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalCommunities}</p>
                  <p className="text-green-100 text-sm">{t('dashboard.stats.active')}</p>
                </div>
                <Users className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('dashboard.stats.messages')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalMessages}</p>
                  <p className="text-purple-100 text-sm">{t('dashboard.stats.thisWeek')}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('dashboard.stats.activeConversationsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.activeConversations}</p>
                  <p className="text-orange-100 text-sm">{t('dashboard.stats.inProgress')}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('dashboard.stats.translations')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.translationsToday}</p>
                  <p className="text-indigo-100 text-sm">{t('dashboard.stats.today')}</p>
                </div>
                <Globe2 className="h-8 w-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-pink-500 to-pink-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('dashboard.stats.links')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalLinks}</p>
                  <p className="text-pink-100 text-sm">{t('dashboard.stats.created')}</p>
                </div>
                <Link2 className="h-8 w-8 text-pink-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenu principal en grille */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Conversations récentes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <span>{t('dashboard.recentConversations')}</span>
                </CardTitle>
                                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push('/conversations')}
                  >
                    {t('dashboard.actions.viewAll')}
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentConversations.map((conversation) => (
                  <div 
                    key={conversation.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/conversations/${conversation.id}`)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {conversation.type === 'group' ? 
                          <Users className="h-5 w-5" /> : 
                          <UserIcon className="h-5 w-5" />
                        }
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conversation.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <p className="text-xs text-gray-500">
                            {conversation.lastMessage && new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {conversation.lastMessage?.content}
                      </p>
                    </div>
                  </div>
                ))}
                
                {recentConversations.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">{t('dashboard.emptyStates.noRecentConversations')}</p>
                                          <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => router.push('/conversations?new=true')}
                      >
                        {t('dashboard.actions.startConversation')}
                      </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Groupes récents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <span>{t('dashboard.recentCommunities')}</span>
                  </CardTitle>
                                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push('/groups')}
                  >
                    {t('dashboard.actions.viewAll')}
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentCommunities.map((community) => (
                                    <div 
                    key={community.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/groups/${community.id}`)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {community.name}
                        </p>
                        <div className="flex items-center space-x-1">
                          {community.isPrivate && (
                            <Badge variant="secondary" className="text-xs">
                              {t('communities.private')}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {t('communities.membersCount', { count: community.members.length })}
                          </Badge>
                        </div>
                      </div>
                      {community.description && (
                        <p className="text-sm text-gray-500 truncate">
                          {community.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                
                {recentCommunities.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">{t('dashboard.emptyStates.noRecentCommunities')}</p>
                                          <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => router.push('/groups?new=true')}
                      >
                        {t('dashboard.actions.createCommunityButton')}
                      </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides en bas */}
        <div className="mt-8">
          <Card>
            <CardHeader>
                              <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <span>{t('dashboard.quickActions.title')}</span>
                </CardTitle>
                <CardDescription>
                  {t('dashboard.quickActions.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <Button 
                    variant="outline" 
                    className="h-20 flex-col space-y-2"
                    onClick={() => router.push('/conversations?new=true')}
                  >
                    <MessageSquare className="h-6 w-6" />
                    <span>{t('dashboard.quickActions.newConversation')}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col space-y-2"
                    onClick={() => setIsCreateLinkModalOpen(true)}
                  >
                    <Link2 className="h-6 w-6" />
                    <span>{t('dashboard.quickActions.createLink')}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col space-y-2"
                    onClick={() => router.push('/groups?new=true')}
                  >
                    <Users className="h-6 w-6" />
                    <span>{t('dashboard.quickActions.createCommunity')}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col space-y-2"
                    onClick={() => router.push('/settings')}
                  >
                    <Settings className="h-6 w-6" />
                    <span>{t('dashboard.quickActions.settings')}</span>
                  </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal de création de lien */}
        <CreateLinkModal 
          isOpen={isCreateLinkModalOpen} 
          onClose={() => setIsCreateLinkModalOpen(false)} 
                      onLinkCreated={() => {
              setIsCreateLinkModalOpen(false);
              toast.success(t('dashboard.success.linkCreated'));
              // Recharger les données du dashboard pour mettre à jour le compteur de liens
              loadDashboardData();
            }}
        />
    </DashboardLayout>
  );
}
