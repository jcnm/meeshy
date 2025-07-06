'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
  Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Conversation, Group } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { CreateLinkModal } from '@/components/conversations/create-link-modal';

interface DashboardStats {
  totalConversations: number;
  totalGroups: number;
  totalMessages: number;
  activeConversations: number;
  translationsToday: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    totalGroups: 0,
    totalMessages: 0,
    activeConversations: 0,
    translationsToday: 0,
  });
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);

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
                role: 'USER' as const,
                permissions: {
                  canAccessAdmin: false,
                  canManageUsers: false,
                  canManageGroups: false,
                  canManageConversations: false,
                  canViewAnalytics: false,
                  canModerateContent: false,
                  canViewAuditLogs: false,
                  canManageNotifications: false,
                  canManageTranslations: false,
                },
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
                role: 'USER' as const,
                permissions: {
                  canAccessAdmin: false,
                  canManageUsers: false,
                  canManageGroups: false,
                  canManageConversations: false,
                  canViewAnalytics: false,
                  canModerateContent: false,
                  canViewAuditLogs: false,
                  canManageNotifications: false,
                  canManageTranslations: false,
                },
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement du tableau de bord...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
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
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => setIsCreateLinkModalOpen(true)}><Link2 className="h-4 w-4 mr-2" />Créer un lien</Button>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  onClick={() => setIsCreateLinkModalOpen(true)}
                >
                  <Link2 className="h-6 w-6" />
                  <span>Créer un lien</span>
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

        {/* Modal de création de lien */}
        <CreateLinkModal 
          isOpen={isCreateLinkModalOpen} 
          onClose={() => setIsCreateLinkModalOpen(false)} 
          onLinkCreated={() => {
            setIsCreateLinkModalOpen(false);
            toast.success('Lien de conversation créé avec succès !');
          }}
        />
    </DashboardLayout>
  );
}
