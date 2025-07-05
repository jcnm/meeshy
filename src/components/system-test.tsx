'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cpu, HardDrive, Wifi, Monitor, CheckCircle, Download } from 'lucide-react';
import { SystemSpecs, ModelRecommendation, systemDetection } from '@/lib/system-detection';
import { MODEL_FAMILIES } from '@/lib/model-config';
import { toast } from 'sonner';

export function SystemTest() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [recommendations, setRecommendations] = useState<ModelRecommendation | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  const runSystemTest = async () => {
    setIsAnalyzing(true);
    
    try {
      const systemSpecs = await systemDetection.analyzeSystem();
      const modelRec = systemDetection.recommendModels(systemSpecs);
      
      setSpecs(systemSpecs);
      setRecommendations(modelRec);
      
      toast.success('Analyse système terminée !');
    } catch (error) {
      console.error('Erreur analyse système:', error);
      toast.error('Erreur lors de l\'analyse du système');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const mapModelToVariant = (family: 'mt5' | 'nllb', modelName: string): string => {
    const mappings: Record<string, Record<string, string>> = {
      mt5: {
        'MT5_SMALL': 'small',
        'MT5_BASE': 'base',
        'MT5_LARGE': 'large',
        'MT5_XL': 'xl'
      },
      nllb: {
        'NLLB_200M': 'distilled-600M',
        'NLLB_DISTILLED_600M': 'distilled-600M',
        'NLLB_1_3B': '1.3B'
      }
    };

    return mappings[family][modelName] || Object.keys(MODEL_FAMILIES[family].variants)[0];
  };

  const getModelVariant = (family: 'mt5' | 'nllb', variant: string) => {
    return MODEL_FAMILIES[family].variants[variant];
  };

  const downloadModel = async (family: 'mt5' | 'nllb', variant: string) => {
    const modelKey = `${family}-${variant}`;
    
    try {
      // Simulation du téléchargement
      for (let progress = 0; progress <= 100; progress += 5) {
        setDownloadProgress(prev => ({ ...prev, [modelKey]: progress }));
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      
      // Marquer comme téléchargé
      const currentModels = JSON.parse(localStorage.getItem('meeshy-loaded-models') || '{}');
      currentModels[modelKey] = true;
      localStorage.setItem('meeshy-loaded-models', JSON.stringify(currentModels));
      
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
    }
  };

  const getPerformanceColor = (score: number): string => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-blue-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = (score: number): string => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Bon';
    if (score >= 4) return 'Moyen';
    return 'Limité';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Test des capacités système
          </CardTitle>
          <CardDescription>
            Analysez votre appareil pour obtenir des recommandations de modèles optimisées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runSystemTest} 
            disabled={isAnalyzing}
            className="w-full sm:w-auto"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              'Analyser le système'
            )}
          </Button>

          {specs && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Appareil */}
                <Card>
                  <CardContent className="p-4 text-center">
                    <Cpu className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <h3 className="font-medium mb-1">Appareil</h3>
                    <p className="text-sm text-muted-foreground capitalize">{specs.deviceType}</p>
                    <p className="text-xs text-muted-foreground">{specs.platform}</p>
                  </CardContent>
                </Card>

                {/* Mémoire */}
                <Card>
                  <CardContent className="p-4 text-center">
                    <HardDrive className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <h3 className="font-medium mb-1">Mémoire</h3>
                    <p className="text-sm text-muted-foreground">{specs.memoryGB} GB RAM</p>
                    <p className="text-xs text-muted-foreground">{specs.cores} cœurs CPU</p>
                  </CardContent>
                </Card>

                {/* Connexion */}
                <Card>
                  <CardContent className="p-4 text-center">
                    <Wifi className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <h3 className="font-medium mb-1">Connexion</h3>
                    <p className="text-sm text-muted-foreground">
                      ↓{specs.connectionSpeed.downloadMbps.toFixed(1)} Mbps
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {specs.connectionSpeed.latency.toFixed(0)} ms latence
                    </p>
                  </CardContent>
                </Card>

                {/* Performance */}
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="mx-auto mb-2 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">
                        {specs.performanceScore.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="font-medium mb-1">Performance</h3>
                    <p className={`text-sm font-medium ${getPerformanceColor(specs.performanceScore)}`}>
                      {getPerformanceLabel(specs.performanceScore)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {specs.hasGPU ? 'GPU détecté' : 'Pas de GPU'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Spécifications détaillées */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Spécifications détaillées</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {Object.entries(systemDetection.formatSpecs(specs)).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {recommendations && specs && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommandations de modèles</CardTitle>
                <CardDescription>
                  {recommendations.reasoning}
                  <Badge variant="outline" className="ml-2">
                    Confiance: {Math.round(recommendations.confidence * 100)}%
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Modèle MT5 recommandé */}
                {(() => {
                  const mt5Variant = mapModelToVariant('mt5', recommendations.mt5Model);
                  const mt5Model = getModelVariant('mt5', mt5Variant);
                  const mt5Key = `mt5-${mt5Variant}`;
                  const loadedModels = JSON.parse(localStorage.getItem('meeshy-loaded-models') || '{}');
                  const isLoaded = loadedModels[mt5Key];
                  const progress = downloadProgress[mt5Key];

                  return (
                    <Card className="border-green-200 bg-green-50/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">MT5 {mt5Model?.size.toUpperCase()}</h4>
                              <Badge variant="default">Recommandé</Badge>
                              {isLoaded && <CheckCircle className="h-4 w-4 text-green-600" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{mt5Model?.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Taille: {formatFileSize((mt5Model?.downloadSize || 0) * 1024 * 1024)}</span>
                              <span>RAM: {formatFileSize((mt5Model?.memoryRequirement || 0) * 1024 * 1024)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {progress !== undefined ? (
                              <div className="text-center">
                                <Loader2 className="h-4 w-4 animate-spin mb-1" />
                                <span className="text-xs">{progress}%</span>
                              </div>
                            ) : !isLoaded ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadModel('mt5', mt5Variant)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Télécharger
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Modèle NLLB recommandé */}
                {(() => {
                  const nllbVariant = mapModelToVariant('nllb', recommendations.nllbModel);
                  const nllbModel = getModelVariant('nllb', nllbVariant);
                  const nllbKey = `nllb-${nllbVariant}`;
                  const loadedModels = JSON.parse(localStorage.getItem('meeshy-loaded-models') || '{}');
                  const isLoaded = loadedModels[nllbKey];
                  const progress = downloadProgress[nllbKey];

                  return (
                    <Card className="border-green-200 bg-green-50/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">NLLB {nllbModel?.size}</h4>
                              <Badge variant="default">Recommandé</Badge>
                              {isLoaded && <CheckCircle className="h-4 w-4 text-green-600" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{nllbModel?.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Taille: {formatFileSize((nllbModel?.downloadSize || 0) * 1024 * 1024)}</span>
                              <span>RAM: {formatFileSize((nllbModel?.memoryRequirement || 0) * 1024 * 1024)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {progress !== undefined ? (
                              <div className="text-center">
                                <Loader2 className="h-4 w-4 animate-spin mb-1" />
                                <span className="text-xs">{progress}%</span>
                              </div>
                            ) : !isLoaded ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadModel('nllb', nllbVariant)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Télécharger
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
