'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Download, Trash2, AlertTriangle, CheckCircle, Zap, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

// Types de configuration
interface ModelConfig {
  mt5Variant: string;
  nllbVariant: string;
  autoSelectModel: boolean;
  preloadModels: boolean;
  maxMemoryUsage: number;
}

interface ModelInfo {
  name: string;
  color: string;
  description: string;
  memoryMB: number;
  downloadSizeMB: number;
  bestFor: string[];
}

// Configuration étendue des modèles avec couleurs graduées selon la taille
const MODEL_CONFIGS: Record<string, ModelInfo> = {
  // Famille mT5 - tons verts de plus en plus foncés selon la taille
  'mt5-small': {
    name: 'mT5 Small (290MB)',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Rapide et économe - idéal pour les messages courts',
    memoryMB: 580,
    downloadSizeMB: 290,
    bestFor: ['Messages courts', 'Traduction rapide', 'Appareils moins puissants']
  },
  'mt5-base': {
    name: 'mT5 Base (600MB)',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Équilibré - bon compromis qualité/performance',
    memoryMB: 1200,
    downloadSizeMB: 600,
    bestFor: ['Usage général', 'Textes moyens', 'Bon compromis']
  },
  'mt5-large': {
    name: 'mT5 Large (1.2GB)',
    color: 'bg-emerald-200 text-emerald-900 border-emerald-400',
    description: 'Haute qualité - pour des traductions précises',
    memoryMB: 2400,
    downloadSizeMB: 1200,
    bestFor: ['Textes longs', 'Haute précision', 'Traductions professionnelles']
  },
  'mt5-xl': {
    name: 'mT5 XL (3.7GB)',
    color: 'bg-emerald-300 text-emerald-950 border-emerald-500',
    description: 'Très haute qualité - performance maximale',
    memoryMB: 7400,
    downloadSizeMB: 3700,
    bestFor: ['Textes complexes', 'Qualité maximale', 'Recherche']
  },
  'mt5-xxl': {
    name: 'mT5 XXL (11GB)',
    color: 'bg-emerald-400 text-white border-emerald-600',
    description: 'Qualité exceptionnelle - réservé aux serveurs puissants',
    memoryMB: 22000,
    downloadSizeMB: 11000,
    bestFor: ['Recherche avancée', 'Serveurs dédiés', 'Qualité ultime']
  },
  
  // Famille NLLB - tons orange de plus en plus foncés selon la taille
  'nllb-distilled-600M': {
    name: 'NLLB 600M (550MB)',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    description: 'Multilingue optimisé - excellent pour les langues rares',
    memoryMB: 1100,
    downloadSizeMB: 550,
    bestFor: ['Langues rares', 'Textes techniques', 'Haute précision']
  },
  'nllb-1.3B': {
    name: 'NLLB 1.3B (1.2GB)',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    description: 'Très haute qualité - pour les textes complexes',
    memoryMB: 2400,
    downloadSizeMB: 1200,
    bestFor: ['Textes complexes', 'Documents professionnels', 'Qualité maximale']
  },
  'nllb-3.3B': {
    name: 'NLLB 3.3B (3.1GB)',
    color: 'bg-orange-200 text-orange-900 border-orange-400',
    description: 'Qualité premium - 200+ langues supportées',
    memoryMB: 6200,
    downloadSizeMB: 3100,
    bestFor: ['Langues exotiques', 'Traduction littéraire', 'Précision maximale']
  },
  'nllb-54B': {
    name: 'NLLB 54B (50GB)',
    color: 'bg-orange-400 text-white border-orange-600',
    description: 'Modèle de recherche - qualité état de l\'art',
    memoryMB: 100000,
    downloadSizeMB: 50000,
    bestFor: ['Recherche', 'Infrastructure cloud', 'Benchmarks']
  }
};

