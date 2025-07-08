/**
 * Composant de test pour le service de traduction unifié
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, Trash2, Brain, Zap, CheckCircle } from 'lucide-react';
import { 
  translationService, 
  type TranslationProgress, 
  type TranslationResult 
} from '@/services';
import { 
  ACTIVE_MODELS,
  type AllowedModelType 
} from '@/lib/unified-model-config';

// Types simplifiés
interface ModelStats {
  loadedModels: AllowedModelType[];
  totalModels: number;
  cacheSize: number;
  totalTranslations: number;
  cacheHitRate?: number; // Optionnel
}

interface Language {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'fra_Latn', name: 'Français', flag: '🇫🇷' },
  { code: 'eng_Latn', name: 'Anglais', flag: '🇺🇸' },
  { code: 'spa_Latn', name: 'Espagnol', flag: '🇪🇸' },
  { code: 'deu_Latn', name: 'Allemand', flag: '🇩🇪' },
  { code: 'ita_Latn', name: 'Italien', flag: '🇮🇹' },
  { code: 'por_Latn', name: 'Portugais', flag: '🇵🇹' },
  { code: 'rus_Cyrl', name: 'Russe', flag: '🇷🇺' },
  { code: 'zho_Hans', name: 'Chinois (Simplifié)', flag: '🇨🇳' },
  { code: 'jpn_Jpan', name: 'Japonais', flag: '🇯🇵' },
  { code: 'ara_Arab', name: 'Arabe', flag: '🇸🇦' }
];

export default function HuggingFaceTranslationTest() {
  // États pour l'interface
  const [inputText, setInputText] = useState('Bonjour, comment allez-vous ?');
  const [sourceLanguage, setSourceLanguage] = useState('fra_Latn');
  const [targetLanguage, setTargetLanguage] = useState('eng_Latn');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // États pour les modèles
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<TranslationProgress | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AllowedModelType>(ACTIVE_MODELS.basicModel);

  // Charger l'état initial
  useEffect(() => {
    console.log('📂 Modèles persistés au démarrage:', translationService.getPersistedLoadedModels());
    updateModelStats();
  }, []);

  // Mettre à jour les statistiques des modèles
  const updateModelStats = useCallback(() => {
    const stats = translationService.getModelStats();
    setModelStats(stats);
  }, []);

  // Gestionnaire de progression
  const handleProgress = useCallback((progress: TranslationProgress) => {
    setDownloadProgress(progress);
    console.log('📥 Progression:', progress);
  }, []);

  // Test de traduction
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) {
      setError('Veuillez saisir du texte à traduire');
      return;
    }

    setIsTranslating(true);
    setError(null);
    setTranslatedText('');

    try {
      const result = await translationService.translateText(
        inputText,
        sourceLanguage,
        targetLanguage,
        selectedModel
      );
      
      setTranslatedText(result.translatedText);
      updateModelStats();
      console.log('✅ Traduction réussie:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction inconnue';
      setError(errorMessage);
      console.error('❌ Erreur de traduction:', err);
    } finally {
      setIsTranslating(false);
    }
  }, [inputText, sourceLanguage, targetLanguage, selectedModel, updateModelStats]);

  // Précharger les modèles recommandés
  const handlePreloadModels = useCallback(async () => {
    setIsPreloading(true);
    setDownloadProgress(null);
    
    try {
      await translationService.preloadRecommendedModels(handleProgress);
      updateModelStats();
      console.log('✅ Préchargement terminé');
    } catch (err) {
      console.error('❌ Erreur de préchargement:', err);
    } finally {
      setIsPreloading(false);
      setDownloadProgress(null);
    }
  }, [handleProgress, updateModelStats]);

  // Vider tous les modèles
  const handleClearModels = useCallback(async () => {
    try {
      await translationService.unloadAllModels();
      updateModelStats();
      setDownloadProgress(null);
      console.log('🗑️ Tous les modèles ont été supprimés');
    } catch (err) {
      console.error('❌ Erreur lors du nettoyage:', err);
    }
  }, [updateModelStats]);

  // Vider le cache
  const handleClearCache = useCallback(() => {
    translationService.clearCache();
    updateModelStats();
    console.log('🗑️ Cache vidé');
  }, [updateModelStats]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🌐 Test de Traduction Unifié</h1>
        <p className="text-muted-foreground">
          Interface de test pour le service de traduction Meeshy
        </p>
      </div>

      {/* Statistiques des modèles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Statistiques des Modèles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {modelStats?.loadedModels.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Modèles chargés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {modelStats?.cacheSize || 0}
              </div>
              <div className="text-sm text-muted-foreground">Cache</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {modelStats?.totalTranslations || 0}
              </div>
              <div className="text-sm text-muted-foreground">Traductions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {modelStats?.cacheHitRate?.toFixed(1) || '0'}%
              </div>
              <div className="text-sm text-muted-foreground">Cache hit</div>
            </div>
          </div>
          
          {modelStats?.loadedModels && modelStats.loadedModels.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm font-medium">Modèles en mémoire:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {modelStats.loadedModels.map((model) => (
                  <Badge key={model} variant="secondary">
                    {model}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progression des téléchargements */}
      {downloadProgress && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>📥 {downloadProgress.modelName}</span>
                <span>{downloadProgress.status}</span>
              </div>
              {downloadProgress.progress !== undefined && (
                <Progress value={downloadProgress.progress} className="w-full" />
              )}
              {downloadProgress.error && (
                <Alert>
                  <AlertDescription>{downloadProgress.error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interface de test */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>⚙️ Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sélection du modèle */}
            <div className="space-y-2">
              <Label>Modèle de traduction</Label>
              <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value as AllowedModelType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ACTIVE_MODELS.basicModel}>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Modèle de base (rapide)
                    </div>
                  </SelectItem>
                  <SelectItem value={ACTIVE_MODELS.highModel}>
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Modèle avancé (précis)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Langues */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Langue source</Label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Langue cible</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Actions de gestion */}
            <div className="space-y-2">
              <Button
                onClick={handlePreloadModels}
                disabled={isPreloading}
                className="w-full"
                variant="outline"
              >
                {isPreloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Préchargement...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Précharger les modèles
                  </>
                )}
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleClearModels}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Vider modèles
                </Button>
                <Button
                  onClick={handleClearCache}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Vider cache
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test de traduction */}
        <Card>
          <CardHeader>
            <CardTitle>🧪 Test de Traduction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Texte à traduire</Label>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Saisissez votre texte ici..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleTranslate}
              disabled={isTranslating || !inputText.trim()}
              className="w-full"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traduction...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Traduire
                </>
              )}
            </Button>

            {error && (
              <Alert>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {translatedText && (
              <div className="space-y-2">
                <Label>Résultat</Label>
                <div className="p-3 bg-secondary rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Traduction réussie</span>
                  </div>
                  <p className="text-sm">{translatedText}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
