'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TRANSLATION_MODELS, TranslationModelType } from '@/types';
import { Zap, Cpu, Leaf, Euro, Clock } from 'lucide-react';

export function ModelLegend() {
  const mt5Models = (Object.keys(TRANSLATION_MODELS) as TranslationModelType[])
    .filter(model => TRANSLATION_MODELS[model].family === 'MT5');
  const nllbModels = (Object.keys(TRANSLATION_MODELS) as TranslationModelType[])
    .filter(model => TRANSLATION_MODELS[model].family === 'NLLB');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Modèles de Traduction</h2>
        <p className="text-sm text-muted-foreground">
          Comprendre les différents modèles et leurs caractéristiques
        </p>
      </div>

      {/* MT5 Family */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <h3 className="text-lg font-medium">Famille MT5 (Google)</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Modèles multilingues basés sur T5, optimisés pour la rapidité et l'efficacité énergétique.
        </p>
        
        <div className="grid gap-3">
          {mt5Models.map((modelType) => {
            const model = TRANSLATION_MODELS[modelType];
            return (
              <Card key={modelType} className="border-l-4" style={{ borderLeftColor: model.color }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{model.displayName}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span>{model.parameters}</span>
                        <Badge variant="outline" className="text-xs">
                          {model.quality}
                        </Badge>
                      </CardDescription>
                    </div>
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: model.color }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      <span>{model.cost.energyConsumption} Wh</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-blue-500" />
                      <span>{model.cost.computationalCost}/10</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Leaf className="h-3 w-3 text-green-500" />
                      <span>{model.cost.co2Equivalent} g</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Euro className="h-3 w-3 text-purple-500" />
                      <span>{model.cost.monetaryEquivalent} c€</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span>{model.cost.inferenceTime}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* NLLB Family */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <h3 className="text-lg font-medium">Famille NLLB (Meta)</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          No Language Left Behind - Modèles spécialisés pour la qualité de traduction, 
          particulièrement efficaces pour les langues moins courantes.
        </p>
        
        <div className="grid gap-3">
          {nllbModels.map((modelType) => {
            const model = TRANSLATION_MODELS[modelType];
            return (
              <Card key={modelType} className="border-l-4" style={{ borderLeftColor: model.color }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{model.displayName}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span>{model.parameters}</span>
                        <Badge variant="outline" className="text-xs">
                          {model.quality}
                        </Badge>
                      </CardDescription>
                    </div>
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: model.color }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      <span>{model.cost.energyConsumption} Wh</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-blue-500" />
                      <span>{model.cost.computationalCost}/10</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Leaf className="h-3 w-3 text-green-500" />
                      <span>{model.cost.co2Equivalent} g</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Euro className="h-3 w-3 text-purple-500" />
                      <span>{model.cost.monetaryEquivalent} c€</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span>{model.cost.inferenceTime}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Color Legend */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Légende des Couleurs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-800 rounded"></div>
              <span>Famille MT5 : Du vert clair au vert foncé (efficacité énergétique)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gradient-to-r from-orange-300 to-orange-800 rounded"></div>
              <span>Famille NLLB : Du orange clair au orange foncé (qualité de traduction)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Plus la couleur est foncée, plus le modèle est puissant et consommateur en ressources.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
