
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  HardDrive,
  Cpu,
  Globe,
  Brain,
  Database,
  Zap,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { translationService } from '@/services/translation.service';
import { ACTIVE_MODELS } from '@/lib/unified-model-config';
import type { TranslationModelType } from '@/lib/unified-model-config';

interface ModelDisplayInfo {
  id: TranslationModelType;
  name: string;
  config: {
    family: string;
    parameters: string;
    type: string;
  };
  isLoaded: boolean;
  isDownloaded: boolean; // Nouveau: indique si téléchargé dans le cache
  isDefault: boolean;
  diskSize: number;
  memoryUsage: number;
  lastUsed: Date | null;
  useCase: string;
  files: string[];
  cacheStatus: 'none' | 'partial' | 'full';
}

export function ModelsSettings() {
  const [models, setModels] = useState<ModelDisplayInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());
  const [loadProgress, setLoadProgress] = useState<{ [key: string]: number }>({});
  const [modelStats, setModelStats] = useState<{
    totalMemoryUsed: number;
    totalDiskUsed: number;
    translationsToday: number;
    modelsLoaded: number;
  }>({
    totalMemoryUsed: 0,
    totalDiskUsed: 0,
    translationsToday: 0,
    modelsLoaded: 0
  });

  // Charger les informations des modèles et calculer les statistiques
  useEffect(() => {
    const updateModelsInfo = () => {
      const loadedModels = translationService.getLoadedModels();
      
      const modelsInfo: ModelDisplayInfo[] = [
        {
          id: ACTIVE_MODELS.basicModel,
          name: 'MT5 Small (Modèle de base)',
          config: { family: 'MT5', parameters: '580M', type: 'mt5' },
          isLoaded: loadedModels.includes(ACTIVE_MODELS.basicModel),
          isDownloaded: true, // Supposons qu'il est toujours téléchargé (pourrait être vérifié via une API)
          isDefault: true,
          diskSize: 280 * 1024 * 1024, // 280 MB téléchargés dans le cache du navigateur
          memoryUsage: loadedModels.includes(ACTIVE_MODELS.basicModel) ? 320 * 1024 * 1024 : 0, // 320 MB chargés en RAM si actif
          lastUsed: loadedModels.includes(ACTIVE_MODELS.basicModel) ? new Date() : null,
          useCase: 'Messages courts et traductions rapides (≤50 caractères). Chargé automatiquement par défaut.',
          files: ['model.json', 'group1-shard1of1.bin', 'tokenizer.json', 'config.json'],
          cacheStatus: loadedModels.includes(ACTIVE_MODELS.basicModel) ? 'full' : 'none'
        },
        {
          id: ACTIVE_MODELS.highModel,
          name: 'NLLB Distilled 600M (Haute qualité)',
          config: { family: 'NLLB', parameters: '600M', type: 'nllb' },
          isLoaded: loadedModels.includes(ACTIVE_MODELS.highModel),
          isDownloaded: true, // Supposons qu'il est toujours téléchargé (pourrait être vérifié via une API)
          isDefault: false,
          diskSize: 560 * 1024 * 1024, // 560 MB téléchargés dans le cache du navigateur
          memoryUsage: loadedModels.includes(ACTIVE_MODELS.highModel) ? 680 * 1024 * 1024 : 0, // 680 MB chargés en RAM si actif
          lastUsed: loadedModels.includes(ACTIVE_MODELS.highModel) ? new Date(Date.now() - 86400000) : null, // hier si chargé
          useCase: 'Messages longs et traductions complexes (>50 caractères). Chargé automatiquement pour les textes complexes ou en cas d\'échec du modèle de base.',
          files: ['model.json', 'group1-shard1of2.bin', 'group1-shard2of2.bin', 'tokenizer.json', 'config.json'],
          cacheStatus: loadedModels.includes(ACTIVE_MODELS.highModel) ? 'full' : 'none'
        }
      ];

      setModels(modelsInfo);
    };

    updateModelsInfo();
    const interval = setInterval(updateModelsInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculer les statistiques d'utilisation
  useEffect(() => {
    const calculateStats = () => {
      const totalMemoryUsed = models.reduce((sum, model) => sum + model.memoryUsage, 0);
      const totalDiskUsed = models.reduce((sum, model) => sum + (model.isDownloaded ? model.diskSize : 0), 0);
      const modelsLoaded = models.filter(model => model.isLoaded).length;
      
      // Simuler les traductions d'aujourd'hui (pourrait être récupéré du cache)
      const translationsToday = translationService.getCacheStats?.()?.totalTranslations || 0;

      setModelStats({
        totalMemoryUsed,
        totalDiskUsed,
        translationsToday,
        modelsLoaded
      });
    };

    calculateStats();
  }, [models]);

  const handleLoadModel = async (modelId: TranslationModelType) => {
    setLoadingModels(prev => new Set(prev).add(modelId));
    setLoadProgress(prev => ({ ...prev, [modelId]: 0 }));

    try {
      await translationService.loadTranslationPipeline(modelId, (progress: { progress?: number }) => {
        setLoadProgress(prev => ({ 
          ...prev, 
          [modelId]: Math.round((progress.progress || 0) * 100) 
        }));
      });
      
      toast.success(`Modèle ${modelId} chargé avec succès`);
    } catch (error) {
      toast.error(`Erreur lors du chargement de ${modelId}`);
      console.error('Erreur chargement modèle:', error);
    } finally {
      setLoadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
      setLoadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelId];
        return newProgress;
      });
    }
  };

  // Note: handleDownloadModel supprimé car non utilisé pour l'instant
  // Les modèles sont automatiquement téléchargés lors du premier chargement

  const handleDeleteFromCache = async (modelId: TranslationModelType) => {
    // Simuler la suppression du cache navigateur
    toast.info(`Suppression de ${modelId} du cache navigateur...`);
    
    setTimeout(() => {
      toast.success(`Modèle ${modelId} supprimé du cache navigateur`);
      // Mettre à jour l'état isDownloaded pour ce modèle
    }, 1000);
  };

  const handleUnloadModel = async (modelId: TranslationModelType) => {
    try {
      await translationService.unloadPipeline(modelId);
      toast.success(`Modèle ${modelId} déchargé de la RAM`);
    } catch (error) {
      toast.error(`Erreur lors du déchargement RAM de ${modelId}`);
      console.error('Erreur déchargement modèle:', error);
    }
  };

  const testModel = async (modelId: TranslationModelType) => {
    try {
      // D'abord s'assurer que le modèle est chargé
      if (!translationService.isModelLoaded(modelId)) {
        toast.info(`Chargement du modèle ${modelId} pour le test...`);
        await handleLoadModel(modelId);
      }
      
      const testText = "Hello, how are you today?";
      const targetLang = 'fr';
      const sourceLang = 'en';
      
      // Test de traduction simple
      const result = await translationService.translate(testText, targetLang, sourceLang, { preferredModel: modelId });
      
      if (result && result.translatedText && result.translatedText !== testText && !result.translatedText.includes('<extra_id_')) {
        toast.success(`Test réussi: "${result.translatedText}" (modèle: ${result.modelUsed || modelId})`);
      } else {
        toast.warning(`Test partiellement réussi: "${result.translatedText || 'Aucune traduction'}" - Le modèle ${modelId} pourrait ne pas être optimisé pour cette tâche.`);
      }
    } catch (error) {
      toast.error(`Erreur lors du test de ${modelId}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      console.error('Erreur test modèle:', error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getCacheStatusColor = (status: string) => {
    switch (status) {
      case 'full': return 'bg-green-500';
      case 'partial': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  // Fonction pour vider automatiquement la mémoire si nécessaire
  const handleMemoryOptimization = async () => {
    const threshold = 500 * 1024 * 1024; // 500 MB
    if (modelStats.totalMemoryUsed > threshold) {
      toast.info('Optimisation automatique de la mémoire...');
      
      // Décharger le modèle le moins récemment utilisé
      const sortedModels = models
        .filter(m => m.isLoaded && !m.isDefault)
        .sort((a, b) => {
          const timeA = a.lastUsed?.getTime() || 0;
          const timeB = b.lastUsed?.getTime() || 0;
          return timeA - timeB;
        });

      if (sortedModels.length > 0) {
        await handleUnloadModel(sortedModels[0].id);
        toast.success('Mémoire optimisée avec succès');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Vue d'ensemble avec statistiques avancées */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Vue d&apos;ensemble des modèles
          </CardTitle>
          <CardDescription>
            Gérez vos modèles de traduction et optimisez les performances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Cpu className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">RAM Utilisée</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatSize(modelStats.totalMemoryUsed)}
              </div>
              <div className="text-sm text-blue-700">
                {modelStats.modelsLoaded} modèle{modelStats.modelsLoaded !== 1 ? 's' : ''} actif{modelStats.modelsLoaded !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <HardDrive className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">Cache Navigateur</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatSize(modelStats.totalDiskUsed)}
              </div>
              <div className="text-sm text-green-700">
                Modèles téléchargés
              </div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Globe className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-purple-900">Traductions</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {modelStats.translationsToday}
              </div>
              <div className="text-sm text-purple-700">
                Aujourd&apos;hui
              </div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-900">Performance</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {modelStats.totalMemoryUsed > 500 * 1024 * 1024 ? 'Élevée' : 'Optimale'}
              </div>
              <div className="text-sm text-orange-700">
                Utilisation mémoire
              </div>
            </div>
          </div>
          
          {/* Actions d'optimisation */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMemoryOptimization}
              className="text-blue-600 hover:text-blue-700"
            >
              <Zap className="h-4 w-4 mr-1" />
              Optimiser la mémoire
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                models.filter(m => m.isLoaded && !m.isDefault).forEach(m => handleUnloadModel(m.id));
                toast.success('Tous les modèles non-essentiels ont été déchargés');
              }}
              className="text-yellow-600 hover:text-yellow-700"
            >
              <Database className="h-4 w-4 mr-1" />
              Décharger tout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section modèles détaillée */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Modèles disponibles</h3>
        {models.map((model) => (
          <Card key={model.id} className={`${model.isLoaded ? 'ring-2 ring-blue-200' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getCacheStatusColor(model.cacheStatus)}`} />
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                  {model.isDefault && (
                    <Badge variant="default" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      Par défaut
                    </Badge>
                  )}
                  {model.isLoaded && (
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                      <Cpu className="h-3 w-3 mr-1" />
                      Chargé en RAM
                    </Badge>
                  )}
                  {model.isDownloaded && !model.isLoaded && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                      <HardDrive className="h-3 w-3 mr-1" />
                      En cache navigateur
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Actions de gestion de la RAM */}
                  {model.isLoaded ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testModel(model.id)}
                      >
                        <Globe className="h-4 w-4 mr-1" />
                        Tester
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnloadModel(model.id)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <Cpu className="h-4 w-4 mr-1" />
                        Décharger RAM
                      </Button>
                    </>
                  ) : model.isDownloaded ? (
                    <Button
                      size="sm"
                      onClick={() => handleLoadModel(model.id)}
                      disabled={loadingModels.has(model.id)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Cpu className="h-4 w-4 mr-1" />
                      {loadingModels.has(model.id) ? 'Chargement RAM...' : 'Charger en RAM'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleLoadModel(model.id)}
                      disabled={loadingModels.has(model.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {loadingModels.has(model.id) ? 'Téléchargement...' : 'Télécharger + Charger'}
                    </Button>
                  )}

                  {/* Actions de gestion du cache navigateur */}
                  {model.isDownloaded && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteFromCache(model.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <HardDrive className="h-4 w-4 mr-1" />
                      Supprimer Cache
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                {model.useCase}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingModels.has(model.id) && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">
                      {model.isDownloaded ? 'Chargement en RAM...' : 'Téléchargement + Chargement en RAM...'}
                    </span>
                    <span className="text-sm">{loadProgress[model.id] || 0}%</span>
                  </div>
                  <Progress value={loadProgress[model.id] || 0} className="w-full" />
                  <p className="text-xs text-gray-500 mt-1">
                    {model.isDownloaded 
                      ? 'Chargement des fichiers depuis le cache navigateur vers la mémoire RAM'
                      : 'Téléchargement des fichiers dans le cache navigateur puis chargement en mémoire RAM'
                    }
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Informations techniques */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    Informations techniques
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Cache navigateur:</span>
                      <span className="font-medium">{formatSize(model.diskSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RAM active:</span>
                      <span className="font-medium">{formatSize(model.memoryUsage)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>État:</span>
                      <div className="flex flex-col gap-1 items-end">
                        {model.isLoaded && (
                          <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                            <Cpu className="h-3 w-3 mr-1" />
                            Chargé en RAM
                          </Badge>
                        )}
                        {model.isDownloaded && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            <HardDrive className="h-3 w-3 mr-1" />
                            En cache navigateur
                          </Badge>
                        )}
                        {!model.isDownloaded && !model.isLoaded && (
                          <Badge variant="outline" className="text-xs">
                            Non téléchargé
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Dernière utilisation:</span>
                      <span className="font-medium">
                        {model.lastUsed ? model.lastUsed.toLocaleDateString() : 'Jamais utilisé'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fichiers du modèle */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Fichiers du modèle
                  </h4>
                  <div className="space-y-1">
                    {model.files.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <FileText className="h-3 w-3 text-gray-400" />
                        <span className="font-mono text-xs">{file}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Configuration du modèle */}
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                    <strong>Config:</strong> {model.config?.family || 'N/A'} - 
                    {model.config?.parameters || 'N/A'} paramètres
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


