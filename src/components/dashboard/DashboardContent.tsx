'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useConversations, useNotifications } from '@/context/AppContext';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { Conversation, Group } from '@/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  LoadingState
} from '@/components/common';
import { 
  MessageSquare, 
  Users, 
  Plus, 
  ArrowRight, 
  Calendar,
  TrendingUp,
  Globe,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardStats {
  totalConversations: number;
  totalGroups: number;
  totalMessages: number;
  activeConversations: number;
  translationsToday: number;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  primary?: boolean;
}

export function DashboardContent() {
  const { user } = useUser();
  const { conversations, setConversations } = useConversations();
  const { notifications } = useNotifications();
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    totalGroups: 0,
    totalMessages: 0,
    activeConversations: 0,
    translationsToday: 0,
  });
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Actions rapides
  const quickActions: QuickAction[] = [
    {
      id: 'new-conversation',
      title: 'Nouvelle conversation',
      description: 'Commencer une discussion',
      icon: MessageSquare,
      action: () => router.push('/conversations?new=true'),
      primary: true,
    },
    {
      id: 'create-group',
      title: 'Créer un groupe',
      description: 'Organiser une discussion de groupe',
      icon: Users,
      action: () => router.push('/groups?new=true'),
    },
    {
      id: 'invite-users',
      title: 'Inviter des contacts',
      description: 'Ajouter de nouveaux utilisateurs',
      icon: Plus,
      action: () => router.push('/contacts?invite=true'),
    },
  ];

  // Charger les données du dashboard
  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      
      // Charger les conversations
      const conversationsResponse = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.LIST), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      let conversations: Conversation[] = [];
      if (conversationsResponse.ok) {
        conversations = await conversationsResponse.json();
        setConversations(conversations);
        setRecentConversations(conversations.slice(0, 5));
      }

      // Charger les groupes (simulé pour l'instant)
      const groups: Group[] = []; // TODO: Implémenter l'API des groupes
      setRecentGroups(groups.slice(0, 5));

      // Calculer les statistiques
      const totalMessages = conversations.reduce((acc, conv) => acc + (conv.messages?.length || 0), 0);
      const activeConversations = conversations.filter((conv: Conversation) => {
        const lastMessage = conv.createdAt ? new Date(conv.createdAt) : null;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return lastMessage && lastMessage > oneDayAgo;
      }).length;

      setStats({
        totalConversations: conversations.length,
        totalGroups: groups.length,
        totalMessages,
        activeConversations,
        translationsToday: 42, // TODO: Récupérer depuis le cache de traduction
      });

    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      toast.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setIsLoading(false);
    }
  }, [user, setConversations]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading) {
    return <LoadingState message="Chargement du tableau de bord..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête de bienvenue */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Bonjour, {user.firstName} ! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Voici un aperçu de votre activité Meeshy
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-green-50 text-green-700">
            En ligne
          </Badge>
          <Avatar>
            <AvatarFallback>
              {user.firstName?.charAt(0) || 'U'}{user.lastName?.charAt(0) || ''}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConversations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeConversations} actives aujourd&apos;hui
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              Total échangés
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Groupes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGroups}</div>
            <p className="text-xs text-muted-foreground">
              Discussions de groupe
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Traductions</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.translationsToday}</div>
            <p className="text-xs text-muted-foreground">
              Aujourd&apos;hui
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions rapides */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-5 w-5" />
              Actions rapides
            </CardTitle>
            <CardDescription>
              Commencez rapidement une nouvelle activité
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant={action.primary ? "default" : "outline"}
                  className="w-full justify-start h-auto p-4"
                  onClick={action.action}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">{action.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Conversations récentes */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <MessageSquare className="mr-2 h-5 w-5" />
                Conversations récentes
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/conversations')}
              >
                Voir tout <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentConversations.length > 0 ? (
              <div className="space-y-3">
                {recentConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => router.push(`/conversations/${conversation.id}`)}
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        Conversation {conversation.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conversation.messages?.length || 0} messages
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">Aucune conversation</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Commencez votre première discussion
                </p>
                <Button size="sm" className="mt-2" onClick={() => router.push('/conversations?new=true')}>
                  Nouvelle conversation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications récentes */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Activité récente
              </span>
              {notifications.length > 0 && (
                <Badge variant="secondary">{notifications.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notification) => (
                  <div key={notification.id} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">Tout est à jour</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aucune nouvelle activité
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
