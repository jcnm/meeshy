'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare,
  Users,
  UserPlus,
  Link2,
  TrendingUp,
  Activity,
  ArrowRight,
  Clock
} from 'lucide-react';
import { User, Conversation, Group } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

interface DashboardLayoutProps {
  currentUser: User;
}

interface DashboardStats {
  totalConversations: number;
  totalGroups: number;
  totalMessages: number;
  unreadMessages: number;
  activeConversations: number;
  weeklyActivity: number;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  color: string;
}

export function DashboardLayout({ currentUser }: DashboardLayoutProps) {
  const router = useRouter();
  
  // États principaux
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    totalGroups: 0,
    totalMessages: 0,
    unreadMessages: 0,
    activeConversations: 0,
    weeklyActivity: 0
  });
  
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Actions rapides
  const quickActions: QuickAction[] = [
    {
      id: 'new-conversation',
      title: 'Nouvelle conversation',
      description: 'Commencer une nouvelle discussion',
      icon: MessageSquare,
      action: () => router.push('/conversations?new=true'),
      color: 'bg-blue-500'
    },
    {
      id: 'create-group',
      title: 'Créer un groupe',
      description: 'Organiser une discussion de groupe',
      icon: Users,
      action: () => router.push('/groups?new=true'),
      color: 'bg-green-500'
    },
    {
      id: 'add-contact',
      title: 'Ajouter un contact',
      description: 'Inviter de nouveaux utilisateurs',
      icon: UserPlus,
      action: () => router.push('/contacts?new=true'),
      color: 'bg-purple-500'
    },
    {
      id: 'create-link',
      title: 'Créer un lien',
      description: 'Générer un lien d\'invitation',
      icon: Link2,
      action: () => router.push('/links?new=true'),
      color: 'bg-orange-500'
    }
  ];

  // Charger les données du dashboard
  const loadDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      // Charger les conversations
      const conversationsResponse = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.LIST), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let conversations: Conversation[] = [];
      if (conversationsResponse.ok) {
        conversations = await conversationsResponse.json();
      }
      
      // Charger les groupes
      const groupsResponse = await fetch(buildApiUrl(API_ENDPOINTS.GROUP.LIST), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let groups: Group[] = [];
      if (groupsResponse.ok) {
        groups = await groupsResponse.json();
      }
      
      // Calculer les statistiques
      const totalMessages = conversations.reduce((acc, conv) => acc + (conv.messages?.length || 0), 0);
      const unreadMessages = conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
      const activeConversations = conversations.filter(conv => 
        conv.lastMessage && 
        new Date(conv.lastMessage.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;
      
      setStats({
        totalConversations: conversations.length,
        totalGroups: groups.length,
        totalMessages,
        unreadMessages,
        activeConversations,
        weeklyActivity: Math.floor(Math.random() * 50) + 10 // Simulé pour l'instant
      });
      
      // Activités récentes (5 éléments max)
      setRecentConversations(conversations
        .sort((a, b) => {
          const aTime = a.lastMessage?.createdAt || a.updatedAt;
          const bTime = b.lastMessage?.createdAt || b.updatedAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        })
        .slice(0, 5)
      );
      
      setRecentGroups(groups
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
      );
      
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      toast.error('Erreur lors du chargement du dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Contenu de la sidebar
  const sidebarContent = (
    <div className="space-y-6">
      {/* Profil utilisateur */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback>
                {(currentUser.displayName || currentUser.username)?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentUser.displayName || currentUser.username}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {currentUser.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold">{stats.totalConversations}</p>
                <p className="text-xs text-gray-500">Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-lg font-bold">{stats.totalGroups}</p>
                <p className="text-xs text-gray-500">Groupes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-lg font-bold">{stats.unreadMessages}</p>
                <p className="text-xs text-gray-500">Non lus</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-lg font-bold">{stats.activeConversations}</p>
                <p className="text-xs text-gray-500">Actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Actions rapides</h3>
        <div className="space-y-2">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                className="w-full justify-start h-auto p-3"
                onClick={action.action}
              >
                <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center mr-3`}>
                  <IconComponent className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Contenu principal
  const mainContent = (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-6 space-y-8">
          {/* En-tête de bienvenue */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bonjour, {currentUser.displayName || currentUser.username} ! 👋
            </h1>
            <p className="text-gray-600">
              Voici un aperçu de votre activité sur Meeshy
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Métriques principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
                      Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {stats.totalMessages}
                    </div>
                    <p className="text-sm text-gray-600">
                      {stats.unreadMessages} non lus
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-green-500" />
                      Activité
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {stats.weeklyActivity}
                    </div>
                    <p className="text-sm text-gray-600">
                      interactions cette semaine
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-purple-500" />
                      Connexions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {stats.activeConversations}
                    </div>
                    <p className="text-sm text-gray-600">
                      conversations actives
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Conversations récentes */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <MessageSquare className="w-5 h-5 mr-2" />
                      Conversations récentes
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => router.push('/conversations')}
                    >
                      Voir tout
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentConversations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucune conversation récente
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentConversations.map((conversation) => (
                        <div 
                          key={conversation.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/conversations/${conversation.id}`)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              {conversation.isGroup ? (
                                <Users className="w-5 h-5 text-blue-600" />
                              ) : (
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">
                                {conversation.title || conversation.name || 'Conversation'}
                              </p>
                              {conversation.lastMessage && (
                                <p className="text-sm text-gray-500 truncate max-w-xs">
                                  {conversation.lastMessage.content.substring(0, 50)}...
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {conversation.lastMessage && (
                              <p className="text-xs text-gray-400">
                                {new Date(conversation.lastMessage.createdAt).toLocaleDateString()}
                              </p>
                            )}
                            {conversation.unreadCount && conversation.unreadCount > 0 && (
                              <Badge variant="destructive" className="mt-1">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Groupes récents */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Groupes récents
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => router.push('/groups')}
                    >
                      Voir tout
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun groupe récent
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentGroups.map((group) => (
                        <div 
                          key={group.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/groups/${group.id}`)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium">{group.name}</p>
                              {group.description && (
                                <p className="text-sm text-gray-500 truncate max-w-xs">
                                  {group.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary">
                              {group.members?.length || 0} membres
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <ResponsiveLayout>
      <div className="h-full flex bg-background">
        {/* Sidebar */}
        <div className="w-80 border-r bg-card/50 flex flex-col">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Dashboard</h2>
          </div>
          {sidebarContent}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Vue d&apos;ensemble</h1>
                <p className="text-muted-foreground">Activité et statistiques de votre compte</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {mainContent}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}