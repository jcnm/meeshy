'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Calendar,
  Edit,
  MessageSquare,
  Users,
  Activity,
  Globe
} from 'lucide-react';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalConversations: 0,
    totalGroups: 0,
    totalMessages: 0,
    translationsUsed: 0,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          localStorage.removeItem('auth_token');
          router.push('/login');
          return;
        }

        const userData = await response.json();
        setUser(userData);

        // Mock stats - À remplacer par de vraies données
        setStats({
          totalConversations: 12,
          totalGroups: 5,
          totalMessages: 234,
          translationsUsed: 45,
        });

      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        toast.error('Erreur lors du chargement du profil');
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      'fr': 'Français',
      'en': 'Anglais',
      'es': 'Espagnol',
      'de': 'Allemand',
      'it': 'Italien',
      'pt': 'Portugais',
    };
    return languages[code] || code;
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Profil">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 rounded-lg mb-6"></div>
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user || !user.firstName || !user.lastName || !user.username) {
    return null;
  }

  return (
    <DashboardLayout title="Profil">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header du profil */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatar} alt={user.firstName} />
                <AvatarFallback className="text-2xl">
                  {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {user.firstName} {user.lastName}
                    </h1>
                    <p className="text-lg text-gray-600">@{user.username}</p>
                    {user.displayName && (
                      <p className="text-gray-500 mt-1">{user.displayName}</p>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => router.push('/settings')}
                    className="flex items-center space-x-2"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Modifier</span>
                  </Button>
                </div>

                <div className="flex items-center space-x-1 mb-4">
                  <div className={`w-3 h-3 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-600">
                    {user.isOnline ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalConversations}</div>
                    <div className="text-sm text-gray-600">Conversations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.totalGroups}</div>
                    <div className="text-sm text-gray-600">Groupes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.totalMessages}</div>
                    <div className="text-sm text-gray-600">Messages</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.translationsUsed}</div>
                    <div className="text-sm text-gray-600">Traductions</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserIcon className="h-5 w-5" />
                <span>Informations personnelles</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-gray-600">{user.email}</p>
                </div>
              </div>
              
              {user.phoneNumber && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Téléphone</p>
                    <p className="text-gray-600">{user.phoneNumber}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Membre depuis</p>
                  <p className="text-gray-600">
                    {user.createdAt ? formatDate(
                      typeof user.createdAt === 'string' 
                        ? user.createdAt 
                        : user.createdAt.toString()
                    ) : 'Date non disponible'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Préférences de langues */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Langues</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Langue système</p>
                <Badge variant="outline">
                  {getLanguageName(user.systemLanguage || 'fr')}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-2">Langue régionale</p>
                <Badge variant="outline">
                  {getLanguageName(user.regionalLanguage || 'fr')}
                </Badge>
              </div>
              
              {user.customDestinationLanguage && (
                <div>
                  <p className="text-sm font-medium mb-2">Langue de destination personnalisée</p>
                  <Badge variant="outline">
                    {getLanguageName(user.customDestinationLanguage)}
                  </Badge>
                </div>
              )}
              
              <div className="pt-2">
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${user.autoTranslateEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm">
                    Traduction automatique {user.autoTranslateEnabled ? 'activée' : 'désactivée'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Actions rapides</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                onClick={() => router.push('/conversations')}
                className="flex items-center space-x-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Mes conversations</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => router.push('/groups')}
                className="flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Mes groupes</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => router.push('/settings')}
                className="flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Modifier le profil</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
