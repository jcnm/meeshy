'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TRANSLATION_MODELS, TranslationModelType } from '@/types';
import { Zap, Cpu, Leaf, Euro } from 'lucide-react';

interface ModelStats {
  count: number;
  totalCost: {
    energyConsumption: number;
    computationalCost: number;
    co2Equivalent: number;
    monetaryEquivalent: number;
    memoryUsage: number;
    inferenceTime: number;
  };
}

export function TranslationStats() {
  const [stats, setStats] = useState<Partial<Record<TranslationModelType, ModelStats>>>({});

  useEffect(() => {
    const loadStats = () => {
      try {
        const statsData = localStorage.getItem('translation_stats');
        if (statsData) {
          const parsedStats = JSON.parse(statsData);
          setStats(parsedStats);
        }
      } catch (error) {
        console.error('Erreur chargement statistiques:', error);
      }
    };

    loadStats();
    
    // Refresh stats every 5 seconds if modal is open
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate totals from all models
  const totalTranslations = Object.values(stats).reduce((sum, modelStats) => sum + (modelStats?.count || 0), 0);
  const totalEnergy = Object.values(stats).reduce((sum, modelStats) => sum + (modelStats?.totalCost.energyConsumption || 0), 0);
  const totalCO2 = Object.values(stats).reduce((sum, modelStats) => sum + (modelStats?.totalCost.co2Equivalent || 0), 0);
  const totalCost = Object.values(stats).reduce((sum, modelStats) => sum + (modelStats?.totalCost.monetaryEquivalent || 0), 0);

  const clearStats = () => {
    localStorage.removeItem('translation_stats');
    setStats({});
  };

  // Group models by family for better organization
  const mt5Models = (Object.keys(TRANSLATION_MODELS) as TranslationModelType[])
    .filter(model => TRANSLATION_MODELS[model].family === 'MT5');
  const nllbModels = (Object.keys(TRANSLATION_MODELS) as TranslationModelType[])
    .filter(model => TRANSLATION_MODELS[model].family === 'NLLB');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Statistiques de Traduction</h2>
          <p className="text-sm text-muted-foreground">
            Utilisation des modèles et impact environnemental
          </p>
        </div>
        <button
          onClick={clearStats}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Réinitialiser
        </button>
      </div>

      {/* Vue d'ensemble */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Traductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTranslations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Zap className="h-4 w-4" />
              Énergie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnergy.toFixed(3)}</div>
            <p className="text-xs text-muted-foreground">Wh</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Leaf className="h-4 w-4" />
              CO₂
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCO2.toFixed(3)}</div>
            <p className="text-xs text-muted-foreground">g</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Euro className="h-4 w-4" />
              Coût
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">€</p>
          </CardContent>
        </Card>
      </div>

      {/* Détails par modèle */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Utilisation par Modèle</h3>
        
        {/* MT5 Family */}
        <div className="space-y-2">
          <h4 className="text-md font-medium text-green-700">Famille MT5 (Google)</h4>
          {mt5Models.map((modelType) => {
            const modelInfo = TRANSLATION_MODELS[modelType];
            const modelStats = stats[modelType];
            if (!modelStats || modelStats.count === 0) return null;
            
            const percentage = totalTranslations > 0 ? (modelStats.count / totalTranslations) * 100 : 0;

            return (
              <Card key={modelType}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: modelInfo.color }}
                      />
                      <div>
                        <CardTitle className="text-base">{modelInfo.displayName}</CardTitle>
                        <CardDescription>
                          {modelInfo.parameters} • {modelInfo.quality} • {modelInfo.cost.inferenceTime}ms
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {modelStats.count} utilisations
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Utilisation</span>
                      <span>{percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.energyConsumption.toFixed(3)} Wh</div>
                        <div className="text-xs text-muted-foreground">Énergie</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.computationalCost.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Calcul</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.co2Equivalent.toFixed(3)} g</div>
                        <div className="text-xs text-muted-foreground">CO₂</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-purple-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.monetaryEquivalent.toFixed(4)} €</div>
                        <div className="text-xs text-muted-foreground">Coût</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* NLLB Family */}
        <div className="space-y-2">
          <h4 className="text-md font-medium text-orange-700">Famille NLLB (Meta)</h4>
          {nllbModels.map((modelType) => {
            const modelInfo = TRANSLATION_MODELS[modelType];
            const modelStats = stats[modelType];
            if (!modelStats || modelStats.count === 0) return null;
            
            const percentage = totalTranslations > 0 ? (modelStats.count / totalTranslations) * 100 : 0;

            return (
              <Card key={modelType}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: modelInfo.color }}
                      />
                      <div>
                        <CardTitle className="text-base">{modelInfo.displayName}</CardTitle>
                        <CardDescription>
                          {modelInfo.parameters} • {modelInfo.quality} • {modelInfo.cost.inferenceTime}ms
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {modelStats.count} utilisations
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Utilisation</span>
                      <span>{percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.energyConsumption.toFixed(3)} Wh</div>
                        <div className="text-xs text-muted-foreground">Énergie</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.computationalCost.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Calcul</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.co2Equivalent.toFixed(3)} g</div>
                        <div className="text-xs text-muted-foreground">CO₂</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-purple-500" />
                      <div>
                        <div className="font-medium">{modelStats.totalCost.monetaryEquivalent.toFixed(4)} €</div>
                        <div className="text-xs text-muted-foreground">Coût</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {totalTranslations === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune traduction effectuée pour le moment</p>
              <p className="text-sm">Les statistiques apparaîtront ici après vos premières traductions</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
