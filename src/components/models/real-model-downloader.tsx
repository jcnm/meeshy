'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { 
  HuggingFaceTranslationService, 
  type TranslationProgress 
} from '@/services/simplified-translation.service';
import { 
  getAllActiveModels,
  getActiveModelConfig,
  ACTIVE_MODELS,
  type AllowedModelType 
} from '@/lib/simple-model-config';
import { 
  type UnifiedModelConfig 
} from '@/lib/unified-model-config';

// Plus besoin de mapping - utilisation directe des types AllowedModelType

/**
 * Composant pour le téléchargement des 2 modèles actifs configurés
 * Plus de liste infinie - Seulement les modèles basique et haute performance
 */
export function RealModelDownloader() {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, TranslationProgress>>({});
  const [loadedModels, setLoadedModels] = useState<AllowedModelType[]>([]);

  const modelService = HuggingFaceTranslationService.getInstance();
  
  // Récupérer les 2 modèles actifs
  const activeModels = getAllActiveModels();
  const basicModelConfig = getActiveModelConfig('basic');
  const highModelConfig = getActiveModelConfig('high');

  useEffect(() => {
    // Charger l'état initial des modèles
    const updateLoadedModels = () => {
      const stats = modelService.getModelStats();
      setLoadedModels(stats.loadedModels);
    };

    updateLoadedModels();
  }, [modelService]);

  /**
   * Télécharge un modèle spécifique
   */
  const downloadModel = async (modelName: AllowedModelType) => {
    try {
      console.log(`🔄 Démarrage téléchargement: ${modelName}`);
      
      await modelService.loadModel(modelName, (progress: TranslationProgress) => {
        setDownloadProgress(prev => ({
          ...prev,
          [modelName]: progress
        }));
      });

      // Mettre à jour la liste des modèles chargés
      const stats = modelService.getModelStats();
      setLoadedModels(stats.loadedModels);
      
      // Supprimer la progression une fois terminé
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelName];
        return newProgress;
      });

      toast.success(`Modèle ${modelName} téléchargé avec succès !`);
      
    } catch (error) {
      console.error(`❌ Erreur téléchargement ${modelName}:`, error);
      
      setDownloadProgress(prev => ({
        ...prev,
        [modelName]: {
          modelName,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        }
      }));

      toast.error(`Échec du téléchargement de ${modelName}`);
    }
  };

  /**
   * Décharge un modèle de la mémoire
   */
  const unloadModel = async (modelName: AllowedModelType) => {
    const success = await modelService.unloadModel(modelName);
    if (success) {
      const stats = modelService.getModelStats();
      setLoadedModels(stats.loadedModels);
      toast.success(`Modèle ${modelName} déchargé`);
    } else {
      toast.error(`Erreur lors du déchargement de ${modelName}`);
    }
  };

  /**
   * Obtient le statut d'un modèle
   */
  const getModelStatus = (modelName: AllowedModelType) => {
    if (loadedModels.includes(modelName)) return 'loaded';
    if (downloadProgress[modelName]) return downloadProgress[modelName].status;
    return 'not-downloaded';
  };

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Modèles de traduction actifs
          </CardTitle>
          <CardDescription>
            Configuration simplifiée : 2 modèles configurés via les variables d&apos;environnement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{loadedModels.length}</div>
              <div className="text-sm text-muted-foreground">Modèles chargés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">2</div>
              <div className="text-sm text-muted-foreground">Modèles configurés</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration actuelle */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Zap className="h-5 w-5" />
            Configuration active
          </CardTitle>
          <CardDescription>
            Modèles configurés pour cette instance de Meeshy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-medium text-sm">Modèle basique (messages courts) :</div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {ACTIVE_MODELS.basicModel}
              </Badge>
              <div className="text-xs text-gray-600">{basicModelConfig.description}</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-sm">Modèle haute performance (messages complexes) :</div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {ACTIVE_MODELS.highModel}
              </Badge>
              <div className="text-xs text-gray-600">{highModelConfig.description}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modèles actifs */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">
          Modèles disponibles (2)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeModels.map(({ config }) => (              <ModelCard 
                key={config.name} 
                config={config} 
                status={getModelStatus(config.name)}
                progress={downloadProgress[config.name]}
                onDownload={() => downloadModel(config.name)}
                onUnload={() => unloadModel(config.name)}
                isRecommended={true}
                isCompatible={true}
              />
          ))}
        </div>
      </div>

      {/* Guide de sélection des modèles */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-700">Configuration simplifiée</CardTitle>
          <CardDescription>
            Meeshy utilise uniquement 2 modèles configurables pour optimiser les performances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">💡 Fonctionnement :</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Modèle basique :</strong> Utilisé pour les messages courts (≤50 caractères) et simples</li>
                <li>• <strong>Modèle haute performance :</strong> Utilisé pour les messages longs et complexes</li>
                <li>• <strong>Sélection automatique :</strong> L&apos;application choisit le bon modèle selon le contexte</li>
                <li>• <strong>Configuration via .env :</strong> NEXT_PUBLIC_BASIC_MODEL et NEXT_PUBLIC_HIGH_MODEL</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-800 mb-1">Configuration actuelle :</div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Basique : <strong>{ACTIVE_MODELS.basicModel}</strong></li>
                    <li>• Haute performance : <strong>{ACTIVE_MODELS.highModel}</strong></li>
                    <li>• Pour changer, modifiez les variables dans .env.local et redémarrez</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Composant pour afficher un modèle individuel
 */
function ModelCard({ 
  config, 
  status, 
  progress, 
  onDownload, 
  onUnload, 
  isRecommended = false,
  isCompatible = true 
}: {
  config: UnifiedModelConfig;
  status: string;
  progress?: TranslationProgress;
  onDownload: () => void;
  onUnload: () => void;
  isRecommended?: boolean;
  isCompatible?: boolean;
}) {
  const isLoaded = status === 'loaded';
  const isDownloading = status === 'downloading' || status === 'loading';

  return (
    <Card className={`${
      isLoaded ? 'border-green-200 bg-green-50' : 
      isRecommended ? 'border-blue-200 bg-blue-50' :
      !isCompatible ? 'border-red-200 bg-red-50 opacity-75' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {config.displayName}
            {isRecommended && <Zap className="h-4 w-4 text-yellow-500" />}
          </CardTitle>
          <Badge 
            style={{ backgroundColor: config.color + '20', color: config.color, borderColor: config.color + '40' }}
            variant="outline"
          >
            {config.family}
          </Badge>
        </div>
        <CardDescription>
          {config.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Caractéristiques techniques */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="font-medium">Taille:</span>
            <span>{Math.round(config.downloadSize / 1024 * 100) / 100} GB</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">RAM:</span>
            <span>{Math.round(config.memoryRequirement / 1024 * 100) / 100} GB</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Qualité:</span>
            <span>{config.qualityScore}/10</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Vitesse:</span>
            <span>{config.speedScore}/10</span>
          </div>
        </div>

        {/* Indicateurs de performance */}
        <div className="flex gap-1">
          <Badge variant="outline" className="text-xs">
            {config.performance}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {config.quality}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {config.parameters}
          </Badge>
        </div>

        {/* Statut */}
        <div className="flex items-center gap-2">
          {isLoaded && <CheckCircle className="h-4 w-4 text-green-600" />}
          {isDownloading && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
          {status === 'error' && <AlertTriangle className="h-4 w-4 text-red-600" />}
          {!isCompatible && <AlertTriangle className="h-4 w-4 text-orange-500" />}
          <span className={`text-sm font-medium ${
            isLoaded ? 'text-green-700' :
            isDownloading ? 'text-blue-700' :
            status === 'error' ? 'text-red-700' :
            !isCompatible ? 'text-orange-700' :
            'text-gray-700'
          }`}>
            {!isCompatible ? 'Système insuffisant' :
             isLoaded ? 'Chargé en mémoire' :
             isDownloading ? 'Téléchargement...' :
             status === 'error' ? 'Erreur' :
             'Non téléchargé'}
          </span>
        </div>

        {/* Barre de progression */}
        {progress && isDownloading && (
          <div className="space-y-1">
            <Progress value={progress.progress || 0} className="h-2" />
            <div className="flex justify-between text-xs text-gray-600">
              <span>{progress.status === 'downloading' ? 'Téléchargement' : 'Chargement'}</span>
              <span>{Math.round(progress.progress || 0)}%</span>
            </div>
            {/* Affichage des octets téléchargés - non disponible dans TranslationProgress
            {progress.bytesLoaded !== undefined && progress.bytesTotal !== undefined && progress.bytesTotal > 0 && (
              <div className="text-xs text-gray-500 text-center">
                {formatBytes(progress.bytesLoaded)} / {formatBytes(progress.bytesTotal)}
              </div>
            )}
            */}
          </div>
        )}

        {/* Message d'erreur */}
        {status === 'error' && progress?.error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {progress.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isLoaded && !isDownloading && isCompatible && (
            <Button
              onClick={onDownload}
              size="sm"
              className="flex-1"
              variant={isRecommended ? "default" : "outline"}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          )}
          
          {isLoaded && (
            <Button
              onClick={onUnload}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Décharger
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
