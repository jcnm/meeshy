import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  HardDrive,
  Globe,
  Zap,
  Info
} from 'lucide-react';

interface RealModelDownloaderProps {
  // Props pour compatibilité mais non utilisées avec le service API
}

const RealModelDownloader: React.FC<RealModelDownloaderProps> = () => {
  return (
    <div className="space-y-6">
      {/* Informations sur le service API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Service de Traduction API
          </CardTitle>
          <CardDescription>
            Les modèles de traduction sont gérés côté serveur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center">
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-sm font-medium">Multilingue</p>
              <p className="text-xs text-gray-500">Support de nombreuses langues</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center">
                <Zap className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm font-medium">Rapide</p>
              <p className="text-xs text-gray-500">Traduction côté serveur</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center">
                <HardDrive className="h-8 w-8 text-purple-600" />
              </div>
              <p className="text-sm font-medium">Sans Installation</p>
              <p className="text-xs text-gray-500">Aucun téléchargement requis</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Service API Actif</p>
                <p>
                  Les traductions sont traitées par le serveur de traduction. 
                  Aucune gestion de modèle local n'est nécessaire.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { RealModelDownloader };
