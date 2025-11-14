'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  UserCheck,
  Activity,
  TrendingUp,
  MessageSquare,
  Globe,
  Link2,
  Flag,
  UserPlus,
  RefreshCw,
  ArrowRight,
  Clock
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';
import { authManager } from '@/services/auth-manager.service';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { getDefaultPermissions } from '@/utils/user-adapter';
import { StatsGrid, StatItem } from '@/components/admin/charts';
import { TimeSeriesChart } from '@/components/admin/charts/TimeSeriesChart';
import { DonutChart } from '@/components/admin/charts/DistributionChart';
import { HeatmapChart } from '@/components/admin/charts/HeatmapChart';
import { format, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalConversations: number;
  totalCommunities: number;
  totalMessages: number;
  adminUsers: number;
  totalAnonymousUsers: number;
  activeAnonymousUsers: number;
  inactiveAnonymousUsers: number;
  totalShareLinks: number;
  activeShareLinks: number;
  totalTranslations?: number;
  totalReports?: number;
  totalInvitations?: number;
  topLanguages?: Array<{ language: string; count: number }>;
  usersByRole: Record<string, number>;
  messagesByType: Record<string, number>;
}

interface DashboardData {
  statistics: AdminStats;
  recentActivity: {
    newUsers: number;
    newConversations: number;
    newMessages: number;
    newAnonymousUsers: number;
  };
  userInfo?: {
    id: string;
    username: string;
    role: string;
    [key: string]: any;
  };
  userPermissions: any;
  timestamp: string;
}

