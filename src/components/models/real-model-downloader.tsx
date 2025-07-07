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
} from '@/services/huggingface-translation';
import { 
  UNIFIED_TRANSLATION_MODELS, 
  type UnifiedModelConfig,
  type TranslationModelType as UnifiedModelType,
  getCompatibleModels,
  estimateSystemCapabilities 
} from '@/lib/unified-model-config';
import { 
  type TranslationModelType as HuggingFaceModelType 
} from '@/lib/simplified-model-config';

// Fonction de mapping pour convertir les types unifiés vers HuggingFace
const mapToHFModelType = (modelType: UnifiedModelType): HuggingFaceModelType | null => {
  switch (modelType) {
    case 'MT5_SMALL':
      return 'MT5_BASE' as HuggingFaceModelType;
    case 'MT5_BASE':
      return 'MT5_BASE' as HuggingFaceModelType;
    case 'NLLB_DISTILLED_600M':
      return 'NLLB_DISTILLED_600M' as HuggingFaceModelType;
    default:
      return null;
  }
};

/**
 * Formate une taille en octets de manière lisible
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Composant pour le téléchargement RÉEL des modèles TensorFlow.js
 * Plus de mocks - Téléchargement et stockage réels dans le navigateur
 * Affiche TOUS les modèles disponibles (11 modèles) avec leurs caractéristiques
 */
export function RealModelDownloader() {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, TranslationProgress>>({});
  const [loadedModels, setLoadedModels] = useState<UnifiedModelType[]>([]);
  const [systemCapabilities] = useState(() => estimateSystemCapabilities());

  const modelService = HuggingFaceTranslationService.getInstance();
  
  // Convertir la configuration unifiée en liste utilisable
  const availableModels = Object.values(UNIFIED_TRANSLATION_MODELS);
  const compatibleModels = getCompatibleModels(systemCapabilities.maxMemoryMB);

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
  const downloadModel = async (modelName: UnifiedModelType) => {
    try {
      console.log(`🔄 Démarrage téléchargement: ${modelName}`);
      
      // Mapper vers le type HuggingFace
      const hfModelType = mapToHFModelType(modelName);
      if (!hfModelType) {
        throw new Error(`Modèle non supporté: ${modelName}`);
      }
      
      await modelService.loadModel(hfModelType, (progress: TranslationProgress) => {
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
  const unloadModel = async (modelName: UnifiedModelType) => {
    // Mapper vers le type HuggingFace
    const hfModelType = mapToHFModelType(modelName);
    if (!hfModelType) {
      toast.error(`Modèle non supporté: ${modelName}`);
      return;
    }
    
    const success = await modelService.unloadModel(hfModelType);
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
  const getModelStatus = (modelName: UnifiedModelType) => {
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
            Téléchargement des modèles TensorFlow.js
          </CardTitle>
          <CardDescription>
            Téléchargement et stockage réels des modèles de traduction dans votre navigateur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{loadedModels.length}</div>
              <div className="text-sm text-muted-foreground">Modèles chargés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{availableModels.length}</div>
              <div className="text-sm text-muted-foreground">Modèles disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Object.values(downloadProgress).filter(p => p.status === 'downloading').length}
              </div>
              <div className="text-sm text-muted-foreground">En téléchargement</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommandations système */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Zap className="h-5 w-5" />
            Recommandations pour votre système
          </CardTitle>
          <CardDescription>
            {systemCapabilities.reasoning}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-medium text-sm">Modèle MT5 recommandé :</div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {systemCapabilities.recommendedModels.mt5}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-sm">Modèle NLLB recommandé :</div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {systemCapabilities.recommendedModels.nllb}
              </Badge>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>Mémoire estimée :</strong> {Math.round(systemCapabilities.maxMemoryMB / 1024)}GB
              <br />
              <strong>Modèles compatibles :</strong> {compatibleModels.length} sur {availableModels.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des modèles */}
      <div className="space-y-6">
        {/* Recommandations système */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Recommandations pour votre système</CardTitle>
            <CardDescription className="text-blue-700">
              {systemCapabilities.reasoning}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">MT5</Badge>
                <div>
                  <div className="font-medium">{systemCapabilities.recommendedModels.mt5}</div>
                  <div className="text-sm text-gray-600">Recommandé pour messages courts</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">NLLB</Badge>
                <div>
                  <div className="font-medium">{systemCapabilities.recommendedModels.nllb}</div>
                  <div className="text-sm text-gray-600">Recommandé pour messages complexes</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modèles compatibles */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-green-700">
            Modèles compatibles avec votre système ({compatibleModels.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {compatibleModels.map((config) => (
              <ModelCard 
                key={config.name} 
                config={config} 
                status={getModelStatus(config.name)}
                progress={downloadProgress[config.name]}
                onDownload={() => downloadModel(config.name)}
                onUnload={() => unloadModel(config.name)}
                isRecommended={
                  config.name === systemCapabilities.recommendedModels.mt5 ||
                  config.name === systemCapabilities.recommendedModels.nllb
                }
              />
            ))}
          </div>
        </div>

        {/* Tous les modèles */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Tous les modèles disponibles ({availableModels.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableModels.map((config) => (
              <ModelCard 
                key={config.name} 
                config={config} 
                status={getModelStatus(config.name)}
                progress={downloadProgress[config.name]}
                onDownload={() => downloadModel(config.name)}
                onUnload={() => unloadModel(config.name)}
                isCompatible={compatibleModels.some(m => m.name === config.name)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Guide de sélection des modèles */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-700">Guide de sélection des modèles</CardTitle>
          <CardDescription>
            Comment choisir le bon modèle selon vos besoins et votre système
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">💡 Recommandations générales :</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Commencez par les modèles recommandés</strong> - Ils sont optimisés pour votre système</li>
                <li>• <strong>MT5 pour messages courts</strong> - Meilleur pour phrases simples (≤50 caractères)</li>
                <li>• <strong>NLLB pour messages longs</strong> - Excellent pour textes complexes et paragraphes</li>
                <li>• <strong>Modèles &quot;Distilled&quot;</strong> - Version optimisée avec moins d&apos;espace de stockage</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">⚡ Selon la performance souhaitée :</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="font-medium text-green-700 mb-1">Vitesse maximale</div>
                  <div className="text-gray-600">MT5_SMALL, NLLB_200M</div>
                </div>
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="font-medium text-blue-700 mb-1">Équilibre optimal</div>
                  <div className="text-gray-600">MT5_BASE, NLLB_DISTILLED_600M</div>
                </div>
                <div className="p-3 bg-purple-50 rounded border border-purple-200">
                  <div className="font-medium text-purple-700 mb-1">Qualité maximale</div>
                  <div className="text-gray-600">MT5_LARGE, NLLB_DISTILLED_1_3B</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-800 mb-1">Important :</div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Les modèles sont stockés localement dans votre navigateur</li>
                    <li>• Le téléchargement initial peut prendre plusieurs minutes</li>
                    <li>• Vous pouvez télécharger plusieurs modèles et les utiliser selon vos besoins</li>
                    <li>• Les modèles non compatibles avec votre système sont marqués en rouge</li>
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
