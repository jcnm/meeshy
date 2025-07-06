'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ArrowLeft, BarChart3 } from 'lucide-react';

export default function AdminAnalyticsPage() {
  const router = useRouter();

  return (
    <AdminLayout currentPage="/admin/analytics">
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
              <h1 className="text-2xl font-bold text-gray-900">Analyses et statistiques</h1>
              <p className="text-gray-600">Tableau de bord analytique</p>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Messages quotidiens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">2,847</div>
              <Badge variant="outline" className="mt-1 text-green-600">+15% vs hier</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Utilisateurs actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">456</div>
              <Badge variant="outline" className="mt-1 text-green-600">+8% cette semaine</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Traductions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">1,234</div>
              <Badge variant="outline" className="mt-1 text-purple-600">Auto-traduites</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Temps moyen en ligne</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">2h 45m</div>
              <Badge variant="outline" className="mt-1">Par utilisateur</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Message de fonctionnalité en développement */}
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Analytics avancés
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Cette section contiendra des graphiques détaillés, des métriques d&apos;usage, et des analyses de performance pour optimiser l&apos;expérience utilisateur.
            </p>
            <div className="flex justify-center space-x-3">
              <Button variant="outline" onClick={() => router.push('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au tableau de bord
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Voir le dashboard utilisateur
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
