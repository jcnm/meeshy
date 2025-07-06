'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowLeft, Flag } from 'lucide-react';

export default function AdminModerationPage() {
  const router = useRouter();

  return (
    <AdminLayout currentPage="/admin/moderation">
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
              <h1 className="text-2xl font-bold text-gray-900">Modération du contenu</h1>
              <p className="text-gray-600">Surveillance et gestion du contenu</p>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Messages signalés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">12</div>
              <Badge variant="outline" className="mt-1 text-red-600">En attente</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Utilisateurs suspendus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">3</div>
              <Badge variant="outline" className="mt-1 text-orange-600">Temporaire</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Actions aujourd&apos;hui</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <Badge variant="outline" className="mt-1">Modérations</Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Taux de conformité</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">98%</div>
              <Badge variant="outline" className="mt-1 text-green-600">Excellent</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Message de fonctionnalité en développement */}
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Outils de modération
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Cette interface permettra de gérer les signalements, modérer le contenu inapproprié et prendre des mesures disciplinaires si nécessaire.
            </p>
            <div className="flex justify-center space-x-3">
              <Button variant="outline" onClick={() => router.push('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au tableau de bord
              </Button>
              <Button onClick={() => router.push('/conversations')}>
                <Flag className="h-4 w-4 mr-2" />
                Voir les conversations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
