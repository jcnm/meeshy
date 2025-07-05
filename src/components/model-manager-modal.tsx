'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  Trash2, 
  HardDrive, 
  Cpu, 
  Wifi, 
  CheckCircle, 
  AlertCircle,
  Settings
} from 'lucide-react';
import { 
  detectSystemCapabilities, 
  recommendModelVariants, 
  MODEL_FAMILIES, 
  estimateDownloadTime,
  type SystemCapabilities 
} from '@/lib/model-config';
import { modelCache, type CachedModelInfo } from '@/lib/model-cache';
import { testModelService } from '@/lib/test-model-service';

// Mode de test
const TEST_MODE = true;

interface ModelManagerModalProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ModelManagerModal({ children, open, onOpenChange }: ModelManagerModalProps) {
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [cachedModels, setCachedModels] = useState<CachedModelInfo[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [cacheStats, setCacheStats] = useState<{ totalSize: number; totalModels: number } | null>(null);

  useEffect(() => {
    if (open) {
      initializeData();
    }
  }, [open]);

  const initializeData = async () => {
    const caps = detectSystemCapabilities();
    setCapabilities(caps);

    // Utiliser le service de test ou le vrai cache
    const cacheService = TEST_MODE ? testModelService : modelCache;
    const models = await cacheService.getCachedModels();
    setCachedModels(models);

    const stats = await cacheService.getStats();
    setCacheStats(stats);
  };

  const downloadModel = async (family: string, variant: string) => {
    const modelKey = `${family}-${variant}`;
    setIsDownloading(prev => ({ ...prev, [modelKey]: true }));
    setDownloadProgress(prev => ({ ...prev, [modelKey]: 0 }));

    try {
      const modelFamily = MODEL_FAMILIES[family];
      const modelVariant = modelFamily.variants[variant];

      // Utiliser le service de test ou le vrai cache
      const cacheService = TEST_MODE ? testModelService : modelCache;
      
      const success = await cacheService.downloadAndCacheModel(
        family,
        variant,
        modelVariant.modelUrl,
        modelVariant.tokenizerUrl,
        (progress) => {
          setDownloadProgress(prev => ({ ...prev, [modelKey]: progress }));
        }
      );

      if (success) {
        await initializeData(); // Refresh data
        console.log(`✅ Modèle ${family}-${variant} téléchargé avec succès`);
      } else {
        console.error(`❌ Échec du téléchargement de ${family}-${variant}`);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
    } finally {
      setIsDownloading(prev => ({ ...prev, [modelKey]: false }));
      setDownloadProgress(prev => ({ ...prev, [modelKey]: 0 }));
    }
  };

  const removeModel = async (family: string, variant: string) => {
    try {
      // Utiliser le service de test ou le vrai cache
      const cacheService = TEST_MODE ? testModelService : modelCache;
      await cacheService.removeModel(family, variant);
      await initializeData(); // Refresh data
      console.log(`🗑️ Modèle ${family}-${variant} supprimé`);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  };

  const isModelCached = (family: string, variant: string) => {
    return cachedModels.some(m => m.family === family && m.variant === variant);
  };

  const getRecommendations = () => {
    if (!capabilities) return null;
    return recommendModelVariants(capabilities);
  };

  const recommendations = getRecommendations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-7xl w-[98vw] max-h-[95vh] flex flex-col sm:max-w-6xl md:max-w-7xl lg:max-w-[90vw] xl:max-w-7xl">
        <DialogHeader className="pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Gestion des Modèles de Traduction
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-2 sm:pr-4 overflow-y-auto min-h-0"
          style={{ maxHeight: 'calc(95vh - 100px)' }}>
          <div className="space-y-4 sm:space-y-6 pb-6">
            {/* Informations système */}
            {capabilities && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">RAM estimée</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(capabilities.estimatedRAM * 1024 * 1024)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Type d&apos;appareil</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {capabilities.deviceType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-purple-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Connexion</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {capabilities.connectionSpeed}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Recommandés</p>
                      <p className="text-xs text-muted-foreground">
                        mT5: {recommendations?.mt5}, NLLB: {recommendations?.nllb}
                      </p>
                    </div>
                  </div>
                  {/* Ajout d'informations supplémentaires */}
                  {cacheStats && (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Modèles en cache</p>
                          <p className="text-xs text-muted-foreground">
                            {cacheStats.totalModels} modèles
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Espace utilisé</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(cacheStats.totalSize)}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {recommendations && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      💡 <strong>Recommandation:</strong> {recommendations.reasoning}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Gestion des modèles */}
            <Tabs defaultValue="available" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="available">Modèles disponibles</TabsTrigger>
                <TabsTrigger value="cached">Modèles en cache ({cachedModels.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="available" className="space-y-4 mt-4">
                {Object.entries(MODEL_FAMILIES).map(([familyKey, family]) => (
                  <div key={familyKey} className="border rounded-lg p-4 lg:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{family.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Pour {family.purpose === 'simple' ? 'messages simples' : 'messages complexes'} 
                          (max {family.maxTokens} tokens)
                        </p>
                      </div>
                      <Badge variant={family.type === 'mt5' ? 'default' : 'secondary'}>
                        {family.type.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {Object.entries(family.variants).map(([variantKey, variant]) => {
                        const isRecommended = recommendations && (
                          (familyKey === 'mt5' && variantKey === recommendations.mt5) ||
                          (familyKey === 'nllb' && variantKey === recommendations.nllb)
                        );
                        const isCached = isModelCached(familyKey, variantKey);
                        const modelKey = `${familyKey}-${variantKey}`;
                        const downloading = isDownloading[modelKey];
                        const progress = downloadProgress[modelKey] || 0;

                        return (
                          <div key={variantKey} className="flex items-center justify-between p-4 border rounded-md hover:bg-muted/30 transition-colors">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-medium">{variant.size}</h4>
                                {isRecommended && (
                                  <Badge variant="default" className="text-xs">
                                    ⭐ Recommandé
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {variant.performance}
                                </Badge>
                                {isCached && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    ✓ En cache
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {variant.description}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  📁 {formatFileSize(variant.downloadSize * 1024 * 1024)}
                                </span>
                                <span className="flex items-center gap-1">
                                  🧠 {formatFileSize(variant.memoryRequirement * 1024 * 1024)} RAM
                                </span>
                                <span className="flex items-center gap-1">
                                  ⏱️ ~{estimateDownloadTime(variant.downloadSize, capabilities?.connectionSpeed || 'fast')}
                                </span>
                              </div>
                              {downloading && (
                                <div className="mt-3">
                                  <Progress value={progress} className="w-full h-2" />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Téléchargement... {Math.round(progress)}%
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isCached ? (
                                <>
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeModel(familyKey, variantKey)}
                                    className="hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => downloadModel(familyKey, variantKey)}
                                  disabled={downloading}
                                  className="whitespace-nowrap"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Télécharger
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="cached" className="space-y-4 mt-4">
                {cachedModels.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucun modèle en cache</h3>
                    <p className="text-muted-foreground">
                      Téléchargez des modèles depuis l&apos;onglet &quot;Modèles disponibles&quot; pour commencer
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {cachedModels.map((model) => (
                      <div key={`${model.family}-${model.variant}`} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="font-medium">
                            {MODEL_FAMILIES[model.family]?.name} - {model.variant}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              📁 {formatFileSize(model.fileSize)}
                            </span>
                            <span className="flex items-center gap-1">
                              📅 {new Date(model.downloadDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              🏷️ v{model.version}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeModel(model.family, model.variant)}
                          className="hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default ModelManagerModal;
