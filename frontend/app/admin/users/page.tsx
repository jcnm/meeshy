'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, ArrowLeft, UserPlus, Search, Filter, ChevronLeft, ChevronRight, Eye, Ghost } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import type { User } from '@/services/admin.service';
import { toast } from 'sonner';
import { TableSkeleton, StatCardSkeleton } from '@/components/admin/TableSkeleton';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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

  // Debounce pour la recherche - attend 800ms après la dernière frappe
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 800);

    return () => clearTimeout(timer);
  }, [search]);

  // Fonction de chargement des données - définie avant les useEffect qui l'utilisent
  const loadUsersData = useCallback(async (showLoader = true) => {
    try {
      console.log('[Admin Users] Appel API avec params:', {
        page: currentPage,
        size: pageSize,
        search: debouncedSearch,
        role: roleFilter,
        status: statusFilter
      });

      // Ne montrer le loader que lors du chargement initial ou sur demande
      if (showLoader) {
        setLoading(true);
      }
      const [dashboardResponse, usersResponse] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getUsers(currentPage, pageSize, debouncedSearch, roleFilter, statusFilter)
      ]);

      console.log('[Admin Users] Réponse API complète:', usersResponse);
      console.log('[Admin Users] usersResponse.data:', usersResponse.data);

      // Le backend retourne {success: true, data: {...}}, donc il faut accéder à .data.data
      const dashboardData = dashboardResponse.data?.data || dashboardResponse.data;
      const usersData = usersResponse.data?.data || usersResponse.data;

      console.log('[Admin Users] usersData extrait:', usersData);
      console.log('[Admin Users] usersData.users:', usersData?.users);
      console.log('[Admin Users] Nombre d\'utilisateurs:', usersData?.users?.length || 0);

      if (dashboardData) {
        setStats({
          totalUsers: dashboardData.statistics?.totalUsers || 0,
          activeUsers: dashboardData.statistics?.activeUsers || 0,
          newUsers: dashboardData.recentActivity?.newUsers || 0,
          adminUsers: dashboardData.statistics?.adminUsers || 0
        });
      }

      if (usersData) {
        console.log('[Admin Users] Mise à jour de users avec:', usersData.users || []);
        setUsers(usersData.users || []);
        const total = usersData.pagination?.total || 0;
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
        console.log('[Admin Users] Total pages calculé:', Math.max(1, Math.ceil(total / pageSize)));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateurs:', error);
      toast.error('Erreur lors du chargement des données');
      setUsers([]); // Reset to empty array on error
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [currentPage, pageSize, debouncedSearch, roleFilter, statusFilter]);

  // Charger les données uniquement quand nécessaire
  useEffect(() => {
    console.log('[Admin Users] Chargement avec filtres:', {
      currentPage,
      pageSize,
      debouncedSearch,
      roleFilter,
      statusFilter
    });
    loadUsersData(false); // Ne pas montrer le loader lors des filtres
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, roleFilter, statusFilter]);

  // Réinitialiser la page à 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  // Chargement initial avec loader
  useEffect(() => {
    loadUsersData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = () => {
    setCurrentPage(1);
    // Le useEffect se chargera du rechargement
  };

  const handlePageSizeChange = (newSize: number) => {
    console.log('[Admin Users] Changement de pageSize:', newSize);
    setPageSize(newSize);
    setCurrentPage(1);
    // Le useEffect se chargera du rechargement
  };

  const handlePreviousPage = () => {
    console.log('[Admin Users] Clic sur Précédent, page actuelle:', currentPage);
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    console.log('[Admin Users] Clic sur Suivant, page actuelle:', currentPage, 'total:', totalPages);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
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
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

      if (diffInSeconds < 60) return 'À l\'instant';
      if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)}min`;
      if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
      if (diffInSeconds < 2592000) return `Il y a ${Math.floor(diffInSeconds / 86400)}j`;

      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
              className="flex items-center space-x-2 text-sm"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour</span>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
              <p className="text-sm text-gray-600 hidden sm:block">Administration des comptes utilisateurs</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/anonymous-users')}
              className="flex items-center space-x-2 text-sm"
              size="sm"
            >
              <Ghost className="h-4 w-4" />
              <span className="hidden md:inline">Anonymes</span>
            </Button>
            <Button
              className="flex items-center space-x-2 text-sm"
              size="sm"
              onClick={() => router.push('/admin/users/new')}
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden md:inline">Nouvel utilisateur</span>
            </Button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.totalUsers}</div>
              <Badge variant="outline" className="mt-1 text-xs">Utilisateurs</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.activeUsers}</div>
              <Badge variant="outline" className="mt-1 text-xs text-green-600">
                {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Nouveaux</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.newUsers}</div>
              <Badge variant="outline" className="mt-1 text-xs">7 jours</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats.adminUsers}</div>
              <Badge variant="outline" className="mt-1 text-xs text-purple-600">
                {stats.totalUsers > 0 ? Math.round((stats.adminUsers / stats.totalUsers) * 100) : 0}%
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Liste des utilisateurs */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Utilisateurs ({users?.length || 0})</span>
            </CardTitle>

            {/* Filtres intégrés dans l'en-tête */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, email..."
                  className="pl-8 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFilter()}
                />
              </div>
              <select
                className="w-full p-2 border rounded-md text-sm bg-white"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">Tous les rôles</option>
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
                <option value="MODO">Modérateur</option>
                <option value="AUDIT">Auditeur</option>
                <option value="ANALYST">Analyste</option>
                <option value="BIGBOSS">Super Admin</option>
              </select>
              <select
                className="w-full p-2 border rounded-md text-sm bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
              <select
                className="w-full p-2 border rounded-md text-sm bg-white"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                title="Nombre d'éléments par page"
              >
                <option value="20">20 par page</option>
                <option value="50">50 par page</option>
                <option value="100">100 par page</option>
                <option value="200">200 par page</option>
                <option value="400">400 par page</option>
                <option value="500">500 par page</option>
                <option value="1000">1000 par page</option>
              </select>
              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={handleFilter}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtrer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Vue Desktop (hidden on mobile) */}
            <div className="hidden lg:block space-y-4">
              {/* En-tête du tableau */}
              <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 rounded-lg font-medium text-sm text-gray-700 sticky top-0 z-10">
                <div className="col-span-3">Utilisateur</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Rôle</div>
                <div className="col-span-1">Statut</div>
                <div className="col-span-2">Dernière activité</div>
                <div className="col-span-1">Actions</div>
              </div>

              {/* Lignes du tableau */}
              {users?.map((user) => (
                <div key={user.id} className="grid grid-cols-12 gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="col-span-3 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {user.displayName?.charAt(0) || user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{user.displayName || user.username}</div>
                      <div className="text-sm text-gray-500 truncate">@{user.username}</div>
                    </div>
                  </div>
                  <div className="col-span-3 text-sm text-gray-600 truncate flex items-center">
                    {user.email}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                      {getRoleLabel(user.role)}
                    </Badge>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-xs">
                      {user.isActive ? (
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                          Actif
                        </span>
                      ) : 'Inactif'}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-sm text-gray-600 flex items-center">
                    {formatDate(user.updatedAt || user.createdAt)}
                  </div>
                  <div className="col-span-1 flex items-center justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Vue Mobile/Tablet (visible only on mobile/tablet) */}
            <div className="lg:hidden space-y-3">
              {users?.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {user.displayName?.charAt(0) || user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-gray-900 truncate">{user.displayName || user.username}</h3>
                          <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-xs">
                            {user.isActive ? '✓' : '✗'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                        <p className="text-xs text-gray-500 truncate mt-1">{user.email}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                            {getRoleLabel(user.role)}
                          </Badge>
                          <span className="text-xs text-gray-500">{formatDate(user.updatedAt || user.createdAt)}</span>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Voir les détails
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Message si aucun utilisateur */}
            {(!users || users.length === 0) && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun utilisateur trouvé</h3>
                <p className="text-gray-500">Essayez de modifier vos filtres de recherche</p>
              </div>
            )}

            {/* Pagination */}
            {users && users.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                <div className="text-xs sm:text-sm text-gray-600">
                  Page {currentPage} sur {totalPages} • {users.length} utilisateurs affichés
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={handlePreviousPage}
                    className="text-xs sm:text-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Précédent</span>
                  </Button>
                  <div className="flex items-center px-3 py-2 border rounded-md text-xs sm:text-sm font-medium">
                    {currentPage} / {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={handleNextPage}
                    className="text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline mr-1">Suivant</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
}
