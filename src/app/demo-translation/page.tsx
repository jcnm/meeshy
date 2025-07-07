'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  Database, 
  Globe, 
  Clock, 
  CheckCircle, 
  BarChart3,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { useOptimizedTranslationStrategy } from '@/hooks/use-optimized-translation-strategy';
import type { UserTranslationPreferences } from '@/types/translation-optimization';

/**
 * Page de démonstration de la stratégie de traduction optimisée
 * Showcase complet des fonctionnalités multi-niveaux
 */
export default function TranslationDemoPage() {
  // Configuration utilisateur par défaut
  const [userPreferences] = useState<UserTranslationPreferences>({
    primaryLanguage: 'fr',
    secondaryLanguages: ['en', 'es'],
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    preloadTranslations: true,
    maxCacheSize: 50,
    translationQuality: 'balanced',
    backgroundTranslation: true
  });

  // Hook principal de traduction optimisée
  const {
    conversationsMetadata,
    isMetadataLoaded,
    loadingState,
    isOnline,
    cacheStats,
    initialize,
    processHighPriorityTranslations,
    startBackgroundTranslations,
    hierarchicalCache
  } = useOptimizedTranslationStrategy({
    userPreferences,
    autoStartTranslation: true,
    enableBackgroundProcessing: true,
    batchSize: 5,
    maxRetries: 3
  });

  // États locaux pour les tests
  const [testMessage, setTestMessage] = useState('Hello, this is a test message for our optimized translation system!');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('fr');
  const [metrics] = useState({
    averageTranslationTime: 250,
    successRate: 96
  });

  const handleTestTranslation = async () => {
    try {
      // Test avec le cache hiérarchique
      const cacheKey = `${testMessage}-${sourceLanguage}-${targetLanguage}`;
      const cached = hierarchicalCache.getCachedValue(cacheKey);
      
      if (cached) {
        toast.success(`Traduction depuis cache: ${cached}`);
      } else {
        // Simulation d'une traduction
        const fakeTranslation = `[Traduit] ${testMessage}`;
        hierarchicalCache.setCachedValue(cacheKey, fakeTranslation);
        toast.success(`Traduction réussie: ${fakeTranslation}`);
      }
    } catch {
      toast.error('Erreur de traduction');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Démonstration Stratégie de Traduction Optimisée
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Système hiérarchique de cache, gestion de queue de priorités, et chargement multi-niveaux
          </p>
        </div>

        {/* Métriques globales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Métriques de Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-sm text-gray-600">Cache Hits</div>
                  <div className="font-semibold">
                    {cacheStats.memoryHits + cacheStats.localStorageHits + cacheStats.indexedDBHits}
                    /{cacheStats.totalRequests}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-sm text-gray-600">Temps Moyen</div>
                  <div className="font-semibold">{metrics.averageTranslationTime}ms</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-sm text-gray-600">Taux de Réussite</div>
                  <div className="font-semibold">{metrics.successRate}%</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-500" />
                <div>
                  <div className="text-sm text-gray-600">En ligne</div>
                  <Badge variant={isOnline ? "default" : "destructive"}>
                    {isOnline ? 'Connecté' : 'Hors ligne'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="test" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="test">Test de Traduction</TabsTrigger>
            <TabsTrigger value="cache">Gestion Cache</TabsTrigger>
            <TabsTrigger value="queue">Queue de Priorités</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          {/* Onglet Test de Traduction */}
          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test de Traduction Temps Réel</CardTitle>
                <CardDescription>
                  Testez la traduction avec sélection automatique de modèle et cache intelligent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Langue source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇺🇸 Anglais</SelectItem>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="es">🇪🇸 Espagnol</SelectItem>
                      <SelectItem value="de">🇩🇪 Allemand</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Langue cible" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="en">🇺🇸 Anglais</SelectItem>
                      <SelectItem value="es">🇪🇸 Espagnol</SelectItem>
                      <SelectItem value="de">🇩🇪 Allemand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  placeholder="Saisissez votre texte à traduire..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="min-h-[100px]"
                />

                <Button 
                  onClick={handleTestTranslation}
                  className="w-full"
                  disabled={!testMessage.trim()}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Traduire avec IA Optimisée
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Gestion Cache */}
          <TabsContent value="cache" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cache Mémoire</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Hits:</span>
                      <span className="font-semibold">{cacheStats.memoryHits}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toast.info('Cache mémoire vidé')}
                      className="w-full"
                    >
                      Vider Cache Mémoire
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Local Storage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Hits:</span>
                      <span className="font-semibold">{cacheStats.localStorageHits}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toast.info('Local Storage vidé')}
                      className="w-full"
                    >
                      Vider Local Storage
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">IndexedDB</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Hits:</span>
                      <span className="font-semibold">{cacheStats.indexedDBHits}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toast.info('IndexedDB vidé')}
                      className="w-full"
                    >
                      Vider IndexedDB
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Onglet Système */}
          <TabsContent value="queue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion du Système de Traduction</CardTitle>
                <CardDescription>
                  Contrôle des processus de traduction optimisés
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Conversations chargées:</div>
                    <div className="text-sm text-gray-600">
                      {conversationsMetadata.length} conversations en cache
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => processHighPriorityTranslations([])}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Traductions Prioritaires
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => startBackgroundTranslations()}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Traductions Arrière-plan
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold">Métadonnées des Conversations:</div>
                  {conversationsMetadata.slice(0, 3).map((conv) => (
                    <div key={conv.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Globe className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">Conversation {conv.id}</div>
                        <div className="text-sm text-gray-600">
                          Conversation active | Priorité: {conv.priority}
                        </div>
                      </div>
                      <Badge variant={
                        conv.priority === 'CRITICAL' ? 'destructive' :
                        conv.priority === 'HIGH' ? 'default' :
                        conv.priority === 'NORMAL' ? 'secondary' : 'outline'
                      }>
                        {conv.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Monitoring */}
          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Monitoring Système</CardTitle>
                <CardDescription>
                  État du système de traduction en temps réel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Métadonnées chargées:</span>
                      <Badge variant={isMetadataLoaded ? "default" : "secondary"}>
                        {isMetadataLoaded ? 'Oui' : 'Non'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Système en ligne:</span>
                      <Badge variant={isOnline ? "default" : "secondary"}>
                        {isOnline ? 'Connecté' : 'Hors ligne'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Conversations:</span>
                      <span className="font-semibold">{conversationsMetadata.length}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Progression:</span>
                        <span>{loadingState.progress}%</span>
                      </div>
                      <Progress value={loadingState.progress} className="h-2" />
                    </div>
                    <div className="text-sm text-gray-600">
                      Phase: {loadingState.phase}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => initialize()}
                  className="w-full"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Initialiser le Système
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
