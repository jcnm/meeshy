'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { HuggingFaceTranslationService } from '@/services/huggingface-translation';
import { 
  UNIFIED_TRANSLATION_MODELS, 
  TranslationModelType,
  estimateSystemCapabilities,
  getAvailableModels
} from '@/lib/simplified-model-config';
import { toast } from 'sonner';

export function SimpleModelManager() {
  const [translationService] = useState(() => HuggingFaceTranslationService.getInstance());
  const [loadedModels, setLoadedModels] = useState<Set<TranslationModelType>>(new Set());
  const [downloadingModels, setDownloadingModels] = useState<Set<TranslationModelType>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Partial<Record<TranslationModelType, number>>>({});
  const [errors, setErrors] = useState<Partial<Record<TranslationModelType, string>>>({});

  // Modèles disponibles (seulement 2)
  const availableModels = getAvailableModels();

  // Recommandation système
  const systemCapabilities = estimateSystemCapabilities();

  useEffect(() => {
    // Vérifier les modèles déjà chargés au démarrage
    const updateLoadedModels = () => {
      const loaded = translationService.getLoadedModels();
      const persisted = translationService.getPersistedLoadedModels();
      const allLoaded = new Set([...loaded, ...persisted]);
      setLoadedModels(allLoaded);
    };
    
    updateLoadedModels();
  }, [translationService]);

  const updateLoadedModels = () => {
    const loaded = translationService.getLoadedModels();
    const persisted = translationService.getPersistedLoadedModels();
    const allLoaded = new Set([...loaded, ...persisted]);
    setLoadedModels(allLoaded);
  };

  const handleDownloadModel = async (modelType: TranslationModelType) => {
    try {
      setDownloadingModels(prev => new Set([...prev, modelType]));
      setErrors(prev => ({ ...prev, [modelType]: '' }));
      setDownloadProgress(prev => ({ ...prev, [modelType]: 0 }));

      console.log(`🔽 Début téléchargement: ${modelType}`);

      await translationService.loadModel(modelType, (progress) => {
        console.log(`📊 Progression ${modelType}:`, progress);
        
        if (progress.progress !== undefined) {
          setDownloadProgress(prev => ({ ...prev, [modelType]: progress.progress! }));
        }

        if (progress.status === 'ready') {
          setDownloadingModels(prev => {
            const newSet = new Set(prev);
            newSet.delete(modelType);
            return newSet;
          });
          updateLoadedModels();
          toast.success(`Modèle ${modelType} chargé avec succès !`);
        } else if (progress.status === 'error') {
          setDownloadingModels(prev => {
            const newSet = new Set(prev);
            newSet.delete(modelType);
            return newSet;
          });
          setErrors(prev => ({ ...prev, [modelType]: progress.error || 'Erreur inconnue' }));
          toast.error(`Erreur lors du chargement de ${modelType}`);
        }
      });

    } catch (error) {
      console.error(`❌ Erreur téléchargement ${modelType}:`, error);
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelType);
        return newSet;
      });
      setErrors(prev => ({ 
        ...prev, 
        [modelType]: error instanceof Error ? error.message : 'Erreur de téléchargement' 
      }));
      toast.error(`Erreur lors du téléchargement de ${modelType}`);
    }
  };

  const handleUnloadModel = async (modelType: TranslationModelType) => {
    try {
      await translationService.unloadModel(modelType);
      updateLoadedModels();
      toast.success(`Modèle ${modelType} déchargé`);
    } catch (error) {
      console.error(`❌ Erreur déchargement ${modelType}:`, error);
      toast.error('Erreur lors du déchargement');
    }
  };

  const formatSize = (sizeInMB: number): string => {
    if (sizeInMB >= 1000) {
      return `${(sizeInMB / 1000).toFixed(1)} GB`;
    }
    return `${sizeInMB} MB`;
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Gestionnaire de Modèles Simplifié</h2>
        <p className="text-muted-foreground">
          Gérez les 2 modèles essentiels pour la traduction
        </p>
      </div>

      {/* Recommandation système */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-800">💡 Recommandation Système</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-blue-700">
              <strong>Modèle recommandé :</strong> {systemCapabilities.recommendedModel}
            </p>
            <p className="text-sm text-blue-600">
              {systemCapabilities.reasoning}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Liste des modèles */}
      <div className="grid gap-4">
        {availableModels.map((modelType) => {
          const config = UNIFIED_TRANSLATION_MODELS[modelType];
          const isLoaded = loadedModels.has(modelType);
          const isDownloading = downloadingModels.has(modelType);
          const progress = downloadProgress[modelType] || 0;
          const error = errors[modelType];
          const isRecommended = modelType === systemCapabilities.recommendedModel;

          return (
            <Card key={modelType} className={`relative ${isRecommended ? 'border-blue-300 bg-blue-50/30' : ''}`}>
              {isRecommended && (
                <Badge className="absolute top-2 right-2 bg-blue-600">
                  Recommandé
                </Badge>
              )}
              
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {config.displayName}
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                    </CardTitle>
                    <CardDescription>
                      {config.family} • {config.parameters} paramètres • {formatSize(config.downloadSize)}
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isLoaded && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Chargé
                      </Badge>
                    )}
                    {error && (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        Erreur
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description du modèle */}
                <p className="text-sm text-muted-foreground">
                  {config.description}
                </p>

                {/* Caractéristiques */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Qualité :</span> {config.qualityScore}/10
                  </div>
                  <div>
                    <span className="font-medium">Vitesse :</span> {config.speedScore}/10
                  </div>
                  <div>
                    <span className="font-medium">Mémoire :</span> {formatSize(config.memoryRequirement)}
                  </div>
                  <div>
                    <span className="font-medium">Usage :</span> {config.purpose === 'simple' ? 'Messages courts' : 'Messages complexes'}
                  </div>
                </div>

                {/* Barre de progression si téléchargement en cours */}
                {isDownloading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Téléchargement...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Message d'erreur */}
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {!isLoaded && !isDownloading && (
                    <Button
                      onClick={() => handleDownloadModel(modelType)}
                      className="flex-1"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                  )}

                  {isDownloading && (
                    <Button disabled className="flex-1" size="sm">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Téléchargement...
                    </Button>
                  )}

                  {isLoaded && (
                    <Button
                      onClick={() => handleUnloadModel(modelType)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Décharger
                    </Button>
                  )}

                  {error && (
                    <Button
                      onClick={() => handleDownloadModel(modelType)}
                      variant="outline"
                      size="sm"
                    >
                      Réessayer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Statistiques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 Statistiques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Modèles chargés :</span> {loadedModels.size}/2
            </div>
            <div>
              <span className="font-medium">Téléchargements en cours :</span> {downloadingModels.size}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
