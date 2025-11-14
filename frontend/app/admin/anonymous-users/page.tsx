'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Search,
  Users,
  UserCheck,
  UserX,
  Globe,
  MessageSquare,
  Calendar,
  MapPin,
  Eye,
  Shield,
  Clock,
  Link2,
  Activity,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { adminService, AnonymousUser } from '@/services/admin.service';
import { StatsGrid, StatItem } from '@/components/admin/charts';
import { TimeSeriesChart } from '@/components/admin/charts/TimeSeriesChart';
import { DonutChart } from '@/components/admin/charts/DistributionChart';
import { SensitiveText } from '@/components/admin/privacy/SensitiveText';
import { TableSkeleton, StatCardSkeleton } from '@/components/admin/TableSkeleton';
import { subDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminAnonymousUsersPage() {
  const router = useRouter();
  const [anonymousUsers, setAnonymousUsers] = useState<AnonymousUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AnonymousUser | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [pageSize, setPageSize] = useState(20);

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 800);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadAnonymousUsers = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);

      const response = await adminService.getAnonymousUsers(
        currentPage,
        pageSize,
        debouncedSearch || undefined,
        statusFilter || undefined
      );

      if (response.data) {
        setAnonymousUsers(response.data.anonymousUsers || []);
        setTotalPages(Math.ceil((response.data.pagination?.total || 0) / pageSize));
        setTotalCount(response.data.pagination?.total || 0);
        setHasMore(response.data.pagination?.hasMore || false);
      } else {
        setAnonymousUsers([]);
        setTotalPages(1);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs anonymes:', error);
      toast.error('Erreur lors du chargement des utilisateurs anonymes');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter]);

  // Réinitialiser la page à 1 quand les filtres changent
  useEffect(() => {
    if (!isInitialLoad) {
      setCurrentPage(1);
    }
  }, [debouncedSearch, statusFilter, isInitialLoad]);

  // Charger les données
  useEffect(() => {
    loadAnonymousUsers(isInitialLoad);
  }, [currentPage, pageSize, debouncedSearch, statusFilter, isInitialLoad, loadAnonymousUsers]);

  // Calcul des statistiques
  const stats = {
    total: totalCount,
    active: anonymousUsers?.filter(u => u.isActive && u.isOnline).length || 0,
    totalMessages: anonymousUsers?.reduce((sum, u) => sum + u._count.sentMessages, 0) || 0,
    avgMessagesPerUser: totalCount > 0
      ? Math.round((anonymousUsers?.reduce((sum, u) => sum + u._count.sentMessages, 0) || 0) / totalCount)
      : 0
  };

  const formatDate = (date: Date | string) => {
    try {
      const d = new Date(date);
      return format(d, 'dd MMM yyyy à HH:mm', { locale: fr });
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

  const getStatusBadge = (isActive: boolean, isOnline: boolean) => {
    if (isActive && isOnline) {
      return <Badge className="bg-green-500 hover:bg-green-600"><Activity className="h-3 w-3 mr-1" />En ligne</Badge>;
    } else if (isActive && !isOnline) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Hors ligne</Badge>;
    } else {
      return <Badge variant="destructive"><UserX className="h-3 w-3 mr-1" />Désactivé</Badge>;
    }
  };

  // Générer données temporelles (mock - à remplacer par vraies données)
  const generateTimeSeriesData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      data.push({
        date,
        users: Math.floor(Math.random() * 10) + (stats.total || 50) - 30,
        messages: Math.floor(Math.random() * 50) + 20,
        online: Math.floor(Math.random() * 5) + (stats.active || 10) - 5,
      });
    }
    return data;
  };

  // Distribution par langue
  const getLanguageDistribution = () => {
    const distribution: Record<string, number> = {};
    anonymousUsers.forEach(user => {
      const lang = user.language || 'Unknown';
      distribution[lang] = (distribution[lang] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  };

  // Distribution par pays
  const getCountryDistribution = () => {
    const distribution: Record<string, number> = {};
    anonymousUsers.forEach(user => {
      const country = user.country || 'Unknown';
      distribution[country] = (distribution[country] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  // Statistiques avancées
  const advancedStats: StatItem[] = [
    {
      title: 'Utilisateurs anonymes',
      value: stats.total,
      icon: Users,
      iconClassName: 'text-blue-600',
      trend: { value: 8, label: 'vs mois dernier' },
      description: 'Total des comptes',
    },
    {
      title: 'En ligne actuellement',
      value: stats.active,
      icon: UserCheck,
      iconClassName: 'text-green-600',
      trend: { value: 15, label: 'vs hier' },
      description: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% du total`,
    },
    {
      title: 'Messages totaux',
      value: stats.totalMessages,
      icon: MessageSquare,
      iconClassName: 'text-purple-600',
      trend: { value: 22, label: 'vs semaine dernière' },
      description: 'Tous les messages',
    },
    {
      title: 'Moyenne messages/user',
      value: stats.avgMessagesPerUser,
      icon: TrendingUp,
      iconClassName: 'text-orange-600',
      description: 'Engagement moyen',
    },
  ];

  if (isInitialLoad) {
    return (
      <AdminLayout currentPage="/admin/anonymous-users">
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
          </div>
          <TableSkeleton rows={10} columns={5} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/anonymous-users">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/admin')} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Utilisateurs anonymes
              </h1>
              <p className="text-muted-foreground mt-1">
                Gestion des participants via liens de partage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/users')} size="sm">
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Utilisateurs</span>
            </Button>
            <Button onClick={() => loadAnonymousUsers(false)} disabled={refreshing} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <StatsGrid stats={advancedStats} columns={4} />

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart
            data={generateTimeSeriesData()}
            title="Évolution (30 derniers jours)"
            dataKeys={[
              { key: 'users', label: 'Utilisateurs anonymes', color: '#3b82f6' },
              { key: 'messages', label: 'Messages envoyés', color: '#8b5cf6' },
              { key: 'online', label: 'En ligne', color: '#10b981' },
            ]}
            type="area"
            height={300}
          />

          {anonymousUsers.length > 0 && (
            <DonutChart
              data={getLanguageDistribution()}
              title="Répartition par langue"
              height={300}
              colors={['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6b7280']}
            />
          )}
        </div>

        {/* Distribution par pays (Top 10) */}
        {anonymousUsers.length > 0 && getCountryDistribution().length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span>Top 10 pays</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getCountryDistribution().map((country, index) => {
                  const maxValue = getCountryDistribution()[0]?.value || 1;
                  const percentage = (country.value / maxValue) * 100;

                  return (
                    <div key={country.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-bold w-6 text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="font-medium">{country.name}</span>
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {country.value}
                        </span>
                      </div>
                      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liste des utilisateurs */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>Utilisateurs anonymes ({anonymousUsers?.length || 0})</span>
              </CardTitle>
            </div>

            {/* Filtres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="active">En ligne</option>
                <option value="inactive">Hors ligne</option>
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
              <TableSkeleton rows={10} columns={5} />
            ) : !anonymousUsers || anonymousUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun utilisateur anonyme trouvé</p>
              </div>
            ) : (
              <>
                {/* Cartes des utilisateurs */}
                <div className="space-y-4">
                  {anonymousUsers.map((user) => (
                    <Card key={user.id} className="hover:border-primary/50 hover:shadow-lg transition-all duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                              {user.firstName?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-semibold text-base">
                                  <SensitiveText fallback="••••••">
                                    {user.firstName} {user.lastName}
                                  </SensitiveText>
                                </h3>
                                <span className="text-sm text-muted-foreground">@{user.username}</span>
                                {getStatusBadge(user.isActive, user.isOnline)}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {user.email && (
                                  <span className="flex items-center gap-1">
                                    <SensitiveText fallback="••••@••••.••">
                                      {user.email}
                                    </SensitiveText>
                                  </span>
                                )}
                                {user.country && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>{user.country}</span>
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  <span>{user.language}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  <span>{user._count.sentMessages} messages</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDetailsModal(true);
                            }}
                            className="flex-shrink-0"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Détails</span>
                          </Button>
                        </div>

                        {/* Informations complémentaires */}
                        <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Conversation:</span>
                            <span className="font-medium truncate">
                              {user.shareLink.conversation.title || user.shareLink.conversation.identifier || 'Sans titre'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Rejoint:</span>
                            <span>{formatRelativeDate(user.joinedAt)}</span>
                          </div>
                        </div>

                        {/* Permissions */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Permissions:</span>
                          {user.canSendMessages && <Badge variant="outline" className="text-xs">Messages</Badge>}
                          {user.canSendFiles && <Badge variant="outline" className="text-xs">Fichiers</Badge>}
                          {user.canSendImages && <Badge variant="outline" className="text-xs">Images</Badge>}
                          {user.canViewHistory && <Badge variant="outline" className="text-xs">Historique</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages} ({totalCount} utilisateurs au total)
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
                      disabled={currentPage === totalPages || !hasMore}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Modal de détails */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>Détails de l'utilisateur anonyme</span>
              </DialogTitle>
            </DialogHeader>

            {selectedUser && (
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Informations générales */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Informations générales</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Nom complet</p>
                          <p className="text-sm font-semibold">
                            <SensitiveText fallback="•••••• ••••••">
                              {selectedUser.firstName} {selectedUser.lastName}
                            </SensitiveText>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Nom d'utilisateur</p>
                          <p className="text-sm font-semibold">@{selectedUser.username}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Email</p>
                          <p className="text-sm">
                            <SensitiveText fallback="••••@••••.••">
                              {selectedUser.email || 'Non renseigné'}
                            </SensitiveText>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Statut</p>
                          <div>{getStatusBadge(selectedUser.isActive, selectedUser.isOnline)}</div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Pays</p>
                          <p className="text-sm flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{selectedUser.country || 'Non renseigné'}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Langue</p>
                          <p className="text-sm flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span>{selectedUser.language}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Date d'inscription</p>
                          <p className="text-sm flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(selectedUser.joinedAt)}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Dernière activité</p>
                          <p className="text-sm flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{selectedUser.lastActivity ? formatDate(selectedUser.lastActivity) : 'Jamais'}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Permissions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Permissions et droits</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium">Envoi de messages</span>
                          <Badge variant={selectedUser.canSendMessages ? "default" : "secondary"}>
                            {selectedUser.canSendMessages ? 'Autorisé' : 'Refusé'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium">Envoi de fichiers</span>
                          <Badge variant={selectedUser.canSendFiles ? "default" : "secondary"}>
                            {selectedUser.canSendFiles ? 'Autorisé' : 'Refusé'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium">Envoi d'images</span>
                          <Badge variant={selectedUser.canSendImages ? "default" : "secondary"}>
                            {selectedUser.canSendImages ? 'Autorisé' : 'Refusé'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium">Voir l'historique</span>
                          <Badge variant={selectedUser.canViewHistory ? "default" : "secondary"}>
                            {selectedUser.canViewHistory ? 'Autorisé' : 'Refusé'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Statistiques des messages */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>Statistiques des messages</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedUser._count.sentMessages}</p>
                          <p className="text-sm text-muted-foreground">Messages envoyés</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {selectedUser._count.reactions || 0}
                          </p>
                          <p className="text-sm text-muted-foreground">Réactions</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {Math.round((selectedUser._count.sentMessages / Math.max(1, Math.ceil((new Date().getTime() - new Date(selectedUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24)))) * 10) / 10}
                          </p>
                          <p className="text-sm text-muted-foreground">Messages/jour</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lien de partage et conversation */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        <span>Lien de partage et conversation</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Lien utilisé</p>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{selectedUser.shareLink.name || 'Sans nom'}</p>
                            <p className="text-sm text-muted-foreground">
                              ID: {selectedUser.shareLink.identifier || selectedUser.shareLink.linkId}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {selectedUser.shareLink.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Conversation rejointe</p>
                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">
                              {selectedUser.shareLink.conversation.title ||
                               selectedUser.shareLink.conversation.identifier ||
                               'Sans titre'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Type: {selectedUser.shareLink.conversation.type}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              router.push(`/conversations/${selectedUser.shareLink.conversationId}`);
                              setShowDetailsModal(false);
                            }}
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Ouvrir</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions admin */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Actions administrateur</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            router.push(`/conversations/${selectedUser.shareLink.conversationId}`);
                            setShowDetailsModal(false);
                          }}
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Accéder à la conversation</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
