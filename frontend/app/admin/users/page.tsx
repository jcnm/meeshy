'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users, ArrowLeft, UserPlus, Search, ChevronLeft, ChevronRight,
  Eye, Ghost, Crown, Shield, User as UserIcon, Activity, TrendingUp,
  Clock, Mail, Calendar, RefreshCw, Trophy, Award, Medal, Target,
  MessageSquare, MessageCircle, Heart, AtSign
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import type { User } from '@/services/admin.service';
import { toast } from 'sonner';
import { TableSkeleton, StatCardSkeleton } from '@/components/admin/TableSkeleton';
import { StatsGrid, StatItem } from '@/components/admin/charts';
import { TimeSeriesChart } from '@/components/admin/charts/TimeSeriesChart';
import { DonutChart } from '@/components/admin/charts/DistributionChart';
import { SensitiveText } from '@/components/admin/privacy/SensitiveText';
import { subDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newUsers: 0,
    adminUsers: 0
  });

  // Filtres et pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filtres de classement
  const [rankingPeriod, setRankingPeriod] = useState<'week' | 'month' | 'quarter' | 'semester' | 'year'>('week');
  const [rankingMetric, setRankingMetric] = useState<'messages' | 'conversations' | 'reactionsGiven' | 'reactionsReceived' | 'mentions'>('messages');

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 800);
    return () => clearTimeout(timer);
  }, [search]);

  // Fonction de chargement des données
  const loadUsersData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);

      const [dashboardResponse, usersResponse] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getUsers(currentPage, pageSize, debouncedSearch, roleFilter, statusFilter)
      ]);

      const dashboardData = dashboardResponse.data?.data || dashboardResponse.data;
      const usersData = usersResponse.data?.data || usersResponse.data;

      if (dashboardData) {
        setStats({
          totalUsers: dashboardData.statistics?.totalUsers || 0,
          activeUsers: dashboardData.statistics?.activeUsers || 0,
          newUsers: dashboardData.recentActivity?.newUsers || 0,
          adminUsers: dashboardData.statistics?.adminUsers || 0
        });
      }

      if (usersData) {
        setUsers(usersData.users || []);
        const total = usersData.pagination?.total || 0;
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateurs:', error);
      toast.error('Erreur lors du chargement des données');
      setUsers([]);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, debouncedSearch, roleFilter, statusFilter]);

  // Réinitialiser la page à 1 quand les filtres changent
  useEffect(() => {
    if (!isInitialLoad) {
      setCurrentPage(1);
    }
  }, [debouncedSearch, roleFilter, statusFilter, isInitialLoad]);

  // Charger les données
  useEffect(() => {
    loadUsersData(isInitialLoad);
  }, [currentPage, pageSize, debouncedSearch, roleFilter, statusFilter, isInitialLoad, loadUsersData]);

  // Générer des données temporelles (mock - à remplacer par de vraies données)
  const generateUserGrowthData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      data.push({
        date,
        users: Math.floor(Math.random() * 20) + (stats.totalUsers || 100) - 50,
        active: Math.floor(Math.random() * 15) + (stats.activeUsers || 80) - 40,
      });
    }
    return data;
  };

  // Distribution par rôle
  const getRoleDistribution = () => {
    const distribution: Record<string, number> = {};
    users.forEach(user => {
      const role = getRoleLabel(user.role);
      distribution[role] = (distribution[role] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'BIGBOSS': 'destructive',
      'ADMIN': 'default',
      'MODO': 'secondary',
      'AUDIT': 'outline',
      'ANALYST': 'outline',
      'USER': 'secondary'
    };
    return variants[role] || 'secondary';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'BIGBOSS': 'Super Admin',
      'ADMIN': 'Administrateur',
      'MODO': 'Modérateur',
      'MODERATOR': 'Modérateur',
      'AUDIT': 'Auditeur',
      'ANALYST': 'Analyste',
      'USER': 'Utilisateur',
      'MEMBER': 'Utilisateur',
      'CREATOR': 'Créateur'
    };
    return labels[role] || role;
  };

  const formatDate = (date: Date | string) => {
    try {
      const d = new Date(date);
      return format(d, 'dd MMM yyyy', { locale: fr });
    } catch {
      return 'N/A';
    }
  };

  const formatRelativeDate = (date: Date | string) => {
    try {
      const d = new Date(date);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

      if (diffInSeconds < 60) return 'À l\'instant';
      if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)}min`;
      if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
      if (diffInSeconds < 2592000) return `Il y a ${Math.floor(diffInSeconds / 86400)}j`;

      return formatDate(d);
    } catch {
      return 'N/A';
    }
  };

  // Fonctions pour le classement
  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      'week': 'Cette semaine',
      'month': 'Ce mois',
      'quarter': 'Ce trimestre',
      'semester': 'Ce semestre',
      'year': 'Cette année'
    };
    return labels[period] || period;
  };

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      'messages': 'Messages envoyés',
      'conversations': 'Conversations créées',
      'reactionsGiven': 'Réactions données',
      'reactionsReceived': 'Réactions reçues',
      'mentions': 'Mentions'
    };
    return labels[metric] || metric;
  };

  const getMetricIcon = (metric: string) => {
    const icons: Record<string, any> = {
      'messages': MessageSquare,
      'conversations': MessageCircle,
      'reactionsGiven': Heart,
      'reactionsReceived': Heart,
      'mentions': AtSign
    };
    return icons[metric] || Target;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return Trophy;
    if (rank === 2) return Award;
    if (rank === 3) return Medal;
    return null;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-600';
    return 'text-muted-foreground';
  };

  // Générer des données de classement (mock - à remplacer par de vraies données)
  const generateRankingData = () => {
    const names = [
      'Alice Martin', 'Bob Dubois', 'Charlie Lefèvre', 'Diana Moreau', 'Étienne Petit',
      'Fanny Girard', 'Gabriel Roux', 'Hélène Lambert', 'Igor Rousseau', 'Julie Simon',
      'Kevin Blanchard', 'Laura Mercier', 'Marc Fontaine', 'Nina Gauthier', 'Oscar Dupuis'
    ];

    const multipliers: Record<string, number> = {
      'week': 1,
      'month': 4,
      'quarter': 12,
      'semester': 24,
      'year': 48
    };

    const baseValues: Record<string, number> = {
      'messages': 50,
      'conversations': 5,
      'reactionsGiven': 30,
      'reactionsReceived': 25,
      'mentions': 10
    };

    const multiplier = multipliers[rankingPeriod];
    const baseValue = baseValues[rankingMetric];

    return names
      .map((name, index) => ({
        rank: index + 1,
        userId: `user-${index}`,
        name,
        value: Math.floor((baseValue * multiplier) * (1 - index * 0.12) + Math.random() * 20),
        trend: Math.random() > 0.5 ? Math.floor(Math.random() * 20) : -Math.floor(Math.random() * 15),
        role: index < 2 ? 'ADMIN' : index < 5 ? 'MODO' : 'USER'
      }))
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({ ...item, rank: index + 1 }))
      .slice(0, 15);
  };

  // Statistiques avancées
  const advancedStats: StatItem[] = [
    {
      title: 'Total utilisateurs',
      value: stats.totalUsers,
      icon: Users,
      iconClassName: 'text-blue-600',
      trend: { value: 12, label: 'vs mois dernier' },
      description: 'Comptes créés',
    },
    {
      title: 'Utilisateurs actifs',
      value: stats.activeUsers,
      icon: Activity,
      iconClassName: 'text-green-600',
      trend: { value: 8, label: 'vs semaine dernière' },
      description: `${stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% du total`,
    },
    {
      title: 'Nouveaux (7j)',
      value: stats.newUsers,
      icon: TrendingUp,
      iconClassName: 'text-purple-600',
      trend: { value: 24, label: 'vs 7 jours précédents' },
      description: 'Inscriptions récentes',
    },
    {
      title: 'Administrateurs',
      value: stats.adminUsers,
      icon: Crown,
      iconClassName: 'text-orange-600',
      description: `${stats.totalUsers > 0 ? Math.round((stats.adminUsers / stats.totalUsers) * 100) : 0}% du total`,
    },
  ];

  if (isInitialLoad) {
    return (
      <AdminLayout currentPage="/admin/users">
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
          </div>
          <TableSkeleton rows={10} columns={6} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/users">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/admin')} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Gestion des utilisateurs
              </h1>
              <p className="text-muted-foreground mt-1">
                Administration des comptes et permissions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/anonymous-users')} size="sm">
              <Ghost className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Anonymes</span>
            </Button>
            <Button onClick={() => loadUsersData(false)} disabled={refreshing} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
            <Button onClick={() => router.push('/admin/users/new')} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Nouvel utilisateur</span>
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <StatsGrid stats={advancedStats} columns={4} />

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart
            data={generateUserGrowthData()}
            title="Évolution des utilisateurs (30 derniers jours)"
            dataKeys={[
              { key: 'users', label: 'Total utilisateurs', color: '#3b82f6' },
              { key: 'active', label: 'Utilisateurs actifs', color: '#10b981' },
            ]}
            type="area"
            height={300}
          />

          {users.length > 0 && (
            <DonutChart
              data={getRoleDistribution()}
              title="Répartition par rôle"
              height={300}
              colors={['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6b7280']}
            />
          )}
        </div>

        {/* Classement des utilisateurs */}
        <Card className="border-2 border-purple-500/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6" />
                <span>Classement des utilisateurs</span>
              </CardTitle>

              {/* Filtres de classement */}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <select
                  className="px-3 py-2 border rounded-md text-sm bg-white text-gray-900 font-medium"
                  value={rankingPeriod}
                  onChange={(e) => setRankingPeriod(e.target.value as any)}
                >
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois</option>
                  <option value="quarter">Ce trimestre</option>
                  <option value="semester">Ce semestre</option>
                  <option value="year">Cette année</option>
                </select>
                <select
                  className="px-3 py-2 border rounded-md text-sm bg-white text-gray-900 font-medium"
                  value={rankingMetric}
                  onChange={(e) => setRankingMetric(e.target.value as any)}
                >
                  <option value="messages">Messages envoyés</option>
                  <option value="conversations">Conversations créées</option>
                  <option value="reactionsGiven">Réactions données</option>
                  <option value="reactionsReceived">Réactions reçues</option>
                  <option value="mentions">Mentions</option>
                </select>
              </div>
            </div>
            <p className="text-purple-100 text-sm mt-2">
              Classement basé sur {getMetricLabel(rankingMetric).toLowerCase()} - {getPeriodLabel(rankingPeriod)}
            </p>
          </CardHeader>

          <CardContent className="p-6">
            {/* Graphique de classement */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                {React.createElement(getMetricIcon(rankingMetric), { className: 'h-4 w-4' })}
                Top 15 - {getMetricLabel(rankingMetric)}
              </h4>
              <div className="space-y-3">
                {generateRankingData().slice(0, 10).map((item) => {
                  const maxValue = generateRankingData()[0]?.value || 1;
                  const percentage = (item.value / maxValue) * 100;
                  const RankIcon = getRankIcon(item.rank);

                  return (
                    <div key={item.userId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`font-bold w-6 text-right flex-shrink-0 ${getRankColor(item.rank)}`}>
                            {item.rank}
                          </span>
                          {RankIcon && <RankIcon className={`h-4 w-4 flex-shrink-0 ${getRankColor(item.rank)}`} />}
                          <span className="font-medium truncate">
                            <SensitiveText fallback="••••••">
                              {item.name}
                            </SensitiveText>
                          </span>
                          <Badge variant={getRoleBadgeVariant(item.role)} className="text-xs flex-shrink-0">
                            {getRoleLabel(item.role)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-bold text-purple-600 dark:text-purple-400">
                            {item.value.toLocaleString()}
                          </span>
                          {item.trend !== 0 && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${item.trend > 0 ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}`}
                            >
                              {item.trend > 0 ? '+' : ''}{item.trend}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table détaillée du classement */}
            <div className="border-t pt-6">
              <h4 className="text-sm font-semibold text-muted-foreground mb-4">
                Classement complet
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold w-16">Rang</th>
                      <th className="text-left p-3 text-sm font-semibold">Utilisateur</th>
                      <th className="text-left p-3 text-sm font-semibold">Rôle</th>
                      <th className="text-right p-3 text-sm font-semibold">{getMetricLabel(rankingMetric)}</th>
                      <th className="text-center p-3 text-sm font-semibold">Tendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {generateRankingData().map((item) => {
                      const RankIcon = getRankIcon(item.rank);
                      return (
                        <tr key={item.userId} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className={`flex items-center justify-center gap-1 font-bold ${getRankColor(item.rank)}`}>
                              {RankIcon && <RankIcon className="h-4 w-4" />}
                              <span>{item.rank}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                {item.name[0]}
                              </div>
                              <span className="font-medium">
                                <SensitiveText fallback="••••••">
                                  {item.name}
                                </SensitiveText>
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={getRoleBadgeVariant(item.role)}>
                              {getRoleLabel(item.role)}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                              {item.value.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {item.trend !== 0 ? (
                              <Badge
                                variant="outline"
                                className={`${item.trend > 0 ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}`}
                              >
                                {item.trend > 0 ? (
                                  <TrendingUp className="h-3 w-3 mr-1 inline" />
                                ) : (
                                  <Activity className="h-3 w-3 mr-1 inline" />
                                )}
                                {item.trend > 0 ? '+' : ''}{item.trend}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des utilisateurs */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>Utilisateurs ({users?.length || 0})</span>
              </CardTitle>
            </div>

            {/* Filtres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">Tous les rôles</option>
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
                <option value="MODO">Modérateur</option>
                <option value="BIGBOSS">Super Admin</option>
              </select>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                value={pageSize}
                onChange={(e) => setCurrentPage(1) || setPageSize(Number(e.target.value))}
              >
                <option value="10">10 par page</option>
                <option value="20">20 par page</option>
                <option value="50">50 par page</option>
                <option value="100">100 par page</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <TableSkeleton rows={10} columns={6} />
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <>
                {/* Tableau responsive */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold">Utilisateur</th>
                        <th className="text-left p-3 text-sm font-semibold">Email</th>
                        <th className="text-left p-3 text-sm font-semibold">Rôle</th>
                        <th className="text-left p-3 text-sm font-semibold">Statut</th>
                        <th className="text-left p-3 text-sm font-semibold">Inscription</th>
                        <th className="text-center p-3 text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="font-medium">
                                  <SensitiveText fallback="••••••">
                                    {user.displayName || user.username || 'Anonyme'}
                                  </SensitiveText>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {user.username && `@${user.username}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <SensitiveText fallback="••••@••••.••">
                                {user.email || 'N/A'}
                              </SensitiveText>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {getRoleLabel(user.role)}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {user.isActive ? (
                              <Badge className="bg-green-500 hover:bg-green-600">
                                <Activity className="h-3 w-3 mr-1" />
                                Actif
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Inactif
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span className="hidden lg:inline">{formatDate(user.createdAt)}</span>
                              <span className="lg:hidden">{formatRelativeDate(user.createdAt)}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/admin/users/${user.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages} ({stats.totalUsers} utilisateurs au total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
