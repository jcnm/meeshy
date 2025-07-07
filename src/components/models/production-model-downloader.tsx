'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Check, Trash2, HardDrive } from 'lucide-react';
import { HuggingFaceTranslationService } from '@/services/huggingface-translation';
import { UNIFIED_TRANSLATION_MODELS, type TranslationModelType } from '@/lib/simplified-model-config';
import { toast } from 'sonner';

/**
 * Interface pour télécharger et gérer les VRAIS modèles Hugging Face
 * PRODUCTION READY - Utilise @huggingface/transformers !
 */
export function ProductionModelDownloader() {
  const [translationService] = useState(() => HuggingFaceTranslationService.getInstance());
  const [loadedModels, setLoadedModels] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());
  const [storageEstimate, setStorageEstimate] = useState<{ used: number; quota: number } | null>(null);

  const checkLoadedModels = useCallback(async () => {
    const loaded = new Set<string>();
    for (const model of Object.values(UNIFIED_TRANSLATION_MODELS)) {
      if (translationService.isModelLoaded(model.name)) {
        loaded.add(model.name);
      }
    }
    setLoadedModels(loaded);
  }, [translationService]);

  useEffect(() => {
    // Vérifier les modèles déjà chargés
    checkLoadedModels();
    
    // Estimer l'espace de stockage disponible
    estimateStorage();
  }, [checkLoadedModels]);

  const estimateStorage = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageEstimate({
          used: estimate.usage || 0,
          quota: estimate.quota || 0
        });
      } catch (error) {
        console.warn('Impossible d\'estimer l\'espace de stockage:', error);
      }
    }
  };

  const handleDownload = async (modelName: string) => {
    try {
      setLoadingModels(prev => new Set([...prev, modelName]));
      setDownloadProgress(prev => ({ ...prev, [modelName]: 0 }));
      
      toast.info(`Démarrage du téléchargement: ${modelName}`, {
        description: 'Le téléchargement peut prendre plusieurs minutes selon votre connexion'
      });

      // Simuler une progression (Hugging Face ne fournit pas de callback de progression détaillé)
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => ({
          ...prev,
          [modelName]: Math.min(prev[modelName] + Math.random() * 10, 90)
        }));
      }, 1000);

      await translationService.loadModel(modelName as TranslationModelType);
      
      clearInterval(progressInterval);
      setDownloadProgress(prev => ({ ...prev, [modelName]: 100 }));
      setLoadedModels(prev => new Set([...prev, modelName]));
      setLoadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });

      toast.success(`Modèle ${modelName} téléchargé avec succès !`, {
        description: 'Le modèle est maintenant disponible pour la traduction'
      });
      
      // Actualiser l'estimation de stockage
      estimateStorage();
    } catch (error) {
      setLoadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
      
      toast.error(`Erreur lors du téléchargement de ${modelName}`, {
        description: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  };

  const handleUnload = async (modelName: string) => {
    try {
      await translationService.unloadModel(modelName as TranslationModelType);
      setLoadedModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
      
      toast.success(`Modèle ${modelName} déchargé de la mémoire`);
      estimateStorage();
    } catch (error) {
      toast.error(`Erreur lors du déchargement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStoragePercentage = () => {
    if (!storageEstimate) return 0;
    return (storageEstimate.used / storageEstimate.quota) * 100;
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Téléchargement des modèles de production</h2>
        <p className="text-muted-foreground">
          Téléchargez les vrais modèles Hugging Face directement dans votre navigateur. 
          Les modèles sont stockés localement et restent disponibles hors ligne.
        </p>
      </div>

      {/* Indicateur de stockage */}
      {storageEstimate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardDrive className="h-5 w-5" />
              Espace de stockage local
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Utilisé: {formatBytes(storageEstimate.used)}</span>
                <span>Disponible: {formatBytes(storageEstimate.quota - storageEstimate.used)}</span>
              </div>
              <Progress value={getStoragePercentage()} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des modèles */}
      <div className="grid gap-4">
        {Object.values(UNIFIED_TRANSLATION_MODELS).map((model) => {
          const isLoaded = loadedModels.has(model.name);
          const isLoading = loadingModels.has(model.name);
          const progress = downloadProgress[model.name] || 0;

          return (
            <Card key={model.name} className={isLoaded ? 'border-green-200 bg-green-50/50' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {model.description}
                      {isLoaded && <Check className="h-4 w-4 text-green-600" />}
                    </CardTitle>
                    <CardDescription>
                      {model.family} {model.size} • {model.downloadSize}MB • {model.huggingFaceId}
                    </CardDescription>
                  </div>
                  <Badge variant={model.downloadSize <= 1000 ? 'default' : 'secondary'}>
                    {model.downloadSize <= 1000 ? 'Recommandé' : 'Avancé'}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Barre de progression */}
                  {isLoading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Téléchargement en cours...</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    {!isLoaded && !isLoading && (
                      <Button
                        onClick={() => handleDownload(model.name)}
                        className="flex-1"
                        variant={model.downloadSize <= 1000 ? 'default' : 'outline'}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    )}
                    
                    {isLoading && (
                      <Button
                        disabled
                        className="flex-1"
                        variant="outline"
                      >
                        <Download className="mr-2 h-4 w-4 animate-spin" />
                        Téléchargement...
                      </Button>
                    )}
                    
                    {isLoaded && (
                      <Button
                        onClick={() => handleUnload(model.name)}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Décharger
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900">Instructions importantes</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2">
          <p>• <strong>Connexion requise :</strong> Le téléchargement initial nécessite une connexion internet</p>
          <p>• <strong>Stockage local :</strong> Les modèles sont sauvegardés dans votre navigateur</p>
          <p>• <strong>Usage hors ligne :</strong> Une fois téléchargés, les modèles fonctionnent sans connexion</p>
          <p>• <strong>Espace requis :</strong> Prévoyez ~1GB d&apos;espace libre pour tous les modèles</p>
          <p>• <strong>Technologie :</strong> Utilise les vrais modèles Hugging Face via @huggingface/transformers</p>
        </CardContent>
      </Card>
    </div>
  );
}
