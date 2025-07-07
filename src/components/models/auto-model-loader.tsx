'use client';

import { useEffect, useState } from 'react';
import { useAutoModelLoader } from '@/services/auto-model-loader';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Download, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Composant qui gère le chargement automatique des modèles au démarrage
 * Affiche une interface de progression et permet de recharger si nécessaire
 */
export function AutoModelLoaderComponent() {
  const { isLoading, progress, isReady, loadModels, reloadModels, stats } = useAutoModelLoader();
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Chargement automatique au montage du composant
  useEffect(() => {
    if (!hasAttemptedLoad && !isReady) {
      setHasAttemptedLoad(true);
      loadModels().catch(error => {
        console.error('Erreur lors du chargement automatique:', error);
        toast.error('Erreur lors du chargement des modèles');
      });
    }
  }, [hasAttemptedLoad, isReady, loadModels]);

  // Ne rien afficher si tout est prêt et qu'on n'affiche pas les détails
  if (isReady && !showDetails) {
    return null;
  }

  // Calculer la progression globale
  const globalProgress = progress.length > 0 
    ? progress.reduce((sum, p) => sum + p.progress, 0) / progress.length 
    : 0;

  const hasErrors = progress.some(p => p.status === 'error');
  const allComplete = progress.length > 0 && progress.every(p => p.status !== 'loading');

  return (
    <Card className="mx-4 my-2">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* En-tête */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold">Modèles de Traduction</h3>
                <p className="text-sm text-muted-foreground">
                  {isReady ? 'Modèles chargés et prêts' : 'Chargement des modèles essentiels...'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Statistiques */}
              <Badge variant={isReady ? 'default' : 'secondary'}>
                {stats.loaded}/{stats.total} chargés
              </Badge>
              
              {/* Bouton détails */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Masquer' : 'Détails'}
              </Button>
            </div>
          </div>

          {/* Progression globale */}
          {(isLoading || !allComplete) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progression globale</span>
                <span>{Math.round(globalProgress)}%</span>
              </div>
              <Progress value={globalProgress} className="h-2" />
            </div>
          )}

          {/* Détails de progression */}
          {showDetails && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium text-sm">Détails des modèles</h4>
              
              {progress.length > 0 ? (
                <div className="space-y-2">
                  {progress.map((p, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 border rounded">
                      <div className="flex-shrink-0">
                        {p.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                        {p.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {p.status === 'error' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{p.modelName}</span>
                          <span className="text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                        {p.message && (
                          <p className="text-xs text-muted-foreground mt-1">{p.message}</p>
                        )}
                        {p.status === 'loading' && (
                          <Progress value={p.progress} className="h-1 mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun modèle en cours de chargement</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHasAttemptedLoad(false);
                    loadModels();
                  }}
                  disabled={isLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? 'Chargement...' : 'Charger'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reloadModels}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recharger
                </Button>
              </div>
            </div>
          )}

          {/* Erreurs */}
          {hasErrors && !isLoading && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">Erreurs de chargement</span>
              </div>
              <p className="text-sm text-destructive/80 mt-1">
                Certains modèles n&apos;ont pas pu être chargés. Vérifiez votre connexion ou réessayez.
              </p>
            </div>
          )}

          {/* Message de succès */}
          {isReady && showDetails && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium text-sm">Modèles prêts</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Tous les modèles essentiels sont chargés. La traduction automatique est disponible.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
