'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';

export function CacheManager() {
  const { getCacheStats } = useTranslation();
  const stats = getCacheStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestionnaire de Cache de Traduction (API)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{stats.size}</p>
              <p className="text-sm text-gray-600">Entrées en cache</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{stats.totalTranslations}</p>
              <p className="text-sm text-gray-600">Total traductions</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Le cache de traduction est géré par le service API. 
              Contactez l'administrateur pour les opérations de cache.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
