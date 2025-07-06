'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Bell, 
  Search,
  Plus,
  LogOut,
  User as UserIcon,
  Activity,
  TrendingUp,
  Globe2,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Conversation, Group } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

interface DashboardStats {
  totalConversations: number;
  totalGroups: number;
  totalMessages: number;
  activeConversations: number;
  translationsToday: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
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
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Vérification de l'authentification et chargement des données
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/');
          return;
        }

        // Vérifier l'utilisateur actuel
        const userResponse = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userResponse.ok) {
          localStorage.removeItem('auth_token');
          router.push('/');
          return;
        }

        const userData = await userResponse.json();
        setUser(userData);

        // Charger les statistiques (mock pour l'instant)
        setStats({
          totalConversations: 12,
          totalGroups: 5,
          totalMessages: 234,
          activeConversations: 3,
          translationsToday: 45,
        });

        // Mock des conversations récentes
        setRecentConversations([
          {
            id: '1',
            name: 'Équipe Design',
            type: 'GROUP',
            lastMessage: {
              id: '1',
              conversationId: '1',
              senderId: 'user1',
              content: 'Nouveau design prêt pour review',
              originalLanguage: 'fr',
              isEdited: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              sender: {
                id: 'user1',
                username: 'designer',
                firstName: 'Marie',
                lastName: 'Dubois',
                email: 'marie@example.com',
                systemLanguage: 'fr',
                regionalLanguage: 'fr',
                autoTranslateEnabled: false,
                translateToSystemLanguage: false,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: true,
                createdAt: new Date(),
                lastActiveAt: new Date(),
              }
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            name: 'Maria Garcia',
            type: 'DIRECT',
            lastMessage: {
              id: '2',
              conversationId: '2',
              senderId: 'user2',
              content: 'Gracias por la información',
              originalLanguage: 'es',
              isEdited: false,
              createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
              updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
              sender: {
                id: 'user2',
                username: 'maria',
                firstName: 'Maria',
                lastName: 'Garcia',
                email: 'maria@example.com',
                systemLanguage: 'es',
                regionalLanguage: 'es',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: false,
                createdAt: new Date(),
                lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
              }
            },
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Mock des groupes récents
        setRecentGroups([
          {
            id: '1',
            name: 'Équipe développement',
            description: 'Discussions techniques quotidiennes',
            isPrivate: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            members: [],
            conversations: [],
          },
          {
            id: '2',
            name: 'Support client',
            description: 'Coordination support',
            isPrivate: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            members: [],
            conversations: [],
          },
        ]);

      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, [router]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGOUT), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    } finally {
      localStorage.removeItem('auth_token');
      router.push('/');
      toast.success('Déconnexion réussie');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo et titre */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Meeshy</h1>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher conversations, groupes, contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {/* Menu utilisateur */}
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-red-500">
                  3
                </Badge>
              </Button>
              
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={user.firstName} />
                  <AvatarFallback>
                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500">@{user.username}</p>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Greeting et actions rapides */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Bonjour, {user.firstName} ! 👋
              </h2>
              <p className="text-gray-600">
                Voici un aperçu de votre activité de messagerie aujourd&apos;hui.
              </p>
            </div>
            
            <div className="mt-4 md:mt-0 flex space-x-3">
              <Button 
                onClick={() => router.push('/conversations?new=true')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle conversation
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/groups?new=true')}
              >
                <Users className="h-4 w-4 mr-2" />
                Créer un groupe
              </Button>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalConversations}</p>
                  <p className="text-blue-100 text-sm">Total</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Groupes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalGroups}</p>
                  <p className="text-green-100 text-sm">Actifs</p>
                </div>
                <Users className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalMessages}</p>
                  <p className="text-purple-100 text-sm">Cette semaine</p>
                </div>
                <Activity className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Conversations actives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.activeConversations}</p>
                  <p className="text-orange-100 text-sm">En cours</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Traductions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.translationsToday}</p>
                  <p className="text-indigo-100 text-sm">Aujourd&apos;hui</p>
                </div>
                <Globe2 className="h-8 w-8 text-indigo-200" />
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
                  <span>Conversations récentes</span>
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => router.push('/conversations')}
                >
                  Voir tout
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
                        {conversation.type === 'GROUP' ? 
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
                          {conversation.isActive && (
                            <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                          )}
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
                    <p className="text-gray-500 text-sm">Aucune conversation récente</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => router.push('/conversations?new=true')}
                    >
                      Démarrer une conversation
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
                  <span>Groupes récents</span>
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => router.push('/groups')}
                >
                  Voir tout
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentGroups.map((group) => (
                  <div 
                    key={group.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/groups/${group.id}`)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        <Users className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {group.name}
                        </p>
                        <div className="flex items-center space-x-1">
                          {group.isPrivate && (
                            <Badge variant="secondary" className="text-xs">
                              Privé
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {group.members.length} membres
                          </Badge>
                        </div>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-500 truncate">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                
                {recentGroups.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">Aucun groupe récent</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => router.push('/groups?new=true')}
                    >
                      Créer un groupe
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
                <span>Actions rapides</span>
              </CardTitle>
              <CardDescription>
                Accédez rapidement aux fonctionnalités principales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col space-y-2"
                  onClick={() => router.push('/conversations?new=true')}
                >
                  <MessageSquare className="h-6 w-6" />
                  <span>Nouvelle conversation</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-20 flex-col space-y-2"
                  onClick={() => router.push('/groups?new=true')}
                >
                  <Users className="h-6 w-6" />
                  <span>Créer un groupe</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-20 flex-col space-y-2"
                  onClick={() => router.push('/settings')}
                >
                  <Settings className="h-6 w-6" />
                  <span>Paramètres</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