const AdminDashboard: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAdminStats = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);

      const response = await adminService.getDashboardStats();
      if (response.data && (response.data as any).success && (response.data as any).data) {
        const dashData = (response.data as any).data;
        setDashboardData(dashData);
      } else if (response.data) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques admin:', error);
      toast.error('Erreur lors du chargement des statistiques d\'administration');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadUserAndData = async () => {
      try {
        setLoading(true);
        const token = authManager.getAuthToken();
        if (!token) {
          router.push('/login');
          return;
        }

        const userResponse = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userResponse.ok) {
          authManager.clearAllSessions();
          router.push('/login');
          return;
        }

        const response = await userResponse.json();
        let userData;
        if (response.success && response.data?.user) {
          userData = response.data.user;
        } else if (response.user) {
          userData = response.user;
        } else {
          userData = response;
        }

        setUser(userData);

        if (!userData.permissions) {
          userData.permissions = getDefaultPermissions(userData.role);
        }

        const hasAdminAccess = userData.permissions?.canAccessAdmin || false;
        if (!hasAdminAccess) {
          router.push('/dashboard');
          toast.error('Accès non autorisé à l\'administration');
          return;
        }

        await loadAdminStats();
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

  if (!user || loading) {
    return (
      <AdminLayout currentPage="/admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-muted-foreground">Chargement du dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const stats = dashboardData?.statistics;

  // Générer des données de séries temporelles (mock pour l'exemple)
  const generateTimeSeriesData = () => {
    const data = [];
    for (let i = 13; i >= 0; i--) {
      const date = subDays(new Date(), i);
      data.push({
        date,
        users: Math.floor(Math.random() * 50) + (stats?.totalUsers || 0) - 100,
        messages: Math.floor(Math.random() * 200) + 100,
        anonymes: Math.floor(Math.random() * 30) + 10,
      });
    }
    return data;
  };

  // Données de répartition par rôle
  const roleDistributionData = stats?.usersByRole
    ? Object.entries(stats.usersByRole).map(([role, count]) => ({
        name: role,
        value: count as number,
      }))
    : [];

  // Données heatmap d'activité (mock)
  const generateHeatmapData = (): Array<{ x: string; y: string; value: number }> => {
    const data: Array<{ x: string; y: string; value: number }> = [];
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const hours = ['0h', '4h', '8h', '12h', '16h', '20h'];

    days.forEach(day => {
      hours.forEach(hour => {
        data.push({
          x: hour,
          y: day,
          value: Math.floor(Math.random() * 100),
        });
      });
    });
    return data;
  };

  // Statistiques principales
  const mainStats: StatItem[] = [
    {
      title: 'Utilisateurs totaux',
      value: stats?.totalUsers || 0,
      icon: Users,
      iconClassName: 'text-blue-600',
      trend: {
        value: 12,
        label: 'vs mois dernier',
      },
      description: `${stats?.activeUsers || 0} actifs`,
    },
    {
      title: 'Utilisateurs anonymes',
      value: stats?.totalAnonymousUsers || 0,
      icon: UserCheck,
      iconClassName: 'text-indigo-600',
      trend: {
        value: 8,
        label: 'vs semaine dernière',
      },
      description: `${stats?.activeAnonymousUsers || 0} actifs`,
    },
    {
      title: 'Messages envoyés',
      value: stats?.totalMessages || 0,
      icon: MessageSquare,
      iconClassName: 'text-green-600',
      trend: {
        value: 24,
        label: 'vs hier',
      },
      description: 'Total plateforme',
    },
    {
      title: 'Communautés',
      value: stats?.totalCommunities || 0,
      icon: Users,
      iconClassName: 'text-orange-600',
      trend: {
        value: 5,
        label: 'cette semaine',
      },
      description: 'Communautés créées',
    },
    {
      title: 'Traductions',
      value: stats?.totalTranslations || 0,
      icon: Globe,
      iconClassName: 'text-cyan-600',
      description: 'Messages traduits',
    },
    {
      title: 'Liens partagés',
      value: stats?.totalShareLinks || 0,
      icon: Link2,
      iconClassName: 'text-purple-600',
      description: `${stats?.activeShareLinks || 0} actifs`,
    },
    {
      title: 'Signalements',
      value: stats?.totalReports || 0,
      icon: Flag,
      iconClassName: 'text-red-600',
      description: 'À traiter',
    },
    {
      title: 'Invitations',
      value: stats?.totalInvitations || 0,
      icon: UserPlus,
      iconClassName: 'text-yellow-600',
      description: 'En attente',
    },
  ];

  return (
    <AdminLayout currentPage="/admin">
      <div className="space-y-6">
        {/* Header avec actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Dashboard Administration
            </h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de la plateforme Meeshy
            </p>
          </div>
          <Button
            onClick={() => loadAdminStats(false)}
            disabled={refreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* KPIs Principaux */}
        <StatsGrid stats={mainStats} columns={4} />

        {/* Graphiques temporels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart
            data={generateTimeSeriesData()}
            title="Évolution des utilisateurs (14 derniers jours)"
            dataKeys={[
              { key: 'users', label: 'Utilisateurs', color: '#3b82f6' },
              { key: 'anonymes', label: 'Anonymes', color: '#8b5cf6' },
            ]}
            type="area"
            height={300}
          />

          <TimeSeriesChart
            data={generateTimeSeriesData()}
            title="Messages quotidiens (14 derniers jours)"
            dataKeys={[
              { key: 'messages', label: 'Messages', color: '#10b981' },
            ]}
            type="bar"
            height={300}
          />
        </div>

        {/* Distributions et heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {roleDistributionData.length > 0 && (
            <DonutChart
              data={roleDistributionData}
              title="Répartition des utilisateurs par rôle"
              height={300}
              colors={['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444']}
            />
          )}

          <HeatmapChart
            data={generateHeatmapData()}
            title="Activité par jour et heure"
            xLabel="Heures"
            yLabel="Jours"
            colorScale={{
              low: '#dbeafe',
              medium: '#3b82f6',
              high: '#1e3a8a',
            }}
          />
        </div>

        {/* Activité récente et langues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activité récente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Activité récente (7 derniers jours)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Nouveaux utilisateurs</p>
                    <p className="text-xs text-muted-foreground">Inscriptions récentes</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {dashboardData?.recentActivity?.newUsers || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Nouveaux messages</p>
                    <p className="text-xs text-muted-foreground">Messages envoyés</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {dashboardData?.recentActivity?.newMessages || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <UserCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Utilisateurs anonymes</p>
                    <p className="text-xs text-muted-foreground">Nouveaux visiteurs</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-purple-600">
                  {dashboardData?.recentActivity?.newAnonymousUsers || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Top langues */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-600" />
                Top 5 Langues utilisées
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.topLanguages && stats.topLanguages.length > 0 ? (
                <div className="space-y-3">
                  {stats.topLanguages.slice(0, 5).map((lang, index) => {
                    const total = stats.topLanguages?.reduce((sum, l) => sum + l.count, 0) || 1;
                    const percentage = ((lang.count / total) * 100).toFixed(1);

                    return (
                      <div key={lang.language} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-muted-foreground">
                              #{index + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {lang.language.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold">
                              {lang.count.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({percentage}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucune donnée de langue disponible
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Accès rapides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { label: 'Utilisateurs', icon: Users, href: '/admin/users', color: 'blue' },
                { label: 'Anonymes', icon: UserCheck, href: '/admin/anonymous-users', color: 'indigo' },
                { label: 'Messages', icon: MessageSquare, href: '/admin/messages', color: 'green' },
                { label: 'Communautés', icon: Users, href: '/admin/communities', color: 'orange' },
                { label: 'Traductions', icon: Globe, href: '/admin/translations', color: 'cyan' },
                { label: 'Liens', icon: Link2, href: '/admin/share-links', color: 'purple' },
                { label: 'Signalements', icon: Flag, href: '/admin/reports', color: 'red' },
                { label: 'Analytics', icon: TrendingUp, href: '/admin/analytics', color: 'pink' },
              ].map((item) => (
                <Button
                  key={item.href}
                  variant="outline"
                  className="h-20 flex flex-col gap-2 hover:scale-105 transition-transform"
                  onClick={() => router.push(item.href)}
                >
                  <item.icon className={`h-6 w-6 text-${item.color}-600`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer avec timestamp */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  Dernière mise à jour:{' '}
                  {dashboardData?.timestamp
                    ? format(new Date(dashboardData.timestamp), 'PPpp', { locale: fr })
                    : 'N/A'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => loadAdminStats(false)}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
