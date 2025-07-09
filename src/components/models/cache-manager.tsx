'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';

export function CacheManager() {
  const { getCacheStats, clearCache } = useTranslation(null);
  const stats = getCacheStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestionnaire de Cache de Traduction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{stats.size}</p>
              <p className="text-sm text-gray-600">Entrées en cache</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{stats.totalTranslations}</p>
              <p className="text-sm text-gray-600">Total traductions</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{stats.expiredCount}</p>
              <p className="text-sm text-gray-600">Entrées expirées</p>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={clearCache}
              className="w-full sm:w-auto"
            >
              Vider le cache
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
