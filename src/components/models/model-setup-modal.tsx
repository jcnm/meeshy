'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, Download, AlertTriangle, Brain, Cpu, HardDrive, Wifi } from 'lucide-react';
import { SystemSpecs, ModelRecommendation, systemDetection } from '@/lib/system-detection';
import { MODEL_FAMILIES } from '@/lib/model-config';
import { toast } from 'sonner';

interface ModelSetupModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function ModelSetupModal({ isOpen, onOpenChange, onComplete }: ModelSetupModalProps) {
  const [step, setStep] = useState<'analyzing' | 'recommendations' | 'downloading'>('analyzing');
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [recommendations, setRecommendations] = useState<ModelRecommendation | null>(null);
  const [selectedModels, setSelectedModels] = useState<{mt5: string, nllb: string}>({ mt5: '', nllb: '' });
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen && step === 'analyzing') {
      analyzeSystemAndRecommend();
    }
  }, [isOpen, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyzeSystemAndRecommend = async () => {
    try {
      const systemSpecs = await systemDetection.analyzeSystem();
      const modelRec = systemDetection.recommendModels(systemSpecs);
      
      setSpecs(systemSpecs);
      setRecommendations(modelRec);
      
      // Mapper les recommandations aux variantes disponibles
      const mt5Variant = mapModelToVariant('mt5', modelRec.mt5Model);
      const nllbVariant = mapModelToVariant('nllb', modelRec.nllbModel);
      
      setSelectedModels({ 
        mt5: mt5Variant, 
        nllb: nllbVariant 
      });
      
      setStep('recommendations');
    } catch (error) {
      console.error('Erreur analyse système:', error);
      toast.error('Erreur lors de l\'analyse du système');
      
      // Fallback vers des modèles par défaut
      setSelectedModels({ mt5: 'small', nllb: 'distilled-600M' });
      setStep('recommendations');
    }
  };

  const mapModelToVariant = (family: 'mt5' | 'nllb', modelName: string): string => {
    const variants = MODEL_FAMILIES[family].variants;
    
    // Mapping des noms de modèles vers les variantes
    const mappings: Record<string, Record<string, string>> = {
      mt5: {
        'MT5_SMALL': 'small',
        'MT5_BASE': 'base',
        'MT5_LARGE': 'large',
        'MT5_XL': 'xl'
      },
      nllb: {
        'NLLB_200M': 'distilled-600M', // Utiliser le plus petit disponible
        'NLLB_DISTILLED_600M': 'distilled-600M',
        'NLLB_1_3B': '1.3B'
      }
    };

    return mappings[family][modelName] || Object.keys(variants)[0];
  };

  const getModelVariant = (family: 'mt5' | 'nllb', variant: string) => {
    return MODEL_FAMILIES[family].variants[variant];
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const downloadModels = async () => {
    setIsDownloading(true);
    setStep('downloading');

    try {
      const modelsToDownload = [
        { family: 'mt5' as const, variant: selectedModels.mt5 },
        { family: 'nllb' as const, variant: selectedModels.nllb }
      ];

      for (const { family, variant } of modelsToDownload) {
        const modelKey = `${family}-${variant}`;
        
        // Simulation du téléchargement
        for (let progress = 0; progress <= 100; progress += 5) {
          setDownloadProgress(prev => ({ ...prev, [modelKey]: progress }));
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        
        // Marquer comme téléchargé
        const currentModels = JSON.parse(localStorage.getItem('meeshy-loaded-models') || '{}');
        currentModels[modelKey] = true;
        localStorage.setItem('meeshy-loaded-models', JSON.stringify(currentModels));
      }

      toast.success('Modèles téléchargés avec succès !');
      onComplete();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      toast.error('Erreur lors du téléchargement des modèles');
    } finally {
      setIsDownloading(false);
    }
  };

  const skipSetup = () => {
    onComplete();
    onOpenChange(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Configuration des modèles de traduction
          </DialogTitle>
          <DialogDescription>
            Analysons votre système pour recommander les meilleurs modèles
          </DialogDescription>
        </DialogHeader>

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <h3 className="text-lg font-medium">Analyse de votre système...</h3>
            <p className="text-sm text-muted-foreground text-center">
              Détection des capacités de votre appareil pour optimiser les performances
            </p>
          </div>
        )}

        {step === 'recommendations' && specs && recommendations && (
          <div className="space-y-6">
            {/* Spécifications système */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Cpu className="h-4 w-4" />
                  Spécifications détectées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{specs.deviceType}</p>
                      <p className="text-muted-foreground">{specs.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{specs.memoryGB} GB RAM</p>
                      <p className="text-muted-foreground">{specs.cores} cœurs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{specs.connectionSpeed.downloadMbps.toFixed(1)} Mbps</p>
                      <p className="text-muted-foreground">Téléchargement</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Score: {specs.performanceScore.toFixed(1)}/10</p>
                      <p className="text-muted-foreground">Performance</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommandations */}
            <Card>
              <CardHeader>
                <CardTitle>Modèles recommandés</CardTitle>
                <CardDescription>
                  {recommendations.reasoning}
                  <Badge variant="outline" className="ml-2">
                    Confiance: {Math.round(recommendations.confidence * 100)}%
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Modèle MT5 */}
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            MT5 {getModelVariant('mt5', selectedModels.mt5)?.size.toUpperCase()}
                          </h4>
                          <Badge variant="default">Recommandé</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getModelVariant('mt5', selectedModels.mt5)?.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Taille: {formatFileSize((getModelVariant('mt5', selectedModels.mt5)?.downloadSize || 0) * 1024 * 1024)}
                          </span>
                          <span>
                            RAM: {formatFileSize((getModelVariant('mt5', selectedModels.mt5)?.memoryRequirement || 0) * 1024 * 1024)}
                          </span>
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                {/* Modèle NLLB */}
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            NLLB {getModelVariant('nllb', selectedModels.nllb)?.size}
                          </h4>
                          <Badge variant="default">Recommandé</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getModelVariant('nllb', selectedModels.nllb)?.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Taille: {formatFileSize((getModelVariant('nllb', selectedModels.nllb)?.downloadSize || 0) * 1024 * 1024)}
                          </span>
                          <span>
                            RAM: {formatFileSize((getModelVariant('nllb', selectedModels.nllb)?.memoryRequirement || 0) * 1024 * 1024)}
                          </span>
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-800">
                    Taille totale: {formatFileSize(
                      ((getModelVariant('mt5', selectedModels.mt5)?.downloadSize || 0) +
                       (getModelVariant('nllb', selectedModels.nllb)?.downloadSize || 0)) * 1024 * 1024
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={skipSetup}>
                Ignorer pour le moment
              </Button>
              <Button onClick={downloadModels} disabled={isDownloading}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger les modèles
              </Button>
            </div>
          </div>
        )}

        {step === 'downloading' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Téléchargement en cours...</h3>
              <p className="text-sm text-muted-foreground">
                Les modèles sont téléchargés et optimisés pour votre appareil
              </p>
            </div>

            <div className="space-y-4">
              {/* Progression MT5 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      MT5 {getModelVariant('mt5', selectedModels.mt5)?.size.toUpperCase()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {downloadProgress[`mt5-${selectedModels.mt5}`] || 0}%
                    </span>
                  </div>
                  <Progress value={downloadProgress[`mt5-${selectedModels.mt5}`] || 0} className="h-2" />
                </CardContent>
              </Card>

              {/* Progression NLLB */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      NLLB {getModelVariant('nllb', selectedModels.nllb)?.size}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {downloadProgress[`nllb-${selectedModels.nllb}`] || 0}%
                    </span>
                  </div>
                  <Progress value={downloadProgress[`nllb-${selectedModels.nllb}`] || 0} className="h-2" />
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
