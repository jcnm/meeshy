'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  UserCheck, 
  Shield, 
  Activity, 
  TrendingUp,
  AlertCircle,
  Clock,
  Server
} from 'lucide-react';
import { User, UserRoleEnum } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { toast } from 'sonner';

interface AdminStats {
  totalUsers: number;
  totalActiveUsers: number;
  totalAdmins: number;
  activePercentage: number;
}

interface UserCapabilities {
  role: string;
  level: number;
  permissions: string[];
  restrictions: string[];
}

interface DashboardData {
  statistics: AdminStats;
  userInfo: {
    role: string;
    capabilities: UserCapabilities;
    assignableRoles: string[];
  };
  timestamp: string;
}

const AdminDashboard: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserAndData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Charger l'utilisateur
        const userResponse = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userResponse.ok) {
          localStorage.removeItem('auth_token');
          router.push('/login');
          return;
        }

        const userData = await userResponse.json();
        setUser(userData);

        // Vérifier les permissions admin
        if (!userData.permissions?.canAccessAdmin) {
          router.push('/dashboard');
          toast.error('Accès non autorisé à l\'administration');
          return;
        }

        // Mock des données admin pour l'instant
        setDashboardData({
          statistics: {
            totalUsers: 42,
            totalActiveUsers: 18,
            totalAdmins: 3,
            activePercentage: 75,
          },
          userInfo: {
            role: userData.role,
            capabilities: {
              role: userData.role,
              level: userData.role === UserRoleEnum.ADMIN ? 5 : 3,
              permissions: userData.permissions?.canAccessAdmin ? [
                'Gestion utilisateurs',
                'Modération contenu',
                'Accès analyses',
                'Configuration système'
              ] : [],
              restrictions: []
            },
            assignableRoles: [UserRoleEnum.USER, UserRoleEnum.MODERATOR]
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Erreur lors du chargement des données admin:', error);
        toast.error('Erreur lors du chargement des données d\'administration');
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadUserAndData();
  }, [router]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <AdminLayout currentPage="/admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des données d&apos;administration...</span>
        </div>
      </AdminLayout>
    );
  }

  const stats = dashboardData?.statistics;
  const userInfo = dashboardData?.userInfo;

  return (
    <AdminLayout currentPage="/admin">
      <div className="space-y-6">
        {/* En-tête avec informations utilisateur */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Bienvenue, {user.displayName || (user.firstName ? `${user.firstName} ${user.lastName}` : user.username)}</h1>
              <p className="text-purple-100 mt-1">
                Niveau d&apos;accès: {userInfo?.role || user.role} - Administration Meeshy
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-purple-100">Dernière connexion</div>
              <div className="text-lg font-semibold">
                {new Date().toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs totaux</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Tous les utilisateurs enregistrés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs actifs</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.totalActiveUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                En ligne actuellement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administrateurs</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats?.totalAdmins || 0}</div>
              <p className="text-xs text-muted-foreground">
                Admins et modérateurs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux d&apos;activité</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activePercentage || 0}%</div>
              <Progress value={stats?.activePercentage || 0} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Permissions et capacités */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Vos permissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userInfo?.capabilities.permissions.map((permission, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">{permission}</span>
                  </div>
                ))}
                {(!userInfo?.capabilities.permissions || userInfo.capabilities.permissions.length === 0) && (
                  <div className="text-sm text-gray-500">Aucune permission spéciale</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5" />
                <span>Restrictions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userInfo?.capabilities.restrictions.map((restriction, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">{restriction}</span>
                  </div>
                ))}
                {(!userInfo?.capabilities.restrictions || userInfo.capabilities.restrictions.length === 0) && (
                  <div className="text-sm text-gray-500">Aucune restriction</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Actions rapides</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gestion utilisateurs */}
              <Button 
                className="h-20 flex flex-col space-y-2" 
                onClick={() => router.push('/admin/users')}
                disabled={!userInfo?.capabilities.permissions.includes('Gestion utilisateurs')}
              >
                <Users className="w-6 h-6" />
                <span>Gérer les utilisateurs</span>
              </Button>

              {/* Modération */}
              <Button 
                variant="outline" 
                className="h-20 flex flex-col space-y-2" 
                onClick={() => router.push('/admin/moderation')}
                disabled={!userInfo?.capabilities.permissions.includes('Modération contenu')}
              >
                <Shield className="w-6 h-6" />
                <span>Modération</span>
              </Button>

              {/* Analytics */}
              <Button 
                variant="outline" 
                className="h-20 flex flex-col space-y-2" 
                onClick={() => router.push('/admin/analytics')}
                disabled={!userInfo?.capabilities.permissions.includes('Accès analyses')}
              >
                <TrendingUp className="w-6 h-6" />
                <span>Analyses</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Informations système */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="w-5 h-5" />
                <span>État du système</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Serveur</span>
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    En ligne
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Base de données</span>
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    Connectée
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">WebSocket</span>
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    Actif
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Dernière mise à jour</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                {dashboardData?.timestamp && (
                  <div>
                    Données mises à jour le {' '}
                    {new Date(dashboardData.timestamp).toLocaleString('fr-FR')}
                  </div>
                )}
                <div className="mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.refresh()}
                  >
                    Actualiser les données
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
