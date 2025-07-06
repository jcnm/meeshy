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
import { MODEL_FAMILIES, ModelVariant } from '@/lib/model-config';
import { Brain, Download, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ModelLegend } from './model-legend';
import { SystemTest } from './system-test';

interface ModelConfig {
  mt5Variant: string;
  nllbVariant: string;
  autoSelectModel: boolean;
  preloadModels: boolean;
  maxMemoryUsage: number;
}

export function ModelSettings() {
  const [config, setConfig] = useState<ModelConfig>({
    mt5Variant: 'small',
    nllbVariant: 'distilled-600M',
    autoSelectModel: true,
    preloadModels: false,
    maxMemoryUsage: 4096,
  });
  
  const [loadedModels, setLoadedModels] = useState<Record<string, boolean>>({
    'mt5-small': false,
    'mt5-base': false,
    'nllb-distilled-600M': false,
    'nllb-1.3B': false,
  });
  
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

  const getModelVariant = (family: 'mt5' | 'nllb', variant: string): ModelVariant | null => {
    const modelFamily = family === 'mt5' ? MODEL_FAMILIES.mt5 : MODEL_FAMILIES.nllb;
    return modelFamily?.variants[variant] || null;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getMemoryUsage = () => {
    const mt5Variant = getModelVariant('mt5', config.mt5Variant);
    const nllbVariant = getModelVariant('nllb', config.nllbVariant);
    
    let totalMemory = 0;
    if (loadedModels[`mt5-${config.mt5Variant}`] && mt5Variant) {
      totalMemory += mt5Variant.memoryRequirement;
    }
    if (loadedModels[`nllb-${config.nllbVariant}`] && nllbVariant) {
      totalMemory += nllbVariant.memoryRequirement;
    }
    
    return totalMemory;
  };

  const downloadModel = async (family: 'mt5' | 'nllb', variant: string) => {
    const modelKey = `${family}-${variant}`;
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
      
      toast.success(`Modèle ${modelKey} téléchargé avec succès`);
    } catch (error) {
      console.error('Erreur téléchargement modèle:', error);
      toast.error(`Erreur lors du téléchargement du modèle ${modelKey}`);
    } finally {
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelKey];
        return newProgress;
      });
      setIsLoading(false);
    }
  };

  const removeModel = (family: 'mt5' | 'nllb', variant: string) => {
    const modelKey = `${family}-${variant}`;
    setLoadedModels(prev => ({ ...prev, [modelKey]: false }));
    localStorage.setItem('meeshy-loaded-models', JSON.stringify({ 
      ...loadedModels, 
      [modelKey]: false 
    }));
    toast.success(`Modèle ${modelKey} supprimé`);
  };

  const memoryUsage = getMemoryUsage();
  const memoryPercentage = (memoryUsage / config.maxMemoryUsage) * 100;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Brain className="h-4 w-4 sm:h-5 sm:w-5" />
            Configuration des modèles IA
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Gérez les modèles de traduction et leurs paramètres
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 flex-1">
              <Label className="text-sm sm:text-base">Sélection automatique du modèle</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Choisit automatiquement le meilleur modèle selon la complexité du texte
              </p>
            </div>
            <Switch
              checked={config.autoSelectModel}
              onCheckedChange={(checked) => handleConfigChange('autoSelectModel', checked)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 flex-1">
              <Label className="text-sm sm:text-base">Préchargement des modèles</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Charge les modèles en mémoire au démarrage pour des traductions plus rapides
              </p>
            </div>
            <Switch
              checked={config.preloadModels}
              onCheckedChange={(checked) => handleConfigChange('preloadModels', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Limite mémoire maximale (MB)</Label>
            <Select
              value={config.maxMemoryUsage.toString()}
              onValueChange={(value) => handleConfigChange('maxMemoryUsage', parseInt(value))}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2048">2 GB</SelectItem>
                <SelectItem value="4096">4 GB</SelectItem>
                <SelectItem value="8192">8 GB</SelectItem>
                <SelectItem value="16384">16 GB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Utilisation mémoire</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Mémoire utilisée par les modèles chargés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between text-sm">
              <span>Utilisation actuelle</span>
              <span>{formatFileSize(memoryUsage * 1024 * 1024)} / {formatFileSize(config.maxMemoryUsage * 1024 * 1024)}</span>
            </div>
            <Progress value={memoryPercentage} className="h-2" />
            {memoryPercentage > 80 && (
              <div className="flex items-center gap-2 p-2 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs sm:text-sm text-amber-800">Utilisation mémoire élevée</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="system-test" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto">
          <TabsTrigger value="system-test" className="text-xs sm:text-sm">Test Système</TabsTrigger>
          <TabsTrigger value="mt5" className="text-xs sm:text-sm">MT5 (Textes simples)</TabsTrigger>
          <TabsTrigger value="nllb" className="text-xs sm:text-sm">NLLB (Textes complexes)</TabsTrigger>
          <TabsTrigger value="legend" className="text-xs sm:text-sm">Référence des Modèles</TabsTrigger>
        </TabsList>

        <TabsContent value="system-test" className="space-y-4">
          <SystemTest />
        </TabsContent>

        <TabsContent value="mt5" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modèle MT5</CardTitle>
              <CardDescription>
                Optimisé pour les messages courts et simples (≤ 100 caractères)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Variante du modèle</Label>
                <Select
                  value={config.mt5Variant}
                  onValueChange={(value) => handleConfigChange('mt5Variant', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODEL_FAMILIES.mt5.variants).map(([key, variant]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center justify-between w-full">
                          <span>{variant.size.toUpperCase()}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant="outline">{variant.performance}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(variant.downloadSize * 1024 * 1024)}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {Object.entries(MODEL_FAMILIES.mt5.variants).map(([key, variant]) => {
                const modelKey = `mt5-${key}`;
                const isLoaded = loadedModels[modelKey];
                const progress = downloadProgress[modelKey];
                
                return (
                  <Card key={key} className={key === config.mt5Variant ? "border-blue-200 bg-blue-50/50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">MT5 {variant.size.toUpperCase()}</h4>
                            <Badge variant={variant.performance === 'fast' ? 'default' : variant.performance === 'balanced' ? 'secondary' : 'outline'}>
                              {variant.performance}
                            </Badge>
                            {isLoaded && <CheckCircle className="h-4 w-4 text-green-600" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{variant.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Taille: {formatFileSize(variant.downloadSize * 1024 * 1024)}</span>
                            <span>RAM: {formatFileSize(variant.memoryRequirement * 1024 * 1024)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {progress !== undefined ? (
                            <div className="w-24">
                              <Progress value={progress} className="h-2" />
                              <span className="text-xs text-muted-foreground">{progress}%</span>
                            </div>
                          ) : isLoaded ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeModel('mt5', key)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadModel('mt5', key)}
                              disabled={isLoading}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nllb" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modèle NLLB</CardTitle>
              <CardDescription>
                Optimisé pour les textes longs et complexes (&gt; 100 caractères)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Variante du modèle</Label>
                <Select
                  value={config.nllbVariant}
                  onValueChange={(value) => handleConfigChange('nllbVariant', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODEL_FAMILIES.nllb.variants).map(([key, variant]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center justify-between w-full">
                          <span>{variant.size}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant="outline">{variant.performance}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(variant.downloadSize * 1024 * 1024)}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {Object.entries(MODEL_FAMILIES.nllb.variants).map(([key, variant]) => {
                const modelKey = `nllb-${key}`;
                const isLoaded = loadedModels[modelKey];
                const progress = downloadProgress[modelKey];
                
                return (
                  <Card key={key} className={key === config.nllbVariant ? "border-blue-200 bg-blue-50/50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">NLLB {variant.size}</h4>
                            <Badge variant={variant.performance === 'fast' ? 'default' : variant.performance === 'balanced' ? 'secondary' : 'outline'}>
                              {variant.performance}
                            </Badge>
                            {isLoaded && <CheckCircle className="h-4 w-4 text-green-600" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{variant.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Taille: {formatFileSize(variant.downloadSize * 1024 * 1024)}</span>
                            <span>RAM: {formatFileSize(variant.memoryRequirement * 1024 * 1024)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {progress !== undefined ? (
                            <div className="w-24">
                              <Progress value={progress} className="h-2" />
                              <span className="text-xs text-muted-foreground">{progress}%</span>
                            </div>
                          ) : isLoaded ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeModel('nllb', key)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadModel('nllb', key)}
                              disabled={isLoading}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legend" className="space-y-4">
          <ModelLegend />
        </TabsContent>
      </Tabs>
    </div>
  );
}
