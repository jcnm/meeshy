'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSimpleTranslation } from '@/hooks/use-simple-translation';
import { MODELS_CONFIG } from '@/lib/translation-models';
import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';

interface ModelsStatusProps {
  className?: string;
}

export function ModelsStatus({ className }: ModelsStatusProps) {
  const { modelsStatus, preloadModels, isTranslating } = useSimpleTranslation();
  const [isPreloading, setIsPreloading] = useState(false);

  const handlePreloadModels = async () => {
    setIsPreloading(true);
    try {
      await preloadModels();
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
          Prêt
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Non chargé
      </Badge>
    );
  };

  const getOverallProgress = () => {
    const totalModels = Object.keys(MODELS_CONFIG).length;
    const loadedModels = Object.values(modelsStatus).filter(s => s?.loaded).length;
    return (loadedModels / totalModels) * 100;
  };

  const allModelsLoaded = Object.values(modelsStatus).every(s => s?.loaded);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Modèles de Traduction</CardTitle>
            <CardDescription>
              Statut des modèles TensorFlow.js pour la traduction automatique
            </CardDescription>
          </div>
          <Button
            onClick={handlePreloadModels}
            disabled={isPreloading || isTranslating || allModelsLoaded}
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
        {/* Barre de progression globale */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progression globale</span>
            <span>{Math.round(getOverallProgress())}%</span>
          </div>
          <Progress value={getOverallProgress()} className="h-2" />
        </div>

        {/* Statut de chaque modèle */}
        <div className="space-y-3">
          {Object.entries(MODELS_CONFIG).map(([modelKey, modelConfig]) => (
            <div
              key={modelKey}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{modelConfig.name}</h4>
                  {getStatusBadge(modelKey)}
                </div>
                <div className="text-sm text-muted-foreground">
                  <div>Complexité: {modelConfig.complexity}</div>
                  <div>Max tokens: {modelConfig.maxTokens}</div>
                  <div>Langues: {modelConfig.languages.length} supportées</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Informations sur le cache */}
        <div className="pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Cache localStorage</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const count = Object.keys(localStorage)
                    .filter(key => key.startsWith('translation_'))
                    .length;
                  alert(`${count} traductions en cache`);
                }}
              >
                Voir le cache
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
