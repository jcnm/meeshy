'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  ArrowLeft,
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  Users,
  MessageSquare,
  Activity,
  Globe,
  Target,
  Zap
} from 'lucide-react';
import { TimeSeriesChart } from '@/components/admin/charts/TimeSeriesChart';
import { DonutChart, DistributionChart } from '@/components/admin/charts/DistributionChart';
import { StatsGrid, StatItem } from '@/components/admin/charts';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';
import { subDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [dashboardData, setDashboardData] = useState<any>(null);

  const loadAnalytics = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);

      const response = await adminService.getDashboardStats();
      if (response.data && (response.data as any).success && (response.data as any).data) {
        setDashboardData((response.data as any).data);
      } else if (response.data) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des analytics:', error);
      toast.error('Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  // Génération des données temporelles détaillées
  const generateDetailedTimeSeries = (days: number) => {
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      data.push({
        date,
        users: Math.floor(Math.random() * 100) + 50,
        messages: Math.floor(Math.random() * 500) + 200,
        traductions: Math.floor(Math.random() * 300) + 100,
        anonymes: Math.floor(Math.random() * 50) + 20,
        communautes: Math.floor(Math.random() * 10) + 5,
      });
    }
    return data;
  };

  // Données de croissance
  const generateGrowthData = (): Array<{ date: string; utilisateurs: number; messagesParJour: number }> => {
    const data: Array<{ date: string; utilisateurs: number; messagesParJour: number }> = [];
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
    months.forEach((month, idx) => {
      data.push({
        date: month,
        utilisateurs: Math.floor(Math.random() * 200) + 100 + idx * 50,
        messagesParJour: Math.floor(Math.random() * 1000) + 500 + idx * 100,
      });
    });
    return data;
  };

  // Données d'engagement
  const generateEngagementData = () => [
    { name: 'Très actifs', value: 35 },
    { name: 'Actifs', value: 45 },
    { name: 'Occasionnels', value: 15 },
    { name: 'Inactifs', value: 5 },
  ];

  // Données de distribution géographique (mock)
  const generateGeoData = () => [
    { name: 'France', value: 45 },
    { name: 'Belgique', value: 20 },
    { name: 'Suisse', value: 15 },
    { name: 'Canada', value: 12 },
    { name: 'Autres', value: 8 },
  ];

  // Analytics avancés
  const stats = dashboardData?.statistics;
  const daysCount = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  // KPIs avancés
  const advancedStats: StatItem[] = [
    {
      title: 'DAU (Daily Active Users)',
      value: stats?.activeUsers || 0,
      icon: Users,
      iconClassName: 'text-blue-600',
      trend: { value: 15, label: 'vs hier' },
      description: 'Utilisateurs actifs quotidiens',
    },
    {
      title: 'Taux d\'engagement',
      value: stats?.totalUsers ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%` : '0%',
      icon: Activity,
      iconClassName: 'text-green-600',
      trend: { value: 8, label: 'vs semaine dernière' },
      description: 'Utilisateurs actifs / Total',
    },
    {
      title: 'Messages / Utilisateur',
      value: stats?.totalUsers ? (stats.totalMessages / stats.totalUsers).toFixed(1) : '0',
      icon: MessageSquare,
      iconClassName: 'text-purple-600',
      trend: { value: 12, label: 'vs mois dernier' },
      description: 'Moyenne par utilisateur',
    },
    {
      title: 'Taux de traduction',
      value: stats?.totalMessages
        ? `${(((stats.totalTranslations || 0) / stats.totalMessages) * 100).toFixed(1)}%`
        : '0%',
      icon: Globe,
      iconClassName: 'text-cyan-600',
      trend: { value: 5, label: 'en augmentation' },
      description: 'Messages traduits',
    },
    {
      title: 'Conversion Anonyme → Inscrit',
      value: '12.5%',
      icon: Target,
      iconClassName: 'text-orange-600',
      trend: { value: 3, label: 'vs période précédente' },
      description: 'Taux de conversion',
    },
    {
      title: 'Taux de rétention D7',
      value: '68%',
      icon: Zap,
      iconClassName: 'text-pink-600',
      trend: { value: 7, label: 'en amélioration' },
      description: 'Utilisateurs actifs à J+7',
    },
  ];

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/analytics">
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-muted-foreground">Chargement des analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/analytics">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Analytics Avancés
              </h1>
              <p className="text-muted-foreground mt-1">
                Métriques détaillées et analyses de performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sélecteur de période */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod(p)}
                  className="h-8 px-3"
                >
                  {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
                </Button>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => loadAnalytics(false)}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>

            <Button variant="default" size="sm">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* KPIs Avancés */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Métriques Clés</h2>
          <StatsGrid stats={advancedStats} columns={3} />
        </div>

        {/* Graphiques temporels principaux */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Évolution Temporelle</h2>

          <TimeSeriesChart
            data={generateDetailedTimeSeries(daysCount)}
            title={`Croissance des utilisateurs (${daysCount} derniers jours)`}
            dataKeys={[
              { key: 'users', label: 'Utilisateurs inscrits', color: '#3b82f6' },
              { key: 'anonymes', label: 'Utilisateurs anonymes', color: '#8b5cf6' },
            ]}
            type="area"
            height={350}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeSeriesChart
              data={generateDetailedTimeSeries(daysCount)}
              title="Volume de messages"
              dataKeys={[
                { key: 'messages', label: 'Messages', color: '#10b981' },
              ]}
              type="bar"
              height={300}
            />

            <TimeSeriesChart
              data={generateDetailedTimeSeries(daysCount)}
              title="Activité traduction"
              dataKeys={[
                { key: 'traductions', label: 'Traductions', color: '#06b6d4' },
              ]}
              type="line"
              height={300}
            />
          </div>

          <TimeSeriesChart
            data={generateDetailedTimeSeries(daysCount)}
            title="Croissance des communautés"
            dataKeys={[
              { key: 'communautes', label: 'Nouvelles communautés', color: '#f59e0b' },
            ]}
            type="area"
            height={300}
          />
        </div>

        {/* Analyses comparatives */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Analyses Comparatives (6 derniers mois)</h2>

          <TimeSeriesChart
            data={generateGrowthData()}
            title="Croissance mensuelle"
            dataKeys={[
              { key: 'utilisateurs', label: 'Nouveaux utilisateurs', color: '#3b82f6' },
              { key: 'messagesParJour', label: 'Messages par jour (moyenne)', color: '#10b981' },
            ]}
            type="line"
            height={350}
            dateFormat="MMM"
          />
        </div>

        {/* Distributions et segmentation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Segmentation & Distribution</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DonutChart
              data={generateEngagementData()}
              title="Niveau d'engagement utilisateurs"
              height={300}
              colors={['#10b981', '#3b82f6', '#f59e0b', '#ef4444']}
            />

            <DonutChart
              data={generateGeoData()}
              title="Distribution géographique"
              height={300}
              colors={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#6b7280']}
            />
          </div>
        </div>

        {/* Métriques détaillées */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Globale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Temps de réponse moyen</span>
                <Badge variant="outline" className="text-green-600">125ms</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <Badge variant="outline" className="text-green-600">99.9%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Erreurs</span>
                <Badge variant="outline" className="text-green-600">0.01%</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Sessions/jour (moyenne)</span>
                <Badge variant="outline">2.4</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Durée session (moyenne)</span>
                <Badge variant="outline">8m 32s</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Messages/session</span>
                <Badge variant="outline">12.5</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rétention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Rétention D1</span>
                <Badge variant="outline" className="text-green-600">85%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Rétention D7</span>
                <Badge variant="outline" className="text-blue-600">68%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Rétention D30</span>
                <Badge variant="outline" className="text-purple-600">52%</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer avec insights */}
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Insights & Recommandations</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ La croissance des utilisateurs est en hausse de 15% ce mois-ci</li>
                  <li>✓ Le taux d'engagement est excellent avec 68% de rétention à J+7</li>
                  <li>⚠️ Considérez d'optimiser les traductions pour augmenter le taux actuel de {stats?.totalMessages ? (((stats.totalTranslations || 0) / stats.totalMessages) * 100).toFixed(1) : 0}%</li>
                  <li>⚠️ Le taux de conversion anonyme → inscrit peut être amélioré (actuellement 12.5%)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