export function UnifiedModelSettings() {
  const [config, setConfig] = useState<ModelConfig>({
    mt5Variant: 'small',
    nllbVariant: 'distilled-600M',
    autoSelectModel: true,
    preloadModels: false,
    maxMemoryUsage: 4096,
  });
  
  const [loadedModels, setLoadedModels] = useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Charger la configuration depuis localStorage
    const savedConfig = localStorage.getItem('meeshy-model-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }

    // Vérifier les modèles chargés
    const savedModels = localStorage.getItem('meeshy-loaded-models');
    if (savedModels) {
      setLoadedModels(JSON.parse(savedModels));
    }
  }, []);

  const handleConfigChange = (key: keyof ModelConfig, value: string | boolean | number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    localStorage.setItem('meeshy-model-config', JSON.stringify(newConfig));
  };

  const formatFileSize = (mb: number): string => {
    if (mb < 1024) return `${mb} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const getMemoryUsage = () => {
    let totalMemory = 0;
    Object.entries(loadedModels).forEach(([modelKey, isLoaded]) => {
      if (isLoaded && MODEL_CONFIGS[modelKey]) {
        totalMemory += MODEL_CONFIGS[modelKey].memoryMB;
      }
    });
    return totalMemory;
  };

  const downloadModel = async (modelKey: string) => {
    setIsLoading(true);
    
    try {
      // Simulation du téléchargement
      for (let progress = 0; progress <= 100; progress += 5) {
        setDownloadProgress(prev => ({ ...prev, [modelKey]: progress }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setLoadedModels(prev => ({ ...prev, [modelKey]: true }));
      localStorage.setItem('meeshy-loaded-models', JSON.stringify({ 
        ...loadedModels, 
        [modelKey]: true 
      }));
      
      toast.success(`Modèle ${MODEL_CONFIGS[modelKey].name} téléchargé avec succès`);
    } catch (error) {
      console.error('Erreur téléchargement modèle:', error);
      toast.error(`Erreur lors du téléchargement du modèle ${MODEL_CONFIGS[modelKey].name}`);
    } finally {
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelKey];
        return newProgress;
      });
      setIsLoading(false);
    }
  };

  const removeModel = (modelKey: string) => {
    setLoadedModels(prev => ({ ...prev, [modelKey]: false }));
    localStorage.setItem('meeshy-loaded-models', JSON.stringify({ 
      ...loadedModels, 
      [modelKey]: false 
    }));
    toast.success(`Modèle ${MODEL_CONFIGS[modelKey].name} supprimé`);
  };

  const downloadAllModels = async () => {
    setIsLoading(true);
    const modelsToDownload = Object.keys(MODEL_CONFIGS).filter(key => !loadedModels[key]);
    
    if (modelsToDownload.length === 0) {
      toast.info('Tous les modèles sont déjà téléchargés');
      setIsLoading(false);
      return;
    }

    try {
      for (const modelKey of modelsToDownload) {
        // Simulation du téléchargement parallèle
        for (let progress = 0; progress <= 100; progress += 10) {
          setDownloadProgress(prev => ({ ...prev, [modelKey]: progress }));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        setLoadedModels(prev => ({ ...prev, [modelKey]: true }));
        toast.success(`${MODEL_CONFIGS[modelKey].name} téléchargé`);
      }
      
      localStorage.setItem('meeshy-loaded-models', JSON.stringify({ 
        ...loadedModels, 
        ...Object.fromEntries(modelsToDownload.map(key => [key, true]))
      }));
      
      toast.success('Tous les modèles ont été téléchargés avec succès');
    } catch (error) {
      console.error('Erreur téléchargement modèles:', error);
      toast.error('Erreur lors du téléchargement des modèles');
    } finally {
      setDownloadProgress({});
      setIsLoading(false);
    }
  };

  const removeAllModels = () => {
    const newLoadedModels = Object.fromEntries(
      Object.keys(MODEL_CONFIGS).map(key => [key, false])
    );
    setLoadedModels(newLoadedModels);
    localStorage.setItem('meeshy-loaded-models', JSON.stringify(newLoadedModels));
    toast.success('Tous les modèles ont été supprimés');
  };

  const memoryUsage = getMemoryUsage();
  const memoryPercentage = Math.min((memoryUsage / config.maxMemoryUsage) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Légende des couleurs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200"></div>
              <span className="text-sm font-medium text-emerald-800">Modèles mT5 (tons verts)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200"></div>
              <span className="text-sm font-medium text-orange-800">Modèles NLLB (tons orange)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="selection" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="selection">Configuration</TabsTrigger>
          <TabsTrigger value="models">Modèles disponibles</TabsTrigger>
          <TabsTrigger value="monitoring">Surveillance</TabsTrigger>
        </TabsList>

        {/* Configuration générale */}
        <TabsContent value="selection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Configuration intelligente
              </CardTitle>
              <CardDescription>
                Paramètres généraux pour l&apos;optimisation automatique
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Sélection automatique</Label>
                  <p className="text-sm text-muted-foreground">
                    Choisit automatiquement le meilleur modèle selon la complexité du texte
                  </p>
                </div>
                <Switch
                  checked={config.autoSelectModel}
                  onCheckedChange={(checked) => handleConfigChange('autoSelectModel', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Préchargement</Label>
                  <p className="text-sm text-muted-foreground">
                    Charge les modèles en mémoire au démarrage pour des traductions plus rapides
                  </p>
                </div>
                <Switch
                  checked={config.preloadModels}
                  onCheckedChange={(checked) => handleConfigChange('preloadModels', checked)}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Limite mémoire maximale</Label>
                <Select
                  value={config.maxMemoryUsage.toString()}
                  onValueChange={(value) => handleConfigChange('maxMemoryUsage', parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2048">2 GB - Appareils légers</SelectItem>
                    <SelectItem value="4096">4 GB - Configuration standard</SelectItem>
                    <SelectItem value="8192">8 GB - Haute performance</SelectItem>
                    <SelectItem value="16384">16 GB - Configuration maximale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!config.autoSelectModel && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-emerald-700">Modèle mT5 (tons verts)</Label>
                    <Select
                      value={config.mt5Variant}
                      onValueChange={(value) => handleConfigChange('mt5Variant', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">mT5 Small - Rapide</SelectItem>
                        <SelectItem value="base">mT5 Base - Équilibré</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-orange-700">Modèle NLLB (tons orange)</Label>
                    <Select
                      value={config.nllbVariant}
                      onValueChange={(value) => handleConfigChange('nllbVariant', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distilled-600M">NLLB 600M - Optimisé</SelectItem>
                        <SelectItem value="1.3B">NLLB 1.3B - Haute qualité</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modèles disponibles */}
        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions globales</CardTitle>
              <CardDescription>
                Gestion de tous les modèles de traduction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  onClick={downloadAllModels}
                  disabled={isLoading || Object.values(loadedModels).every(Boolean)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger tous les modèles
                </Button>
                <Button
                  onClick={removeAllModels}
                  variant="outline"
                  disabled={Object.values(loadedModels).every(v => !v)}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer tous les modèles
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(MODEL_CONFIGS).map(([modelKey, modelInfo]) => {
              const isDownloading = downloadProgress[modelKey] !== undefined;
              const isLoaded = loadedModels[modelKey];

              return (
                <Card key={modelKey} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <Badge className={modelInfo.color} variant="outline">
                          {modelInfo.name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLoaded ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Download className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{modelInfo.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        <span>Mémoire: {formatFileSize(modelInfo.memoryMB)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-muted-foreground" />
                        <span>Taille: {formatFileSize(modelInfo.downloadSizeMB)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Recommandé pour :</Label>
                      <div className="flex flex-wrap gap-1">
                        {modelInfo.bestFor.map((use, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {use}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {isDownloading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Téléchargement...</span>
                          <span>{downloadProgress[modelKey]}%</span>
                        </div>
                        <Progress value={downloadProgress[modelKey]} />
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!isLoaded ? (
                        <Button
                          onClick={() => downloadModel(modelKey)}
                          disabled={isLoading}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger
                        </Button>
                      ) : (
                        <Button
                          onClick={() => removeModel(modelKey)}
                          variant="outline"
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Surveillance */}
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Utilisation des ressources
              </CardTitle>
              <CardDescription>
                Surveillance en temps réel de la mémoire et des performances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-medium">Mémoire utilisée</Label>
                  <span className="text-sm text-muted-foreground">
                    {formatFileSize(memoryUsage)} / {formatFileSize(config.maxMemoryUsage)}
                  </span>
                </div>
                <Progress value={memoryPercentage} className="h-3" />
                {memoryPercentage > 90 && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Mémoire presque saturée - considérez augmenter la limite</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Modèles chargés</Label>
                  <div className="space-y-1">
                    {Object.entries(loadedModels).map(([modelKey, isLoaded]) => (
                      <div key={modelKey} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm">{MODEL_CONFIGS[modelKey]?.name || modelKey}</span>
                        <Badge variant={isLoaded ? "default" : "secondary"}>
                          {isLoaded ? "Actif" : "Arrêté"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Statistiques</Label>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Modèles téléchargés :</span>
                      <span>{Object.values(loadedModels).filter(Boolean).length} / {Object.keys(MODEL_CONFIGS).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sélection auto :</span>
                      <span>{config.autoSelectModel ? "Activée" : "Désactivée"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Préchargement :</span>
                      <span>{config.preloadModels ? "Activé" : "Désactivé"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
