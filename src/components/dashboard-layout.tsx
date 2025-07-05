'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveLayout } from '@/components/responsive-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  MessageSquare,
  Users,
  UserPlus,
  Link,
  TrendingUp,
  Activity,
  ArrowRight
} from 'lucide-react';
import { User, Conversation, Group, Message } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

interface DashboardLayoutProps {
  currentUser: User;
}

interface DashboardStats {
  totalConversations: number;
  totalGroups: number;
  totalMessages: number;
  totalContacts: number;
  totalLinks: number;
}

interface RecentActivity {
  conversations: Conversation[];
  groups: Group[];
  messages: Message[];
}

export function DashboardLayout({ currentUser }: DashboardLayoutProps) {
  const router = useRouter();
  
  // États principaux
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    totalGroups: 0,
    totalMessages: 0,
    totalContacts: 0,
    totalLinks: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity>({
    conversations: [],
    groups: [],
    messages: []
  });
  const [isLoading, setIsLoading] = useState(true);

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
      
      // Mettre à jour les stats et activités récentes
      setStats({
        totalConversations: conversations.length,
        totalGroups: groups.length,
        totalMessages: conversations.reduce((acc, conv) => acc + (conv.messages?.length || 0), 0),
        totalContacts: 0, // À implémenter
        totalLinks: 0 // À implémenter
      });
      
      setRecentActivity({
        conversations: conversations.slice(0, 5),
        groups: groups.slice(0, 5),
        messages: []
      });
      
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

  // Naviguer vers une section
  const navigateToSection = (path: string) => {
    router.push(path);
  };

  // Contenu de la sidebar
  const sidebarContent = (
    <div className="space-y-4">
      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => navigateToSection('/conversations')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Conversations
              </div>
              <Badge variant="secondary">{stats.totalConversations}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => navigateToSection('/groups')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Groupes
              </div>
              <Badge variant="secondary">{stats.totalGroups}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Messages
              </div>
              <Badge variant="secondary">{stats.totalMessages}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center">
                <UserPlus className="w-4 h-4 mr-2" />
                Contacts
              </div>
              <Badge variant="secondary">{stats.totalContacts}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center">
                <Link className="w-4 h-4 mr-2" />
                Liens
              </div>
              <Badge variant="secondary">{stats.totalLinks}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Actions rapides */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Actions rapides</h3>
        <Button 
          className="w-full justify-start" 
          variant="outline"
          onClick={() => navigateToSection('/conversations?new=true')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle conversation
        </Button>
        <Button 
          className="w-full justify-start" 
          variant="outline"
          onClick={() => navigateToSection('/groups?new=true')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Créer un groupe
        </Button>
      </div>
    </div>
  );

  // Contenu principal selon la section sélectionnée
  const renderMainContent = () => {
    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
      <div className="h-full">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-8">
            {/* Bienvenue */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bienvenue, {currentUser.displayName || currentUser.username} !
              </h1>
              <p className="text-gray-600 mt-1">
                Voici un aperçu de votre activité sur Meeshy
              </p>
            </div>

            {/* Statistiques détaillées */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversations actives</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalConversations}</div>
                  <p className="text-xs text-muted-foreground">
                    +2 cette semaine
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Groupes rejoints</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalGroups}</div>
                  <p className="text-xs text-muted-foreground">
                    +1 ce mois-ci
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Messages échangés</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalMessages}</div>
                  <p className="text-xs text-muted-foreground">
                    +12 aujourd'hui
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Conversations récentes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Conversations récentes</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigateToSection('/conversations')}
                >
                  Voir tout
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {recentActivity.conversations.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-gray-500">
                      Aucune conversation récente
                    </CardContent>
                  </Card>
                ) : (
                  recentActivity.conversations.map((conversation) => (
                    <Card 
                      key={conversation.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigateToSection(`/conversations/${conversation.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            {conversation.title || conversation.name || 'Conversation'}
                            {conversation.isGroup && (
                              <Badge variant="secondary" className="ml-2">Groupe</Badge>
                            )}
                          </CardTitle>
                          <div className="text-xs text-gray-500">
                            {conversation.lastMessage && new Date(conversation.lastMessage.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {conversation.lastMessage && (
                          <CardDescription className="text-xs">
                            {conversation.lastMessage.content.substring(0, 100)}...
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Groupes récents */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Groupes récents</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigateToSection('/groups')}
                >
                  Voir tout
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {recentActivity.groups.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-gray-500">
                      Aucun groupe récent
                    </CardContent>
                  </Card>
                ) : (
                  recentActivity.groups.map((group) => (
                    <Card 
                      key={group.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigateToSection(`/groups/${group.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center">
                            <Users className="w-4 h-4 mr-2" />
                            {group.name}
                          </CardTitle>
                          <Badge variant="secondary">
                            {group.members?.length || 0} membres
                          </Badge>
                        </div>
                        {group.description && (
                          <CardDescription className="text-xs">
                            {group.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <ResponsiveLayout
      currentUser={currentUser}
      sidebarTitle="Dashboard"
      sidebarContent={sidebarContent}
      showMainContent={true}
      mainContentTitle="Vue d'ensemble"
      mainContentSubtitle="Activité et statistiques de votre compte"
      mainContent={renderMainContent()}
      onBackToList={() => {}}
    >
      <div />
    </ResponsiveLayout>
  );
}
