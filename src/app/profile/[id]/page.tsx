'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  MessageSquare,
  Users,
  Calendar,
  Globe,
  Languages,
  Settings,
  Crown,
  Clock,
  Activity,
  Mail,
  Phone
} from 'lucide-react';
import { usersService, conversationsService, type UserStats } from '@/services';
import { type User } from '@/types';

interface ProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const router = useRouter();
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
      
      // Si l'ID est "me" ou vide, rediriger vers la page profil simple
      if (!id || id === 'me') {
        router.push('/profile');
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
      console.error('Erreur lors du chargement du profil actuel:', error);
    }
  };

  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await usersService.getUserProfile(userId);
      setUser(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      toast.error('Impossible de charger le profil utilisateur');
    }
  }, [userId]);

  const loadUserStats = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await usersService.getUserStats(userId);
      setStats(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      // Les stats ne sont pas critiques, on ne montre pas d'erreur
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

    try {
      // Créer une nouvelle conversation
      const response = await conversationsService.createConversation({
        name: `Conversation avec ${getUserDisplayName(user)}`,
        participants: [user.id],
        isGroup: false,
      });

      // Rediriger vers la conversation
      router.push(`/conversations/${response.id}`);
      toast.success('Conversation créée');
    } catch (error) {
      console.error('Erreur lors de la création de conversation:', error);
      toast.error('Impossible de créer la conversation');
    }
  };

  // Informations à masquer pour les autres utilisateurs
  const shouldShowPrivateInfo = (field: 'email' | 'phone' | 'stats' | 'preferences') => {
    if (isMyProfile) return true;
    
    // Pour l'instant, on masque toutes les infos privées pour les autres utilisateurs
    // Plus tard, on pourra ajouter des paramètres de confidentialité par utilisateur
    switch (field) {
      case 'email':
      case 'phone':
        return false; // Masquer les infos de contact
      case 'stats':
        return true; // Garder les stats visibles (activité publique)
      case 'preferences':
        return false; // Masquer les préférences linguistiques
      default:
        return true;
    }
  };

  const getUserDisplayName = (userData: User): string => {
    if (userData.displayName) return userData.displayName;
    return `${userData.firstName} ${userData.lastName}`.trim() || userData.username;
  };

  const getLastSeenFormatted = (userData: User): string => {
    if (userData.isOnline) {
      return 'En ligne maintenant';
    }
    
    if (!userData.lastSeen) {
      return 'Dernière connexion inconnue';
    }

    const lastSeen = new Date(userData.lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Vu à l&apos;instant';
    } else if (diffMinutes < 60) {
      return `Vu il y a ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `Vu il y a ${diffHours}h`;
    } else if (diffDays < 7) {
      return `Vu il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else {
      return `Vu le ${lastSeen.toLocaleDateString('fr-FR')}`;
    }
  };

  const isMyProfile = currentUser?.id === userId;

  if (loading) {
    return (
      <DashboardLayout title="Profil utilisateur" hideSearch>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4 mb-8">
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout title="Profil utilisateur" hideSearch>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Profil utilisateur</h1>
          </div>
          
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Utilisateur introuvable
              </h3>
              <p className="text-gray-600 text-center max-w-sm">
                Cet utilisateur n&apos;existe pas ou n&apos;est plus disponible.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title={isMyProfile ? 'Mon profil' : `Profil de ${getUserDisplayName(user)}`} 
      hideSearch
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isMyProfile ? 'Mon profil' : 'Profil utilisateur'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isMyProfile ? 'Gérez vos informations personnelles' : 'Informations publiques'}
              </p>
            </div>
          </div>

          {isMyProfile && (
            <Button
              onClick={() => router.push('/settings')}
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>Modifier</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start space-x-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="text-2xl">
                      {getUserDisplayName(user).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {getUserDisplayName(user)}
                      </h2>
                      <div className={`w-3 h-3 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </div>
                    
                    <p className="text-gray-600 mb-2">@{user.username}</p>
                    
                    <div className="flex items-center space-x-1 mb-4">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {getLastSeenFormatted(user)}
                      </span>
                    </div>

                    {!isMyProfile && (
                      <div className="flex items-center space-x-3">
                        <Button onClick={handleStartConversation} className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4" />
                          <span>Envoyer un message</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info - Masqué pour les autres utilisateurs */}
            {shouldShowPrivateInfo('email') && (
              <Card>
                <CardHeader>
                  <CardTitle>Informations de contact</CardTitle>
                  <CardDescription>
                    Vos informations de contact privées
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{user.email}</span>
                  </div>
                  
                  {user.phoneNumber && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{user.phoneNumber}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Membre depuis le {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informations publiques de base */}
            {!shouldShowPrivateInfo('email') && (
              <Card>
                <CardHeader>
                  <CardTitle>Informations publiques</CardTitle>
                  <CardDescription>
                    Informations visibles par tous les utilisateurs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Membre depuis le {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Utilisateur actif de Meeshy
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Language Preferences - Masqué pour les autres utilisateurs */}
            {shouldShowPrivateInfo('preferences') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Languages className="h-5 w-5" />
                    <span>Préférences linguistiques</span>
                  </CardTitle>
                  <CardDescription>
                    Configuration de traduction automatique
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Langue système</span>
                      </div>
                      <Badge variant="secondary">{user.systemLanguage}</Badge>
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Languages className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Langue régionale</span>
                      </div>
                      <Badge variant="secondary">{user.regionalLanguage}</Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Traduction automatique</span>
                      <Badge variant={user.autoTranslateEnabled ? "default" : "secondary"}>
                        {user.autoTranslateEnabled ? 'Activée' : 'Désactivée'}
                      </Badge>
                    </div>
                    
                    {user.autoTranslateEnabled && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Vers langue système</span>
                          <Badge variant={user.translateToSystemLanguage ? "default" : "secondary"}>
                            {user.translateToSystemLanguage ? 'Oui' : 'Non'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Vers langue régionale</span>
                          <Badge variant={user.translateToRegionalLanguage ? "default" : "secondary"}>
                            {user.translateToRegionalLanguage ? 'Oui' : 'Non'}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-6">
            {/* Activity Stats */}
            {stats && shouldShowPrivateInfo('stats') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Statistiques</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.messagesSent}</div>
                      <div className="text-xs text-gray-500">Messages envoyés</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.messagesReceived}</div>
                      <div className="text-xs text-gray-500">Messages reçus</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.conversationsCount}</div>
                      <div className="text-xs text-gray-500">Conversations</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats.groupsCount}</div>
                      <div className="text-xs text-gray-500">Groupes</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="text-center">
                    <div className="text-lg font-semibold">{stats.totalConversations}</div>
                    <div className="text-xs text-gray-500">Total conversations</div>
                  </div>

                  {stats.averageResponseTime && (
                    <div className="text-center">
                      <div className="text-lg font-semibold">{Math.round(stats.averageResponseTime)}min</div>
                      <div className="text-xs text-gray-500">Temps de réponse moyen</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isMyProfile ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleStartConversation}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Envoyer un message
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => router.push('/search')}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Chercher d&apos;autres utilisateurs
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => router.push('/settings')}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Modifier le profil
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => router.push('/dashboard')}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Tableau de bord
                    </Button>
                  </>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
