import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Settings,
  HardDrive,
  Globe,
  Zap,
  Info,
  CheckCircle
} from 'lucide-react';

const ModelsSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Modèles de Traduction</h1>
          <p className="text-gray-600">Gestion des modèles via le service API</p>
        </div>
      </div>

      {/* Service API actuel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Service de Traduction Actif
          </CardTitle>
          <CardDescription>
            Configuration du service de traduction côté serveur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status du service */}
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Service API Connecté</p>
                  <p className="text-sm text-green-600">Traduction automatique disponible</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                Actif
              </Badge>
            </div>

            {/* Fonctionnalités */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Globe className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-medium text-blue-800">Multi-lingue</h4>
                <p className="text-sm text-blue-600">Support de nombreuses langues</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Zap className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h4 className="font-medium text-purple-800">Rapide</h4>
                <p className="text-sm text-purple-600">Traduction côté serveur optimisée</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <HardDrive className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <h4 className="font-medium text-orange-800">Sans Installation</h4>
                <p className="text-sm text-orange-600">Aucun téléchargement requis</p>
              </div>
            </div>

            {/* Info technique */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Configuration Technique</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Modèles hébergés sur serveur de traduction</li>
                    <li>• Pas de gestion locale de modèles nécessaire</li>
                    <li>• API REST pour toutes les traductions</li>
                    <li>• Cache côté serveur pour les performances</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Gestion du service de traduction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button variant="outline" className="w-full" disabled>
              <Settings className="h-4 w-4 mr-2" />
              Tester la Connexion API
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Les actions de gestion des modèles sont disponibles côté serveur
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { ModelsSettings };
