'use client';

import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
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
  RefreshCw,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateLinkButton } from '@/components/conversations/create-link-button';
import { CreateLinkModalV2 } from '@/components/conversations/create-link-modal';
import { CreateConversationModal } from '@/components/conversations/create-conversation-modal';
// Import supprimé - la modal sera définie dans ce fichier
import { ShareAffiliateButton } from '@/components/affiliate/share-affiliate-button';
import { ShareAffiliateModal } from '@/components/affiliate/share-affiliate-modal';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Conversation } from '@/types';
import { useUser } from '@/context/AppContext';
import { dashboardService, type DashboardData } from '@/services/dashboard.service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
// Avatar déjà importé plus haut
import { Check, X, Shield, Eye, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config';
import { AuthGuard } from '@/components/auth/AuthGuard';

function DashboardPageContent() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useTranslations('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  // États pour la modal de groupe
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isGroupPrivate, setIsGroupPrivate] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    
    // Avoid too frequent API calls (30 second cache)
    const now = Date.now();
    const CACHE_DURATION = 30000; // 30 seconds
    
    if (!forceRefresh && dashboardData && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('[DASHBOARD] Using cache, no new API call');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[DASHBOARD] Loading dashboard data...');
      const response = await dashboardService.getDashboardData();
      if (response.data) {
        setDashboardData(response.data);
        setLastFetchTime(now);
      } else {
        throw new Error(t('dataLoadingError'));
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err instanceof Error ? err : new Error(t('errorUnknown')));
    } finally {
      setIsLoading(false);
    }
  }, [user, t, dashboardData, lastFetchTime]);

  const refresh = useCallback(() => {
    loadDashboardData(true); // Force refresh
  }, [loadDashboardData]);

  // Handlers pour les modales
  const handleConversationCreated = (conversationId: string) => {
    toast.success(t('success.conversationCreated'));
    setIsCreateConversationModalOpen(false);
    router.push(`/conversations/${conversationId}`);
    loadDashboardData(true);
  };

  const handleGroupCreated = (groupId: string) => {
    toast.success(t('success.groupCreated'));
    setIsCreateGroupModalOpen(false);
    router.push(`/groups/${groupId}`);
    loadDashboardData(true);
  };

  const handleLinkCreated = () => {
    toast.success(t('success.linkCreated'));
    setIsCreateLinkModalOpen(false);
    loadDashboardData(true);
  };

  // Fonctions pour la modal de groupe
  const loadUsers = useCallback(async (searchQuery: string = '') => {
    setIsLoadingUsers(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      const url = searchQuery.trim() 
        ? `${buildApiUrl('/users/search')}?q=${encodeURIComponent(searchQuery)}`
        : buildApiUrl('/users');
        
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const users = (data.data || data.users || []).filter((user: User) => 
          user.id !== user?.id && 
          !selectedUsers.some(selected => selected.id === user.id)
        );
        setAvailableUsers(users);
      } else {
        console.error('Erreur API:', response.status, response.statusText);
        toast.error('Erreur lors du chargement des utilisateurs');
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [user?.id, selectedUsers]);

  const toggleUserSelection = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Veuillez saisir un nom pour le groupe');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(buildApiUrl('/groups'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          isPrivate: isGroupPrivate,
          memberIds: selectedUsers.map(u => u.id)
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Groupe créé avec succès');
        handleGroupCreated(data.group.id);
        handleGroupModalClose();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la création du groupe');
      }
    } catch (error) {
      console.error('Erreur création groupe:', error);
      toast.error('Erreur lors de la création du groupe');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleGroupModalClose = () => {
    setGroupName('');
    setGroupDescription('');
    setIsGroupPrivate(false);
    setSelectedUsers([]);
    setGroupSearchQuery('');
    setAvailableUsers([]);
    setIsCreateGroupModalOpen(false);
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [user, loadDashboardData]);

  // Effet pour charger les utilisateurs quand la modal s'ouvre
  useEffect(() => {
    if (isCreateGroupModalOpen) {
      loadUsers();
    }
  }, [isCreateGroupModalOpen, loadUsers]);

  // Effet pour gérer la recherche en temps réel avec debounce
  useEffect(() => {
    if (isCreateGroupModalOpen && groupSearchQuery.trim()) {
      const timer = setTimeout(() => {
        loadUsers(groupSearchQuery);
      }, 300); // Debounce de 300ms

      return () => clearTimeout(timer);
    } else if (isCreateGroupModalOpen && !groupSearchQuery.trim()) {
      // Si la recherche est vide, charger tous les utilisateurs
      loadUsers();
    }
  }, [groupSearchQuery, isCreateGroupModalOpen, loadUsers]);

  // Extract dashboard data with memoization
  const stats = useMemo(() => dashboardData?.stats || {
    totalConversations: 0,
    totalCommunities: 0,
    totalMessages: 0,
    activeConversations: 0,
    translationsToday: 0,
    totalLinks: 0,
    lastUpdated: new Date(),
  }, [dashboardData?.stats]);
  
  const recentConversations = useMemo(() => dashboardData?.recentConversations || [], [dashboardData?.recentConversations]);
  const recentCommunities = useMemo(() => dashboardData?.recentCommunities || [], [dashboardData?.recentCommunities]);

  // Gestion de l'erreur et du chargement
  if (error) {
    return (
      <DashboardLayout>
                    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <div className="text-red-500">
                {t('errorLoading', { message: error.message })}
              </div>
              <Button onClick={refresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('retry')}
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
            <p className="text-muted-foreground">{t('loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Greeting and quick actions */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {t('greeting', { name: user?.firstName || user?.username || t('greetingFallback') })}
              </h2>
              <p className="text-gray-600">
                {t('overview')}
              </p>
            </div>
          
                                <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button 
              className="bg-purple-600 hover:bg-purple-700 flex-1 sm:flex-none" 
              onClick={() => setIsShareModalOpen(true)}
            >
              <Share2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('actions.shareApp')}</span>
              <span className="sm:hidden">{t('shareApp')}</span>
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none" 
              onClick={() => router.push('/links')}
            >
              <Link2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('actions.createLink')}</span>
              <span className="sm:hidden">{t('createLink')}</span>
            </Button>
            <Button 
              onClick={() => router.push('/conversations?new=true')}
              className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('actions.createConversation')}</span>
              <span className="sm:hidden">{t('createConversation')}</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/groups?new=true')}
              className="flex-1 sm:flex-none"
            >
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('actions.createCommunity')}</span>
              <span className="sm:hidden">{t('createCommunity')}</span>
            </Button>
          </div>
        </div>
      </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('stats.conversations')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalConversations}</p>
                  <p className="text-blue-100 text-sm">{t('stats.total')}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('stats.communities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalCommunities}</p>
                  <p className="text-green-100 text-sm">{t('stats.active')}</p>
                </div>
                <Users className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('stats.messages')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalMessages}</p>
                  <p className="text-purple-100 text-sm">{t('stats.thisWeek')}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('stats.activeConversationsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.activeConversations}</p>
                  <p className="text-orange-100 text-sm">{t('stats.inProgress')}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('stats.translations')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.translationsToday}</p>
                  <p className="text-indigo-100 text-sm">{t('stats.today')}</p>
                </div>
                <Globe2 className="h-8 w-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-pink-500 to-pink-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">{t('stats.links')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalLinks}</p>
                  <p className="text-pink-100 text-sm">{t('stats.created')}</p>
                </div>
                <Link2 className="h-8 w-8 text-pink-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content in grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent conversations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <span>{t('recentConversations')}</span>
                </CardTitle>
                                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push('/conversations')}
                  >
                    {t('actions.viewAll')}
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
                            {conversation.lastMessage && new Date(conversation.lastMessage.createdAt).toLocaleTimeString(t('time.format'), { 
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
                    <p className="text-gray-500 text-sm">{t('emptyStates.noRecentConversations')}</p>
                                          <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => router.push('/conversations?new=true')}
                      >
                        {t('actions.startConversation')}
                      </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent groups */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <span>{t('recentCommunities')}</span>
                  </CardTitle>
                                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push('/groups')}
                  >
                    {t('actions.viewAll')}
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
                            {t('communities.membersCount', { count: community.members.length.toString() })}
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
                    <p className="text-gray-500 text-sm">{t('emptyStates.noRecentCommunities')}</p>
                                          <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => router.push('/groups?new=true')}
                      >
                        {t('actions.createCommunityButton')}
                      </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions at bottom */}
        <div className="mt-8">
          <Card>
            <CardHeader>
                              <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <span>{t('quickActions.title')}</span>
                </CardTitle>
                <CardDescription>
                  {t('quickActions.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                  <Button 
                    variant="outline" 
                    className="h-20 flex-col space-y-2"
                    onClick={() => setIsCreateConversationModalOpen(true)}
                  >
                    <MessageSquare className="h-6 w-6" />
                    <span>{t('quickActions.newConversation')}</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex-col space-y-2"
                    onClick={() => setIsCreateLinkModalOpen(true)}
                  >
                    <Link2 className="h-6 w-6" />
                    <span>{t('quickActions.createLink')}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col space-y-2"
                    onClick={() => setIsCreateGroupModalOpen(true)}
                  >
                    <Users className="h-6 w-6" />
                    <span>{t('quickActions.createCommunity')}</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex-col space-y-2"
                    onClick={() => setIsShareModalOpen(true)}
                  >
                    <Share2 className="h-6 w-6" />
                    <span>{t('quickActions.shareApp')}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col space-y-2"
                    onClick={() => router.push('/settings')}
                  >
                    <Settings className="h-6 w-6" />
                    <span>{t('quickActions.settings')}</span>
                  </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modales */}
        <CreateConversationModal
          isOpen={isCreateConversationModalOpen}
          onClose={() => setIsCreateConversationModalOpen(false)}
          currentUser={user!}
          onConversationCreated={handleConversationCreated}
        />

        <CreateLinkModalV2
          isOpen={isCreateLinkModalOpen}
          onClose={() => setIsCreateLinkModalOpen(false)}
          onLinkCreated={handleLinkCreated}
        />

        {/* Modal de création de groupe améliorée */}
        <Dialog open={isCreateGroupModalOpen} onOpenChange={handleGroupModalClose}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Créer une nouvelle communauté</span>
              </DialogTitle>
              <DialogDescription>
                Créez une communauté pour organiser vos conversations avec plusieurs personnes
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Nom du groupe */}
              <div>
                <Label htmlFor="groupName" className="text-sm font-medium">
                  Nom de la communauté *
                </Label>
                <Input
                  id="groupName"
                  value={groupName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value)}
                  placeholder="Ex: Équipe Marketing, Famille, Amis..."
                  className="mt-1"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="groupDescription" className="text-sm font-medium">
                  Description (optionnelle)
                </Label>
                <Textarea
                  id="groupDescription"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Décrivez le but de cette communauté..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Confidentialité */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Communauté privée</Label>
                  <p className="text-xs text-gray-500">
                    {isGroupPrivate ? 'Seuls les membres invités peuvent rejoindre' : 'La communauté peut être découverte et rejointe par d\'autres'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {isGroupPrivate ? <Shield className="h-4 w-4 text-blue-600" /> : <Eye className="h-4 w-4 text-gray-400" />}
                  <Switch
                    checked={isGroupPrivate}
                    onCheckedChange={setIsGroupPrivate}
                  />
                </div>
              </div>
              
              {/* Recherche d'utilisateurs */}
              <div>
                <Label htmlFor="userSearch" className="text-sm font-medium">
                  Rechercher des membres
                </Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="userSearch"
                    value={groupSearchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom ou username..."
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Membres sélectionnés */}
              {selectedUsers.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">
                    Membres sélectionnés ({selectedUsers.length + 1} au total, vous inclus)
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Utilisateur actuel (admin) */}
                    <Badge variant="default" className="flex items-center gap-1">
                      {user?.displayName || user?.username}
                      <Shield className="h-3 w-3" />
                    </Badge>
                    {/* Membres sélectionnés */}
                    {selectedUsers.map(user => (
                      <Badge
                        key={user.id}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {user.displayName || user.username}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => toggleUserSelection(user)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Liste des utilisateurs */}
              <div>
                <Label className="text-sm font-medium">
                  Utilisateurs disponibles
                </Label>
                <ScrollArea className="h-48 mt-2 border rounded-lg">
                  {isLoadingUsers ? (
                    <div className="p-4 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      Chargement des utilisateurs...
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {groupSearchQuery.trim() ? 'Aucun utilisateur trouvé pour cette recherche' : 'Aucun utilisateur disponible'}
                    </div>
                  ) : (
                    <div className="p-2">
                      {availableUsers.map(user => {
                        const isSelected = selectedUsers.some(u => u.id === user.id);
                        return (
                          <div
                            key={user.id}
                            className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                              isSelected ? 'bg-blue-50 border border-blue-200' : ''
                            }`}
                            onClick={() => toggleUserSelection(user)}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback>
                                {(user.displayName || user.username).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {user.displayName || user.username}
                              </p>
                              <p className="text-xs text-gray-500">@{user.username}</p>
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
              
              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={createGroup}
                  disabled={!groupName.trim() || isCreatingGroup}
                  className="flex-1"
                >
                  <Users className="mr-2 h-4 w-4" />
                  {isCreatingGroup ? 'Création...' : 'Créer la communauté'}
                </Button>
                <Button
                  onClick={handleGroupModalClose}
                  variant="outline"
                >
                  Annuler
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ShareAffiliateModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          userLanguage={user?.systemLanguage || 'fr'}
        />
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardPageContent />
    </AuthGuard>
  );
}
