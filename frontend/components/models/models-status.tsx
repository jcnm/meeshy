'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { translationModels } from '@/lib/translation-models';
import { Loader2, Download, CheckCircle, AlertCircle, Globe, Cpu, Wifi } from 'lucide-react';

interface ModelsStatusProps {
  className?: string;
}

export function ModelsStatus({ className }: ModelsStatusProps) {
  const [modelsStatus, setModelsStatus] = useState<Record<string, { loaded: boolean; loading: boolean }>>({});
  const [isPreloading, setIsPreloading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  // Vérifier l'état des modèles périodiquement
  useEffect(() => {
    const updateStatus = () => {
      const allModels = translationModels.getAllAvailableModels();
      const status: Record<string, { loaded: boolean; loading: boolean }> = {};
      
      allModels.forEach(modelType => {
        const modelKey = translationModels.getModelKey(modelType);
        status[modelKey] = {
          loaded: translationModels.isModelLoaded(modelKey),
          loading: false // Nous n'avons plus de tracking des loading promises
        };
      });
      
      setModelsStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Vérifier la disponibilité de l'API de traduction
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const url = new URL('https://api.mymemory.translated.net/get');
        url.searchParams.set('q', 'test');
        url.searchParams.set('langpair', 'en|fr');
        
        const response = await fetch(url.toString());
        if (response.ok) {
          setApiStatus('available');
        } else {
          setApiStatus('unavailable');
        }
      } catch {
        setApiStatus('unavailable');
      }
    };

    checkApiStatus();
  }, []);

  const handlePreloadModels = async () => {
    setIsPreloading(true);
    try {
      await Promise.all([
        translationModels.loadModel('MT5_SMALL'),
        translationModels.loadModel('NLLB_DISTILLED_600M')
      ]);
    } catch (error) {
      console.error('Erreur lors du préchargement:', error);
    } finally {
      setIsPreloading(false);
    }
  };

  const getStatusBadge = (modelName: string) => {
    const status = modelsStatus[modelName];
    if (!status) {
      return <Badge variant="secondary">Non initialisé</Badge>;
    }

    if (status.loading) {
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Chargement...
        </Badge>
      );
    }

    if (status.loaded) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          Modèle TF.js
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="gap-1">
        <Globe className="h-3 w-3" />
        API Fallback
      </Badge>
    );
  };

  const getApiStatusBadge = () => {
    switch (apiStatus) {
      case 'checking':
        return (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Vérification...
          </Badge>
        );
      case 'available':
        return (
          <Badge variant="default" className="gap-1 bg-blue-600">
            <Wifi className="h-3 w-3" />
            API Disponible
          </Badge>
        );
      case 'unavailable':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            API Indisponible
          </Badge>
        );
    }
  };

  const getOverallProgress = () => {
    const allModels = translationModels.getAllAvailableModels();
    const totalModels = allModels.length;
    const loadedModels = Object.values(modelsStatus).filter(s => s?.loaded).length;
    return totalModels > 0 ? (loadedModels / totalModels) * 100 : 0;
  };

  const allModelsLoaded = Object.values(modelsStatus).every(s => s?.loaded);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Modèles de Traduction</CardTitle>
            <CardDescription>
              Statut des modèles TensorFlow.js et de l&apos;API de traduction
            </CardDescription>
          </div>
          <Button
            onClick={handlePreloadModels}
            disabled={isPreloading || allModelsLoaded}
            size="sm"
            className="gap-1"
          >
            {isPreloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Précharger
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statut de l'API */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">API de Traduction</h4>
              {getApiStatusBadge()}
            </div>
            <div className="text-sm text-muted-foreground">
              MyMemory Translation API (fallback)
            </div>
          </div>
        </div>

        {/* Barre de progression globale */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Modèles TensorFlow.js</span>
            <span>{Math.round(getOverallProgress())}%</span>
          </div>
          <Progress value={getOverallProgress()} className="h-2" />
        </div>

        {/* Statut de chaque modèle */}
        <div className="space-y-3">
          {translationModels.getAllAvailableModels().map((modelType) => {
            const modelKey = translationModels.getModelKey(modelType);
            const modelMetrics = translationModels.getModelMetrics(modelType);
            const modelConfig = modelMetrics.config;
            
            return (
              <div
                key={modelKey}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{modelConfig.displayName}</h4>
                    {getStatusBadge(modelKey)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>Complexité: {modelConfig.complexity}</div>
                    <div>Max tokens: {modelConfig.maxTokens}</div>
                    <div>Langues: {modelConfig.languages.slice(0, 5).join(', ')}
                      {modelConfig.languages.length > 5 && ` +${modelConfig.languages.length - 5} autres`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Cpu className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Informations supplémentaires */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <p className="font-medium mb-1">💡 Information :</p>
          <p>
            Les modèles TensorFlow.js sont chargés à la demande. En cas d&apos;indisponibilité, 
            l&apos;application utilise l&apos;API MyMemory pour les traductions en temps réel.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
