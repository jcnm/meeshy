'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Z_INDEX, Z_CLASSES, useZIndexDebug } from '@/lib/z-index';

export function ZIndexDebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const { logZIndexHierarchy, checkElementZIndex } = useZIndexDebug();

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-white/90 backdrop-blur-sm"
        >
          🎯 Debug Z-Index
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80">
      <Card className="bg-white/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Z-Index Hierarchy</CardTitle>
            <Button 
              onClick={() => setIsVisible(false)}
              variant="ghost" 
              size="sm"
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-80 overflow-y-auto">
          {Object.entries(Z_INDEX)
            .sort(([,a], [,b]) => b - a) // Trier par valeur décroissante
            .map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="font-mono">{key}</span>
                <Badge variant="outline" className="text-xs">
                  {value}
                </Badge>
              </div>
            ))}
          
          <div className="pt-3 mt-3 border-t space-y-2">
            <Button 
              onClick={logZIndexHierarchy}
              variant="outline" 
              size="sm" 
              className="w-full text-xs"
            >
              📊 Log Hierarchy
            </Button>
            
            <Button 
              onClick={() => {
                const popover = document.querySelector('[data-radix-popover-content]');
                if (popover) {
                  checkElementZIndex(popover as HTMLElement);
                } else {
                  console.log('❌ Aucun popover trouvé');
                }
              }}
              variant="outline" 
              size="sm" 
              className="w-full text-xs"
            >
              🔍 Check Popover
            </Button>

            <div className="text-xs text-gray-500 mt-2">
              <p>Vérifiez la console pour les détails de debug</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
