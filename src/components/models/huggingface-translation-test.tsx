/**
 * Composant de test pour le service de traduction Hugging Face
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  HuggingFaceTranslationService, 
  type TranslationProgress, 
  type TranslationResult 
} from '@/services/translation.service';
import { 
  UNIFIED_TRANSLATION_MODELS,
  type TranslationModelType as UnifiedModelType,
  estimateSystemCapabilities 
} from '@/lib/unified-model-config';
import { 
  type TranslationModelType as HuggingFaceModelType 
} from '@/lib/unified-model-config';

// const translationService = translationService; // Déjà importé en tant qu'instance

// Fonction de mapping pour convertir les types unifiés vers HuggingFace
const mapToHFModelType = (modelType: UnifiedModelType): HuggingFaceModelType | null => {
  switch (modelType) {
    case 'MT5_SMALL':
      return 'MT5_BASE' as HuggingFaceModelType;
    case 'NLLB_DISTILLED_600M':
      return 'NLLB_DISTILLED_600M' as HuggingFaceModelType;
    default:
      return null;
  }
};

// Types pour éviter 'any'
interface ModelStats {
  loaded: number;
  total: number;
  loadedModels: UnifiedModelType[];
  persistedModels: UnifiedModelType[];
  availableModels: UnifiedModelType[];
  inMemoryModels: UnifiedModelType[];
}

interface SystemCapabilities {
  recommendedModels: { mt5: UnifiedModelType; nllb: UnifiedModelType };
  maxMemoryMB: number;
  reasoning: string;
}

// Langues supportées avec leurs codes
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'Anglais', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Espagnol', flag: '🇪🇸' },
  { code: 'de', name: 'Allemand', flag: '🇩🇪' },
  { code: 'it', name: 'Italien', flag: '🇮🇹' },
  { code: 'pt', name: 'Portugais', flag: '🇵🇹' },
  { code: 'ru', name: 'Russe', flag: '🇷🇺' },
  { code: 'ja', name: 'Japonais', flag: '🇯🇵' },
  { code: 'ko', name: 'Coréen', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinois', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabe', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
];

export function HuggingFaceTranslationTest() {
  const [inputText, setInputText] = useState('Hello, this is a test message for translation.');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('fr');
  const [selectedModel, setSelectedModel] = useState<UnifiedModelType>('NLLB_DISTILLED_600M');
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<TranslationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [systemCapabilities, setSystemCapabilities] = useState<SystemCapabilities | null>(null);

  // Initialisation
  useEffect(() => {
    const capabilities = estimateSystemCapabilities();
    setSystemCapabilities(capabilities);
    setSelectedModel(capabilities.recommendedModels.nllb);
    updateModelStats();
    
    // Afficher les modèles persistés au démarrage
    console.log('📂 Modèles persistés au démarrage:', translationService.getPersistedLoadedModels());
  }, []);

  // Mettre à jour les statistiques des modèles
  const updateModelStats = () => {
    const stats = translationService.getModelStats();
    // Adapter les données aux types attendus
    setModelStats({
      ...stats,
      persistedModels: [],
      inMemoryModels: []
    });
  };

  // Gestionnaire de progression
  const handleProgress = (progress: TranslationProgress) => {
    setLoadingProgress(progress);
    if (progress.status === 'error') {
      setError(progress.error || 'Erreur inconnue');
    } else if (progress.status === 'ready') {
      setLoadingProgress(null);
      updateModelStats();
    }
  };

  // Effectuer la traduction
  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('Veuillez saisir un texte à traduire');
      return;
    }

    setIsTranslating(true);
    setError(null);
    setTranslationResult(null);
    setLoadingProgress(null);

    try {
      // Mapper le type unifié vers HuggingFace
      const hfModelType = mapToHFModelType(selectedModel);
      if (!hfModelType) {
        throw new Error(`Modèle non supporté: ${selectedModel}`);
      }

      const result = await translationService.translateText(
        inputText,
        sourceLanguage,
        targetLanguage,
        hfModelType,
        handleProgress
      );
      
      setTranslationResult(result);
      updateModelStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction';
      setError(errorMessage);
    } finally {
      setIsTranslating(false);
      setLoadingProgress(null);
    }
  };

  // Précharger les modèles recommandés
  const handlePreloadRecommended = async () => {
    setError(null);
    try {
      await translationService.preloadRecommendedModels(handleProgress);
      updateModelStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de préchargement');
    }
  };

  // Décharger tous les modèles
  const handleUnloadAll = async () => {
    await translationService.unloadAllModels();
    updateModelStats();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🤗 Test de Traduction Hugging Face</h1>
        <p className="text-muted-foreground">
          Service de traduction utilisant les modèles officiels MT5 et NLLB
        </p>
      </div>

      {/* Informations système */}
      {systemCapabilities && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💻 Capacités Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold">RAM Estimée</Label>
                <p>{Math.round(systemCapabilities.maxMemoryMB / 1024)} GB</p>
              </div>
              <div>
                <Label className="font-semibold">Recommandations</Label>
                <p className="text-sm text-muted-foreground">{systemCapabilities.reasoning}</p>
              </div>
              <div>
                <Label className="font-semibold">MT5 Recommandé</Label>
                <Badge variant="secondary">{systemCapabilities.recommendedModels.mt5}</Badge>
              </div>
              <div>
                <Label className="font-semibold">NLLB Recommandé</Label>
                <Badge variant="secondary">{systemCapabilities.recommendedModels.nllb}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques des modèles */}
      {modelStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 Statistiques des Modèles
              <Button onClick={updateModelStats} variant="outline" size="sm">
                Actualiser
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{modelStats.loaded}</div>
                <div className="text-sm text-muted-foreground">Modèles Chargés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{modelStats.total}</div>
                <div className="text-sm text-muted-foreground">Modèles Disponibles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round((modelStats.loaded / modelStats.total) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Taux de Chargement</div>
              </div>
            </div>
            
            {modelStats.loadedModels.length > 0 && (
              <div>
                <Label className="font-semibold">Modèles Chargés:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {modelStats.loadedModels.map((model: string) => (
                    <Badge key={model} variant="default">{model}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Button onClick={handlePreloadRecommended} variant="outline" size="sm">
                Précharger Recommandés
              </Button>
              <Button onClick={handleUnloadAll} variant="outline" size="sm">
                Décharger Tout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interface de traduction */}
      <Card>
        <CardHeader>
          <CardTitle>🔄 Interface de Traduction</CardTitle>
          <CardDescription>
            Testez la traduction avec les modèles Hugging Face officiels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sélection du modèle */}
          <div>
            <Label htmlFor="model-select">Modèle de Traduction</Label>
            <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value as UnifiedModelType)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un modèle" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(UNIFIED_TRANSLATION_MODELS).map((model) => (
                  <SelectItem key={model.name} value={model.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: model.color }}
                      />
                      <span>{model.displayName}</span>
                      <Badge variant="outline" style={{ fontSize: '10px' }}>
                        {model.parameters}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sélection des langues */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="source-lang">Langue Source</Label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="target-lang">Langue Cible</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Texte à traduire */}
          <div>
            <Label htmlFor="input-text">Texte à Traduire</Label>
            <Textarea
              id="input-text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Saisissez votre texte ici..."
              rows={3}
            />
          </div>

          {/* Bouton de traduction */}
          <Button 
            onClick={handleTranslate} 
            disabled={isTranslating || !!loadingProgress}
            className="w-full"
          >
            {isTranslating || loadingProgress ? 'Traduction en cours...' : 'Traduire'}
          </Button>

          {/* Progression */}
          {loadingProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Statut: {loadingProgress.status}</span>
                {loadingProgress.progress && (
                  <span>{loadingProgress.progress}%</span>
                )}
              </div>
              {loadingProgress.progress && (
                <Progress value={loadingProgress.progress} className="w-full" />
              )}
            </div>
          )}

          {/* Erreur */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-red-800">{error}</div>
              </CardContent>
            </Card>
          )}

          {/* Résultat */}
          {translationResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">✅ Résultat de la Traduction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <Label className="font-semibold">Texte Traduit:</Label>
                    <p className="text-lg bg-muted p-3 rounded-md mt-1">
                      {translationResult.translatedText}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label className="font-semibold">Modèle:</Label>
                      <p>{translationResult.modelUsed}</p>
                    </div>
                    <div>
                      <Label className="font-semibold">Direction:</Label>
                      <p>{translationResult.sourceLanguage} → {translationResult.targetLanguage}</p>
                    </div>
                    <div>
                      <Label className="font-semibold">Confiance:</Label>
                      <p>{Math.round((translationResult.confidence || 0) * 100)}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
