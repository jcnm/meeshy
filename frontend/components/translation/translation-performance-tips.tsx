'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Info, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface TranslationPerformanceTipsProps {
  currentModel?: string;
  textLength?: number;
}

export function TranslationPerformanceTips({ currentModel, textLength = 0 }: TranslationPerformanceTipsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Déterminer les conseils selon le contexte
  const getPerformanceTips = () => {
    const tips = [];

    if (textLength > 150) {
      tips.push({
        type: 'warning' as const,
        icon: AlertTriangle,
        title: 'Texte long détecté',
        description: 'Les textes longs (>150 caractères) peuvent ralentir votre navigateur. Essayez de diviser en phrases plus courtes.'
      });
    }

    if (currentModel === 'MT5_BASE') {
      tips.push({
        type: 'info' as const,
        icon: Info,
        title: 'Modèle MT5 sélectionné',
        description: 'MT5 peut parfois produire des résultats inattendus. Si la traduction semble corrompue, essayez NLLB.'
      });
    }

    tips.push({
      type: 'success' as const,
      icon: Zap,
      title: 'Optimisation des performances',
      description: 'Pour une traduction fluide, utilisez des phrases courtes et simples.'
    });

    return tips;
  };

  const tips = getPerformanceTips();

  if (tips.length === 0) return null;

  return (
    <div className="mb-4">
      {!isExpanded ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 text-xs"
        >
          <Info className="h-3 w-3" />
          Conseils de performance ({tips.length})
        </Button>
      ) : (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Conseils de traduction</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-xs h-6"
              >
                Masquer
              </Button>
            </div>
            
            {tips.map((tip, index) => (
              <div key={index} className={`p-2 rounded-lg flex items-start gap-2 ${
                tip.type === 'warning' ? 'bg-yellow-100 border border-yellow-200' :
                tip.type === 'success' ? 'bg-green-100 border border-green-200' :
                'bg-blue-100 border border-blue-200'
              }`}>
                <tip.icon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium">{tip.title}</div>
                  <div className="text-xs text-muted-foreground">{tip.description}</div>
                </div>
              </div>
            ))}
            
            <div className="grid grid-cols-2 gap-2 text-xs mt-3">
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs w-full justify-start">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Texte court (&lt;100 chars)
                </Badge>
                <Badge variant="outline" className="text-xs w-full justify-start">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Phrases simples
                </Badge>
              </div>
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs w-full justify-start">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  NLLB pour la qualité
                </Badge>
                <Badge variant="outline" className="text-xs w-full justify-start">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  MT5 pour la rapidité
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
