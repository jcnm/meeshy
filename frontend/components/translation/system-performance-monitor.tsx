'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, AlertTriangle } from 'lucide-react';

interface SystemStatus {
  memory: 'good' | 'warning' | 'critical';
  performance: 'good' | 'warning' | 'critical';
  recommendation: string;
}

// Extension du type Navigator pour deviceMemory
interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

export function SystemPerformanceMonitor() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    memory: 'good',
    performance: 'good',
    recommendation: 'Système optimal pour la traduction'
  });

  useEffect(() => {
    const checkSystemPerformance = () => {
      // Estimation approximative des performances système
      const userAgent = navigator.userAgent;
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isLowPowerDevice = /Android.*Mobile|iPhone/i.test(userAgent);
      
      // Vérification mémoire approximative (via navigator.deviceMemory si disponible)
      const deviceMemory = (navigator as NavigatorWithDeviceMemory).deviceMemory || 4; // Par défaut 4GB
      
      let newStatus: SystemStatus = {
        memory: 'good',
        performance: 'good',
        recommendation: 'Système optimal pour la traduction'
      };

      if (isMobile || deviceMemory < 2) {
        newStatus = {
          memory: 'warning',
          performance: 'warning',
          recommendation: 'Appareil mobile détecté. Utilisez des textes courts (<100 caractères).'
        };
      }

      if (isLowPowerDevice || deviceMemory < 1) {
        newStatus = {
          memory: 'critical',
          performance: 'critical',
          recommendation: 'Appareil à faibles ressources. Évitez les textes longs et utilisez NLLB.'
        };
      }

      // Vérification de la charge CPU approximative (heuristique)
      const startTime = performance.now();
      for (let i = 0; i < 100000; i++) {
        Math.random();
      }
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      if (executionTime > 50) {
        newStatus.performance = 'warning';
        newStatus.recommendation = 'CPU surchargé détecté. Fermez d\'autres onglets ou applications.';
      }

      setSystemStatus(newStatus);
    };

    checkSystemPerformance();
    
    // Vérifier toutes les 30 secondes
    const interval = setInterval(checkSystemPerformance, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
    }
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return Zap;
      case 'warning': return AlertTriangle;
      case 'critical': return AlertTriangle;
    }
  };

  const MemoryIcon = getStatusIcon(systemStatus.memory);
  const PerformanceIcon = getStatusIcon(systemStatus.performance);

  const worstStatus = systemStatus.memory === 'critical' || systemStatus.performance === 'critical' 
    ? 'critical' 
    : (systemStatus.memory === 'warning' || systemStatus.performance === 'warning' ? 'warning' : 'good');

  if (worstStatus === 'good') {
    return null; // Ne pas afficher si tout va bien
  }

  return (
    <Card className={`mb-2 ${
      worstStatus === 'critical' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
    }`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1">
            <MemoryIcon className={`h-3 w-3 ${getStatusColor(systemStatus.memory)}`} />
            <span className="text-xs">Mémoire</span>
          </div>
          <div className="flex items-center gap-1">
            <PerformanceIcon className={`h-3 w-3 ${getStatusColor(systemStatus.performance)}`} />
            <span className="text-xs">Performance</span>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground mb-2">
          {systemStatus.recommendation}
        </div>
        
        <div className="flex gap-1">
          <Badge variant="outline" className="text-xs">
            Texte court recommandé
          </Badge>
          {worstStatus === 'critical' && (
            <Badge variant="destructive" className="text-xs">
              Éviter MT5
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
