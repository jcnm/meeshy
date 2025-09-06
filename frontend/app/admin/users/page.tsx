'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowLeft, UserPlus, Search } from 'lucide-react';

// Désactiver le pré-rendu statique pour cette page client
export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  const router = useRouter();

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
          <Button className="flex items-center space-x-2">
            <UserPlus className="h-4 w-4" />
            <span>Nouvel utilisateur</span>
          </Button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total utilisateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <Badge variant="outline" className="mt-1">+12% ce mois</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Actifs aujourd&apos;hui</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">89</div>
              <Badge variant="outline" className="mt-1 text-green-600">En ligne</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Nouveaux</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <Badge variant="outline" className="mt-1">Cette semaine</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Administrateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">5</div>
              <Badge variant="outline" className="mt-1 text-purple-600">Admin</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Message de fonctionnalité en développement */}
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Gestion des utilisateurs
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Cette fonctionnalité est en cours de développement. Vous pourrez bientôt gérer tous les utilisateurs, leurs permissions et leurs accès depuis cette interface.
            </p>
            <div className="flex justify-center space-x-3">
              <Button variant="outline" onClick={() => router.push('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au tableau de bord
              </Button>
              <Button onClick={() => router.push('/search')}>
                <Search className="h-4 w-4 mr-2" />
                Rechercher des utilisateurs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
