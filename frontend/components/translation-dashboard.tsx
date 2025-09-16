/**
 * Tableau de bord avancé de traduction - Vue d'ensemble complète du système
 * Combine monitoring en temps réel, métriques de performance et contrôles
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  BarChart3, 
  Clock, 
  Globe, 
  MessageSquare, 
  Settings,
  Zap,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  Timer,
  TrendingUp,
  Users
} from 'lucide-react';
import { useTranslationPerformance } from '@/hooks/use-translation-performance';
// import { TranslationMonitor } from '@/components/translation-monitor';

interface TranslationDashboardProps {
  className?: string;
  showAdvancedMetrics?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface QuickStats {
  totalMessages: number;
  translatedMessages: number;
  activeTranslations: number;
  errorRate: number;
  avgResponseTime: number;
  cacheHitRate: number;
}

export function TranslationDashboard({
  className = '',
  showAdvancedMetrics = true,
  autoRefresh = true,
  refreshInterval = 5000
}: TranslationDashboardProps) {
  const {
    requests,
    isProcessing,
    hasErrors,
    metrics,
    clearCache,
    clearErrors,
    flushBatches,
    getBatchInfo
  } = useTranslationPerformance({
    enableBatching: true,
    trackMetrics: true
  });

  // État local
  const [quickStats, setQuickStats] = useState<QuickStats>({
    totalMessages: 0,
    translatedMessages: 0,
    activeTranslations: 0,
    errorRate: 0,
    avgResponseTime: 0,
    cacheHitRate: 0
  });

  const [settings, setSettings] = useState({
    batchingEnabled: true,
    cacheEnabled: true,
    autoRetry: true,
    showNotifications: true
  });

  const batchInfo = getBatchInfo();

  // Calculer les statistiques rapides
  useEffect(() => {
    const requestsArray = Array.from(requests.values());
    const completed = requestsArray.filter(r => r.status === 'completed' || r.status === 'cached');
    const errors = requestsArray.filter(r => r.status === 'error');
    const processing = requestsArray.filter(r => r.status === 'processing' || r.status === 'pending');
    
    const avgTime = completed.length > 0 
      ? completed.reduce((sum, r) => sum + (r.processingTime || 0), 0) / completed.length 
      : 0;

    setQuickStats({
      totalMessages: requestsArray.length,
      translatedMessages: completed.length,
      activeTranslations: processing.length,
      errorRate: requestsArray.length > 0 ? (errors.length / requestsArray.length) * 100 : 0,
      avgResponseTime: avgTime,
      cacheHitRate: metrics.cacheHitRate
    });
  }, [requests, metrics]);

  // Formatage des valeurs
  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  // Couleur selon la performance
  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* En-tête avec contrôles */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tableau de bord Traduction</h2>
          <p className="text-muted-foreground">
            Monitoring en temps réel du système de traduction Meeshy
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={flushBatches}
            disabled={!batchInfo.enabled}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Forcer traitement
          </Button>
          
          <Button variant="outline" size="sm" onClick={clearCache}>
            <Trash2 className="h-4 w-4 mr-2" />
            Vider cache
          </Button>
          
          <Button variant="outline" size="sm" onClick={clearErrors}>
            <XCircle className="h-4 w-4 mr-2" />
            Effacer erreurs
          </Button>
        </div>
      </div>

      {/* Indicateurs de statut rapide */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{formatNumber(quickStats.totalMessages)}</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{formatNumber(quickStats.translatedMessages)}</p>
                <p className="text-xs text-muted-foreground">Traduits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{quickStats.activeTranslations}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${getPerformanceColor(quickStats.errorRate, { good: 1, warning: 5 })}`} />
              <div>
                <p className="text-2xl font-bold">{formatPercentage(quickStats.errorRate)}</p>
                <p className="text-xs text-muted-foreground">Erreurs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Timer className={`h-5 w-5 ${getPerformanceColor(quickStats.avgResponseTime, { good: 1000, warning: 3000 })}`} />
              <div>
                <p className="text-2xl font-bold">{formatTime(quickStats.avgResponseTime)}</p>
                <p className="text-xs text-muted-foreground">Temps moy.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{formatPercentage(quickStats.cacheHitRate)}</p>
                <p className="text-xs text-muted-foreground">Cache</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* État système */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              État système
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Service de traduction</span>
              <Badge variant={isProcessing ? "default" : "secondary"}>
                {isProcessing ? "Actif" : "Inactif"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Traitement par lots</span>
              <Badge variant={batchInfo.enabled ? "default" : "secondary"}>
                {batchInfo.enabled ? "Activé" : "Désactivé"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Erreurs détectées</span>
              <Badge variant={hasErrors ? "destructive" : "default"}>
                {hasErrors ? "Oui" : "Non"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Requêtes en attente</span>
                <span>{metrics.pendingRequests}</span>
              </div>
              <Progress value={(metrics.pendingRequests / Math.max(batchInfo.size, 1)) * 100} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm">Traitement par lots</label>
              <Switch 
                checked={settings.batchingEnabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, batchingEnabled: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm">Cache activé</label>
              <Switch 
                checked={settings.cacheEnabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, cacheEnabled: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm">Retry automatique</label>
              <Switch 
                checked={settings.autoRetry}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, autoRetry: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm">Notifications</label>
              <Switch 
                checked={settings.showNotifications}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, showNotifications: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets détaillés */}
      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitor">Monitoring</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="requests">Requêtes</TabsTrigger>
          {showAdvancedMetrics && <TabsTrigger value="advanced">Avancé</TabsTrigger>}
        </TabsList>

        <TabsContent value="monitor">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring en temps réel</CardTitle>
              <CardDescription>Suivi des traductions en direct</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Le composant TranslationMonitor sera intégré ici
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Métriques de performance</CardTitle>
                <CardDescription>Indicateurs clés de performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Requêtes totales</span>
                    <span className="font-mono">{formatNumber(metrics.totalRequests)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Requêtes par lot</span>
                    <span className="font-mono">{formatNumber(metrics.batchedRequests)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Hits cache</span>
                    <span className="font-mono">{formatNumber(metrics.cacheHits)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Erreurs</span>
                    <span className="font-mono text-red-600">{formatNumber(metrics.errors)}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Taille lot moyenne</span>
                    <span className="font-mono">{metrics.avgBatchSize.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Temps traitement moyen</span>
                    <span className="font-mono">{formatTime(metrics.avgProcessingTime)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuration du système</CardTitle>
                <CardDescription>Paramètres de traitement par lots</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Taille de lot</span>
                    <span className="font-mono">{batchInfo.size}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Timeout batch</span>
                    <span className="font-mono">{batchInfo.timeout}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Lots actifs</span>
                    <span className="font-mono">{metrics.activeBatches}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Taille cache</span>
                    <span className="font-mono">{formatNumber(metrics.cacheSize)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Requêtes de traduction</CardTitle>
              <CardDescription>Liste des requêtes en cours et terminées</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from(requests.entries()).map(([messageId, request]) => (
                  <div key={messageId} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <div className="font-mono text-sm">{messageId}</div>
                      <div className="text-xs text-muted-foreground">
                        {request.sourceLanguage} → {request.targetLanguages.join(', ')}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        request.status === 'completed' ? 'default' :
                        request.status === 'error' ? 'destructive' :
                        request.status === 'cached' ? 'secondary' : 'outline'
                      }>
                        {request.status}
                      </Badge>
                      
                      {request.processingTime && (
                        <span className="text-xs text-muted-foreground">
                          {formatTime(request.processingTime)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {requests.size === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Aucune requête de traduction
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {showAdvancedMetrics && (
          <TabsContent value="advanced" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Métriques avancées</CardTitle>
                  <CardDescription>Statistiques détaillées du système</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span>Taux de réussite:</span>
                    <span className="text-green-600">
                      {formatPercentage(100 - quickStats.errorRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Efficacité batching:</span>
                    <span>
                      {metrics.totalRequests > 0 
                        ? formatPercentage((metrics.batchedRequests / metrics.totalRequests) * 100)
                        : '0.0%'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taux cache:</span>
                    <span className="text-purple-600">{formatPercentage(metrics.cacheHitRate)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alertes système</CardTitle>
                  <CardDescription>Notifications et alertes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {quickStats.errorRate > 5 && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 rounded">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Taux d'erreur élevé: {formatPercentage(quickStats.errorRate)}</span>
                      </div>
                    )}
                    
                    {quickStats.avgResponseTime > 3000 && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-50 text-yellow-700 rounded">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">Temps de réponse lent: {formatTime(quickStats.avgResponseTime)}</span>
                      </div>
                    )}
                    
                    {metrics.cacheHitRate < 50 && metrics.totalRequests > 10 && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded">
                        <Database className="h-4 w-4" />
                        <span className="text-sm">Efficacité cache faible: {formatPercentage(metrics.cacheHitRate)}</span>
                      </div>
                    )}
                    
                    {quickStats.errorRate <= 1 && quickStats.avgResponseTime <= 1000 && metrics.cacheHitRate >= 70 && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 text-green-700 rounded">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Système fonctionnel optimal</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}