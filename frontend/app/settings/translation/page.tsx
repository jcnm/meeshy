'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Settings, 
  Globe, 
  Zap, 
  Shield, 
  Trash2, 
  RefreshCw,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { ModelSelector } from '@/components/translation/model-selector';
import { translationService } from '@/services/translation.service';
import { SUPPORTED_LANGUAGES, type TranslationModelType } from '@/types';

export default function TranslationSettingsPage() {
  // Pour l'instant, utilisons des valeurs par défaut
  // TODO: Intégrer avec useUser quand le hook sera disponible
  const user = {
    autoTranslateEnabled: false,
    translateToSystemLanguage: false,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    systemLanguage: 'fr',
    regionalLanguage: 'fr',
    customDestinationLanguage: 'en'
  };
  
  const [selectedModel, setSelectedModel] = useState<TranslationModelType>('MT5_SMALL');
  const [isLoading, setIsLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState({ size: 0, totalTranslations: 0, expiredCount: 0 });

  // États des préférences de traduction
  const [autoTranslate, setAutoTranslate] = useState(user?.autoTranslateEnabled ?? false);
  const [translateToSystem, setTranslateToSystem] = useState(user?.translateToSystemLanguage ?? false);
  const [translateToRegional, setTranslateToRegional] = useState(user?.translateToRegionalLanguage ?? false);
  const [useCustomDestination, setUseCustomDestination] = useState(user?.useCustomDestination ?? false);
  const [systemLanguage, setSystemLanguage] = useState(user?.systemLanguage ?? 'fr');
  const [regionalLanguage, setRegionalLanguage] = useState(user?.regionalLanguage ?? 'fr');
  const [customDestinationLanguage, setCustomDestinationLanguage] = useState(user?.customDestinationLanguage ?? 'en');

  // Charger les statistiques du cache (désactivé - service API uniquement)
  useEffect(() => {
    // Les statistiques de cache ne sont plus disponibles avec le service API
    console.log('� Utilisation du service de traduction API - statistiques de cache non disponibles');
  }, []);

  // Sauvegarder les préférences
  const savePreferences = async () => {
    setIsLoading(true);
    try {
      // TODO: Implémenter la sauvegarde des préférences utilisateur
      console.log('Sauvegarde des préférences:', {
        autoTranslate,
        translateToSystem,
        translateToRegional,
        useCustomDestination,
        systemLanguage,
        regionalLanguage,
        customDestinationLanguage
      });

      toast.success('Préférences de traduction sauvegardées');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde des préférences');
    } finally {
      setIsLoading(false);
    }
  };

  // Vider le cache (désactivé - service API uniquement)
  const clearCache = async () => {
    try {
      toast.info('Cache côté client non disponible avec le service API');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Opération non disponible');
    }
  };

  // Diagnostiquer le système
  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      toast.loading('Diagnostic en cours...', { id: 'diagnostics' });
      
      // // Vérifier les modèles
      // const loadedModels = translationService();
      // const persistedModels = translationService.getPersistedLoadedModels();
      
      // Tester la mémoire disponible
      const memoryInfo = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      const hasWebGPU = 'gpu' in navigator;
      
      const results = {
        memoryUsed: memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : 'Non disponible',
        memoryTotal: memoryInfo ? Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024) : 'Non disponible',
        webGPUSupport: hasWebGPU,
        serviceType: 'API Server'
      };

      console.log('🔍 Diagnostic du système de traduction:', results);
      
      // toast.success(`Diagnostic terminé: ${results.modelsLoaded} modèles chargés, ${results.memoryUsed} MB utilisés`, { 
      //   id: 'diagnostics' 
      // });
    } catch (error) {
      console.error('Erreur lors du diagnostic:', error);
      toast.error('Erreur lors du diagnostic', { id: 'diagnostics' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Paramètres de Traduction</h1>
          <p className="text-gray-600">Configurez votre expérience de traduction automatique</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gestion des modèles */}
        <div className="lg:col-span-2">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            showDownload={true}
          />
        </div>

        {/* Préférences de traduction automatique */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Traduction Automatique
            </CardTitle>
            <CardDescription>
              Configurez quand et comment les messages sont automatiquement traduits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">Traduction automatique</label>
                <p className="text-xs text-gray-500">
                  Traduit automatiquement les messages reçus
                </p>
              </div>
              <Switch
                checked={autoTranslate}
                onCheckedChange={setAutoTranslate}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Langues de destination</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm">Vers la langue système</label>
                    <p className="text-xs text-gray-500">
                      Traduit vers votre langue principale ({systemLanguage})
                    </p>
                  </div>
                  <Switch
                    checked={translateToSystem}
                    onCheckedChange={setTranslateToSystem}
                    disabled={!autoTranslate}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm">Vers la langue régionale</label>
                    <p className="text-xs text-gray-500">
                      Traduit vers votre langue régionale ({regionalLanguage})
                    </p>
                  </div>
                  <Switch
                    checked={translateToRegional}
                    onCheckedChange={setTranslateToRegional}
                    disabled={!autoTranslate}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm">Langue personnalisée</label>
                    <p className="text-xs text-gray-500">
                      Traduit vers une langue de votre choix
                    </p>
                  </div>
                  <Switch
                    checked={useCustomDestination}
                    onCheckedChange={setUseCustomDestination}
                    disabled={!autoTranslate}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration des langues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configuration des Langues
            </CardTitle>
            <CardDescription>
              Définissez vos langues préférées pour la traduction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Langue système</label>
              <Select value={systemLanguage} onValueChange={setSystemLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Langue régionale</label>
              <Select value={regionalLanguage} onValueChange={setRegionalLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {useCustomDestination && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Langue personnalisée</label>
                <Select value={customDestinationLanguage} onValueChange={setCustomDestinationLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <div className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              onClick={savePreferences} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Sauvegarde...' : 'Sauvegarder les préférences'}
            </Button>
          </CardContent>
        </Card>

        {/* Statistiques et maintenance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Cache et Performance
            </CardTitle>
            <CardDescription>
              Gérez le cache de traduction et surveillez les performances
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-blue-600">N/A</p>
                <p className="text-xs text-gray-500">Service API</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-green-600">N/A</p>
                <p className="text-xs text-gray-500">Cache côté serveur</p>
              </div>
            </div>            <Separator />

            <div className="space-y-2">
              <Button 
                variant="outline" 
                onClick={clearCache}
                className="w-full"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Vider le cache
              </Button>
              
              <Button 
                variant="outline" 
                onClick={runDiagnostics}
                disabled={isLoading}
                className="w-full"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Diagnostic système
              </Button>
            </div>

            {/* Info sur service API */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-blue-800">
                  Service de traduction API
                </p>
                <p className="text-blue-600">
                  Les traductions sont traitées côté serveur
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations sur le modèle sélectionné */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Modèle Actif
            </CardTitle>
            <CardDescription>
              Informations sur le modèle de traduction actuellement sélectionné
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Modèle sélectionné</span>
              <Badge variant="secondary">{selectedModel}</Badge>
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <p>• Chargement automatique à la première utilisation</p>
              <p>• Cache persistant entre les sessions</p>
              <p>• Traduction côté client uniquement</p>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium">Conseil de performance</p>
                  <p>Commencez par MT5_SMALL pour des tests rapides, puis passez à NLLB pour une meilleure qualité si besoin.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
