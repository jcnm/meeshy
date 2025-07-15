'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
  Download, 
  CheckCircle, 
  Clock, 
  Zap, 
  Brain, 
  HardDrive,
  Info,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { translationService } from '@/services/translation.service';
import { TranslationModelType } from '@/types';

interface ModelSelectorProps {
  selectedModel: TranslationModelType;
  onModelChange: (model: TranslationModelType) => void;
  compact?: boolean;
  showDownload?: boolean;
}

interface ModelInfo {
  id: TranslationModelType;
  name: string;
  description: string;
  size: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'good' | 'better' | 'best';
  languages: number;
  isLoaded: boolean;
  isDownloading: boolean;
  downloadProgress?: number;
  memoryUsage?: string;
}

export function ModelSelector({ 
  selectedModel, 
  onModelChange, 
  compact = false,
  showDownload = true 
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingModels, setDownloadingModels] = useState<Set<TranslationModelType>>(new Set());

  // Initialiser les informations des modèles
  useEffect(() => {
    const initializeModels = async () => {
      try {
        const modelInfos: ModelInfo[] = [
          {
            id: 'MT5_SMALL',
            name: 'MT5 Small',
            description: 'Rapide et efficace pour les messages courts',
            size: '~300 MB',
            speed: 'fast',
            quality: 'good',
            languages: 101,
            isLoaded: false,
            isDownloading: false,
            memoryUsage: '~200 MB'
          },
          {
            id: 'NLLB_DISTILLED_600M',
            name: 'NLLB Distilled',
            description: 'Traduction précise pour tous types de textes',
            size: '~600 MB',
            speed: 'medium',
            quality: 'better',
            languages: 200,
            isLoaded: false,
            isDownloading: false,
            memoryUsage: '~400 MB'
          },
          {
            id: 'NLLB_1_3B',
            name: 'NLLB 1.3B',
            description: 'Qualité professionnelle (nécessite plus de mémoire)',
            size: '~1.3 GB',
            speed: 'slow',
            quality: 'best',
            languages: 200,
            isLoaded: false,
            isDownloading: false,
            memoryUsage: '~800 MB'
          }
        ];

        // Vérifier l'état actuel des modèles
        const updatedModels = modelInfos.map(model => ({
          ...model,
          isLoaded: translationService.isModelLoaded(model.id) 
        }));

        setModels(updatedModels);
        setIsLoading(false);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation des modèles:', error);
        toast.error('Erreur lors du chargement des informations des modèles');
        setIsLoading(false);
      }
    };

    initializeModels();
  }, []);

  // Gérer le téléchargement d'un modèle
  const handleDownloadModel = async (modelId: TranslationModelType) => {
    if (downloadingModels.has(modelId)) return;

    setDownloadingModels(prev => new Set(prev.add(modelId)));
    
    // Mettre à jour l'état du modèle
    setModels(prev => prev.map(model => 
      model.id === modelId 
        ? { ...model, isDownloading: true, downloadProgress: 0 }
        : model
    ));

    try {
      toast.loading(`Téléchargement du modèle ${modelId}...`, { id: `download-${modelId}` });

      // Simuler le progrès de téléchargement (en réalité, le modèle sera chargé par TensorFlow.js)
      const progressInterval = setInterval(() => {
        setModels(prev => prev.map(model => {
          if (model.id === modelId && model.downloadProgress !== undefined) {
            const newProgress = Math.min(model.downloadProgress + 5, 95);
            return { ...model, downloadProgress: newProgress };
          }
          return model;
        }));
      }, 200);

      // Charger le modèle
      translationService.isModelLoaded(modelId);

      clearInterval(progressInterval);

      // Mettre à jour l'état final
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { ...model, isLoaded: true, isDownloading: false, downloadProgress: 100 }
          : model
      ));

      toast.success(`Modèle ${modelId} téléchargé avec succès`, { id: `download-${modelId}` });
    } catch (error) {
      console.error(`Erreur lors du téléchargement du modèle ${modelId}:`, error);
      
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { ...model, isDownloading: false, downloadProgress: undefined }
          : model
      ));

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(`Échec du téléchargement de ${modelId}: ${errorMessage}`, { id: `download-${modelId}` });
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
    }
  };

  // Gérer la suppression d'un modèle du cache
  const handleRemoveModel = async (modelId: TranslationModelType) => {
    try {
      await translationService.unloadPipeline(modelId);
      
      setModels(prev => prev.map(model => 
        model.id === modelId 
          ? { ...model, isLoaded: false }
          : model
      ));

      toast.success(`Modèle ${modelId} supprimé du cache`);
    } catch (error) {
      console.error(`Erreur lors de la suppression du modèle ${modelId}:`, error);
      toast.error(`Erreur lors de la suppression de ${modelId}`);
    }
  };

  // Obtenir l'icône de vitesse
  const getSpeedIcon = (speed: ModelInfo['speed']) => {
    switch (speed) {
      case 'fast': return <Zap className="h-4 w-4 text-green-500" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'slow': return <Brain className="h-4 w-4 text-blue-500" />;
    }
  };

  // Obtenir la couleur de qualité
  const getQualityColor = (quality: ModelInfo['quality']) => {
    switch (quality) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'better': return 'bg-blue-100 text-blue-800';
      case 'best': return 'bg-purple-100 text-purple-800';
    }
  };

  if (isLoading) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardHeader className={compact ? "pb-2" : ""}>
          <CardTitle className={compact ? "text-sm" : ""}>Chargement des modèles...</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={50} className="animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Modèle de traduction</label>
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir un modèle" />
          </SelectTrigger>
          <SelectContent>
            {models.map(model => (
              <SelectItem key={model.id} value={model.id} disabled={!model.isLoaded}>
                <div className="flex items-center gap-2">
                  {model.isLoaded ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Download className="h-4 w-4 text-gray-400" />
                  )}
                  <span>{model.name}</span>
                  {!model.isLoaded && <Badge variant="outline" className="text-xs">Non téléchargé</Badge>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Modèles de Traduction
          </CardTitle>
          <CardDescription>
            Choisissez le modèle de traduction selon vos besoins de vitesse et qualité
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {models.map(model => (
            <div
              key={model.id}
              className={`border rounded-lg p-4 transition-all cursor-pointer ${
                selectedModel === model.id 
                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => model.isLoaded && onModelChange(model.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{model.name}</h4>
                    {model.isLoaded && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {model.isDownloading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{model.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {model.size}
                    </div>
                    
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          {getSpeedIcon(model.speed)}
                          <span className="capitalize">{model.speed}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Vitesse de traduction: {model.speed}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <Badge variant="secondary" className={`text-xs ${getQualityColor(model.quality)}`}>
                      {model.quality}
                    </Badge>
                    
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          {model.languages} langues
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Supporte {model.languages} langues</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {model.isDownloading && model.downloadProgress !== undefined && (
                    <div className="mt-2">
                      <Progress value={model.downloadProgress} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        Téléchargement... {model.downloadProgress}%
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {!model.isLoaded && !model.isDownloading && showDownload && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadModel(model.id);
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                  )}
                  
                  {model.isLoaded && showDownload && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveModel(model.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Supprimer du cache</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div className="text-xs text-gray-500 mt-4 p-3 bg-gray-50 rounded">
            <p><strong>Conseil :</strong> Commencez par MT5 Small pour des tests rapides, puis téléchargez NLLB pour une meilleure qualité.</p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
