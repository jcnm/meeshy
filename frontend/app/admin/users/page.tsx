'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, ArrowLeft, UserPlus, Search } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { toast } from 'sonner';
export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newUsers: 0,
    adminUsers: 0
  });

  useEffect(() => {
    loadUsersData();
  }, []);

  const loadUsersData = async () => {
    try {
      setLoading(true);
      const [dashboardResponse, usersResponse] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getUsers(1, 20)
      ]);

      if (dashboardResponse.data) {
        setStats({
          totalUsers: dashboardResponse.data.statistics?.totalUsers || 0,
          activeUsers: dashboardResponse.data.statistics?.activeUsers || 0,
          newUsers: dashboardResponse.data.recentActivity?.newUsers || 0,
          adminUsers: dashboardResponse.data.statistics?.adminUsers || 0
        });
      }

      if (usersResponse.data) {
        setUsers(usersResponse.data.users);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateurs:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/users">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des utilisateurs...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/users">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
              <p className="text-gray-600">Administration des comptes utilisateurs</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/anonymous-users')}
              className="flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>Utilisateurs anonymes</span>
            </Button>
            <Button className="flex items-center space-x-2">
              <UserPlus className="h-4 w-4" />
              <span>Nouvel utilisateur</span>
            </Button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total utilisateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <Badge variant="outline" className="mt-1">Utilisateurs enregistrés</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Utilisateurs actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
              <Badge variant="outline" className="mt-1 text-green-600">
                {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% actifs
              </Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Nouveaux (7 jours)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.newUsers}</div>
              <Badge variant="outline" className="mt-1">Cette semaine</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Administrateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.adminUsers}</div>
              <Badge variant="outline" className="mt-1 text-purple-600">
                {stats.totalUsers > 0 ? Math.round((stats.adminUsers / stats.totalUsers) * 100) : 0}% du total
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Filtres et recherche */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5" />
              <span>Filtres et recherche</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Recherche</label>
                <Input
                  placeholder="Nom, email, username..."
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rôle</label>
                <select className="w-full p-2 border rounded-md">
                  <option value="">Tous les rôles</option>
                  <option value="USER">Utilisateur</option>
                  <option value="ADMIN">Administrateur</option>
                  <option value="MODO">Modérateur</option>
                  <option value="AUDIT">Auditeur</option>
                  <option value="ANALYST">Analyste</option>
                  <option value="BIGBOSS">Super Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
                <select className="w-full p-2 border rounded-md">
                  <option value="">Tous les statuts</option>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Actions</label>
                <Button variant="outline" className="w-full">
                  Filtrer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des utilisateurs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Utilisateurs ({stats.totalUsers})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* En-tête du tableau */}
              <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 rounded-lg font-medium text-sm text-gray-700">
                <div className="col-span-3">Utilisateur</div>
                <div className="col-span-2">Rôle</div>
                <div className="col-span-2">Statut</div>
                <div className="col-span-2">Dernière activité</div>
                <div className="col-span-2">Messages</div>
                <div className="col-span-1">Actions</div>
              </div>

              {/* Exemple d'utilisateurs */}
              {[
                {
                  id: '1',
                  username: 'admin_user',
                  displayName: 'Admin Principal',
                  email: 'admin@meeshy.com',
                  role: 'ADMIN',
                  isActive: true,
                  lastSeen: new Date().toISOString(),
                  messageCount: 1250
                },
                {
                  id: '2',
                  username: 'moderator_user',
                  displayName: 'Modérateur',
                  email: 'mod@meeshy.com',
                  role: 'MODO',
                  isActive: true,
                  lastSeen: new Date(Date.now() - 3600000).toISOString(),
                  messageCount: 890
                },
                {
                  id: '3',
                  username: 'regular_user',
                  displayName: 'Utilisateur Standard',
                  email: 'user@meeshy.com',
                  role: 'USER',
                  isActive: false,
                  lastSeen: new Date(Date.now() - 86400000).toISOString(),
                  messageCount: 45
                }
              ].map((user) => (
                <div key={user.id} className="grid grid-cols-12 gap-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="col-span-3 flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                      {user.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.displayName}</div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-sm text-gray-600">
                    {new Date(user.lastSeen).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="col-span-2 text-sm text-gray-600">
                    {user.messageCount.toLocaleString()}
                  </div>
                  <div className="col-span-1 flex space-x-1">
                    <Button variant="outline" size="sm">
                      Voir
                    </Button>
                    <Button variant="outline" size="sm">
                      Modifier
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Affichage de 1 à 3 sur {stats.totalUsers} utilisateurs
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" disabled>
                  Précédent
                </Button>
                <Button variant="outline" size="sm">
                  Suivant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
