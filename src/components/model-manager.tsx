'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  Trash2, 
  HardDrive, 
  Cpu, 
  Wifi, 
  CheckCircle, 
  AlertCircle,
  Info,
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

export function ModelManager() {
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [cachedModels, setCachedModels] = useState<CachedModelInfo[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [cacheStats, setCacheStats] = useState<{ totalSize: number; totalModels: number } | null>(null);

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    const caps = detectSystemCapabilities();
    setCapabilities(caps);

    const models = await modelCache.getCachedModels();
    setCachedModels(models);

    const stats = await modelCache.getStats();
    setCacheStats(stats);
  };

  const downloadModel = async (family: string, variant: string) => {
    const modelKey = `${family}-${variant}`;
    setIsDownloading(prev => ({ ...prev, [modelKey]: true }));
    setDownloadProgress(prev => ({ ...prev, [modelKey]: 0 }));

    try {
      const modelFamily = MODEL_FAMILIES[family];
      const modelVariant = modelFamily.variants[variant];

      const success = await modelCache.downloadAndCacheModel(
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
      await modelCache.removeModel(family, variant);
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

  if (!capabilities) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Informations système */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Capacités de votre système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">RAM estimée</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(capabilities.estimatedRAM * 1024 * 1024)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Type d&apos;appareil</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {capabilities.deviceType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Connexion</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {capabilities.connectionSpeed}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Modèles recommandés</p>
                <p className="text-xs text-muted-foreground">
                  mT5: {recommendations?.mt5}, NLLB: {recommendations?.nllb}
                </p>
              </div>
            </div>
          </div>
          {recommendations && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 {recommendations.reasoning}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistiques du cache */}
      {cacheStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Cache local
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold">{cacheStats.totalModels}</p>
                <p className="text-sm text-muted-foreground">Modèles en cache</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatFileSize(cacheStats.totalSize)}</p>
                <p className="text-sm text-muted-foreground">Espace utilisé</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gestion des modèles */}
      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="available">Modèles disponibles</TabsTrigger>
          <TabsTrigger value="cached">Modèles en cache</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {Object.entries(MODEL_FAMILIES).map(([familyKey, family]) => (
            <Card key={familyKey}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
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
                      <div key={variantKey} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{variant.size}</h4>
                            {isRecommended && (
                              <Badge variant="default" className="text-xs">
                                Recommandé
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {variant.performance}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {variant.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>📁 {formatFileSize(variant.downloadSize * 1024 * 1024)}</span>
                            <span>🧠 {formatFileSize(variant.memoryRequirement * 1024 * 1024)} RAM</span>
                            <span>⏱️ ~{estimateDownloadTime(variant.downloadSize, capabilities.connectionSpeed)}</span>
                          </div>
                          {downloading && (
                            <div className="mt-2">
                              <Progress value={progress} className="w-full h-2" />
                              <p className="text-xs text-muted-foreground mt-1">
                                Téléchargement... {Math.round(progress)}%
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isCached ? (
                            <>
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeModel(familyKey, variantKey)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => downloadModel(familyKey, variantKey)}
                              disabled={downloading}
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
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="cached" className="space-y-4">
          {cachedModels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun modèle en cache</h3>
                <p className="text-muted-foreground mb-4">
                  Téléchargez des modèles depuis l&apos;onglet &quot;Modèles disponibles&quot; pour commencer
                </p>
              </CardContent>
            </Card>
          ) : (
            cachedModels.map((model) => (
              <Card key={`${model.family}-${model.variant}`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {MODEL_FAMILIES[model.family]?.name} - {model.variant}
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>📁 {formatFileSize(model.fileSize)}</span>
                        <span>📅 {new Date(model.downloadDate).toLocaleDateString()}</span>
                        <span>🏷️ v{model.version}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeModel(model.family, model.variant)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
