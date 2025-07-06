'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayCircle, RotateCcw, Globe, Clock, Zap, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import { toast } from 'sonner';

// Configuration des couleurs et noms de modèles
const MODEL_COLORS: Record<string, string> = {
  'mt5-small': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'mt5-base': 'bg-emerald-200 text-emerald-900 border-emerald-300',
  'nllb-distilled-600M': 'bg-orange-100 text-orange-800 border-orange-200',
  'nllb-1.3B': 'bg-orange-200 text-orange-900 border-orange-300'
};

const MODEL_NAMES: Record<string, string> = {
  'mt5-small': 'mT5 Small',
  'mt5-base': 'mT5 Base',
  'nllb-distilled-600M': 'NLLB Distilled 600M',
  'nllb-1.3B': 'NLLB 1.3B'
};

// Liste complète des langues supportées
const LANGUAGES = [
  { code: 'auto', name: 'Détection automatique', flag: '🔄' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'bg', name: 'Български', flag: '🇧🇬' },
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'tl', name: 'Filipino', flag: '🇵🇭' }
];

// Exemples de textes pour tests
const TEST_SAMPLES = [
  { 
    text: "Bonjour, comment allez-vous ?", 
    category: "Simple", 
    description: "Message de salutation basique" 
  },
  { 
    text: "Je souhaiterais réserver une table pour quatre personnes ce soir vers 19h30 si c'est possible.", 
    category: "Moyen", 
    description: "Phrase de réservation avec détails" 
  },
  { 
    text: "L'intelligence artificielle représente une révolution technologique majeure qui transforme radicalement notre approche de l'automatisation et de l'analyse de données complexes.", 
    category: "Complexe", 
    description: "Texte technique et conceptuel" 
  },
  {
    text: "Dans un monde interconnecté où les barrières linguistiques constituent souvent un obstacle à la communication interculturelle, les technologies de traduction automatique jouent un rôle fondamental.",
    category: "Académique",
    description: "Texte académique avec terminologie spécialisée"
  }
];

interface TestResult {
  model: string;
  translatedText: string;
  duration: number;
  quality: number;
  memoryUsage: number;
  status: 'success' | 'error' | 'running';
  errorMessage?: string;
}

export function EnhancedSystemTestComponent() {
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [inputText, setInputText] = useState('');
  const [loadedModels, setLoadedModels] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [testMode, setTestMode] = useState<'custom' | 'samples'>('custom');

  useEffect(() => {
    // Charger les modèles depuis localStorage
    const savedModels = localStorage.getItem('meeshy-loaded-models');
    if (savedModels) {
      const models = JSON.parse(savedModels);
      setLoadedModels(models);
      setSelectedModels(Object.keys(models).filter(key => models[key]));
    }
  }, []);

  const getAvailableModels = () => {
    return Object.entries(loadedModels)
      .filter(([, isLoaded]) => isLoaded)
      .map(([modelKey]) => modelKey);
  };

  const getModelColor = (modelKey: string): string => {
    return MODEL_COLORS[modelKey] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getLanguageDisplay = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };

  const simulateTranslation = async (model: string, text: string): Promise<TestResult> => {
    // Simulation réaliste de traduction
    const baseTime = text.length * (model.includes('mt5') ? 2 : 3); // mT5 plus rapide
    const randomVariation = Math.random() * 0.5 + 0.75; // 75-125% du temps de base
    const duration = Math.round(baseTime * randomVariation);
    
    await new Promise(resolve => setTimeout(resolve, duration));

    // Simulation de qualité basée sur le modèle et la complexité du texte
    const complexityFactor = text.length > 100 ? 0.9 : text.length > 50 ? 0.95 : 1.0;
    const modelQuality = model.includes('1.3B') ? 0.95 : model.includes('base') ? 0.9 : 0.85;
    const quality = Math.round((modelQuality * complexityFactor + Math.random() * 0.1) * 100);

    // Simulation d'usage mémoire
    const baseMemory = model.includes('1.3B') ? 2400 : model.includes('base') ? 1200 : model.includes('600M') ? 1100 : 580;
    const memoryUsage = baseMemory + Math.round(Math.random() * 100);

    // Exemple de traduction simulée
    const translatedText = `[Traduction ${MODEL_NAMES[model]}] ${text.substring(0, 50)}...`;

    return {
      model,
      translatedText,
      duration,
      quality,
      memoryUsage,
      status: 'success' as const
    };
  };

  const runTest = async (textToTest: string) => {
    const availableModels = getAvailableModels();
    
    if (availableModels.length === 0) {
      toast.error('Aucun modèle téléchargé disponible pour les tests');
      return;
    }

    if (!textToTest.trim()) {
      toast.error('Veuillez saisir du texte à traduire');
      return;
    }

    if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) {
      toast.error('Les langues source et destination doivent être différentes');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setTestResults([]);

    const modelsToTest = selectedModels.length > 0 ? selectedModels.filter(m => availableModels.includes(m)) : availableModels;

    try {
      for (let i = 0; i < modelsToTest.length; i++) {
        const model = modelsToTest[i];
        setProgress(((i + 1) / modelsToTest.length) * 100);

        try {
          const result = await simulateTranslation(model, textToTest);
          setTestResults(prev => [...prev, result]);
          toast.success(`Test ${MODEL_NAMES[model]} terminé`);
        } catch {
          const errorResult: TestResult = {
            model,
            translatedText: '',
            duration: 0,
            quality: 0,
            memoryUsage: 0,
            status: 'error' as const,
            errorMessage: 'Erreur lors de la traduction'
          };
          setTestResults(prev => [...prev, errorResult]);
          toast.error(`Erreur test ${MODEL_NAMES[model]}`);
        }
      }

      toast.success('Tests terminés avec succès');
    } catch (error) {
      console.error('Erreur lors des tests:', error);
      toast.error('Erreur lors des tests de performance');
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setProgress(0);
  };

  const toggleModelSelection = (model: string) => {
    setSelectedModels(prev => 
      prev.includes(model) 
        ? prev.filter(m => m !== model)
        : [...prev, model]
    );
  };

  return (
    <div className="space-y-6">
      {/* Légende des couleurs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200"></div>
              <span className="text-sm font-medium text-emerald-800">Modèles mT5 (tons verts)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200"></div>
              <span className="text-sm font-medium text-orange-800">Modèles NLLB (tons orange)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={testMode} onValueChange={(value) => setTestMode(value as 'custom' | 'samples')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="custom">Test personnalisé</TabsTrigger>
          <TabsTrigger value="samples">Tests prédéfinis</TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Configuration de la traduction
              </CardTitle>
              <CardDescription>
                Configurez les langues et le texte pour tester les modèles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Langue source</Label>
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {getLanguageDisplay(lang.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Langue destination</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {getLanguageDisplay(lang.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Texte à traduire</Label>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Saisissez le texte à traduire pour tester les modèles..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="samples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tests prédéfinis</CardTitle>
              <CardDescription>
                Sélectionnez un exemple de texte pour comparer les modèles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Langue destination</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {getLanguageDisplay(lang.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TEST_SAMPLES.map((sample, index) => (
                  <Card key={index} className="cursor-pointer hover:bg-muted/50 transition-colors" 
                        onClick={() => setInputText(sample.text)}>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{sample.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {sample.text.length} caractères
                          </span>
                        </div>
                        <p className="text-sm font-medium">{sample.description}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {sample.text}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration des modèles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Modèles à tester
          </CardTitle>
          <CardDescription>
            Sélectionnez les modèles téléchargés à inclure dans les tests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {getAvailableModels().length === 0 ? (
            <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-amber-700">
                Aucun modèle téléchargé. Rendez-vous dans l&apos;onglet Modèles pour télécharger des modèles.
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label>Modèles disponibles ({getAvailableModels().length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const available = getAvailableModels();
                    setSelectedModels(selectedModels.length === available.length ? [] : available);
                  }}
                >
                  {selectedModels.length === getAvailableModels().length ? 'Désélectionner tout' : 'Sélectionner tout'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getAvailableModels().map((model) => (
                  <div
                    key={model}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedModels.includes(model) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleModelSelection(model)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model)}
                        onChange={() => toggleModelSelection(model)}
                        className="h-4 w-4"
                      />
                      <div>
                        <span className="font-medium">{MODEL_NAMES[model]}</span>
                        <Badge className={`ml-2 ${getModelColor(model)}`} variant="outline">
                          {model.startsWith('mt5') ? 'mT5' : 'NLLB'}
                        </Badge>
                      </div>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contrôles de test */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Button
              onClick={() => runTest(inputText)}
              disabled={isRunning || !inputText.trim() || getAvailableModels().length === 0}
              className="flex-1"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {isRunning ? 'Test en cours...' : 'Lancer le test'}
            </Button>
            <Button
              onClick={clearResults}
              variant="outline"
              disabled={testResults.length === 0 && !isRunning}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Effacer
            </Button>
          </div>

          {isRunning && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progression du test...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Résultats */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Résultats de performance
            </CardTitle>
            <CardDescription>
              Comparaison des modèles pour : {sourceLanguage === 'auto' ? 'Auto' : getLanguageDisplay(sourceLanguage)} → {getLanguageDisplay(targetLanguage)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {testResults.map((result, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={getModelColor(result.model)} variant="outline">
                      {MODEL_NAMES[result.model]}
                    </Badge>
                    <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                      {result.status === 'success' ? 'Succès' : 'Erreur'}
                    </Badge>
                  </div>
                  
                  {result.status === 'success' && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{result.duration}ms</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        <span>{result.quality}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Database className="h-4 w-4" />
                        <span>{Math.round(result.memoryUsage)}MB</span>
                      </div>
                    </div>
                  )}
                </div>

                {result.status === 'success' ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Traduction :</Label>
                    <p className="text-sm bg-muted/50 p-3 rounded border">
                      {result.translatedText}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">{result.errorMessage}</span>
                  </div>
                )}
              </div>
            ))}

            {testResults.filter(r => r.status === 'success').length > 1 && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Résumé comparatif</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Plus rapide : </span>
                    {testResults
                      .filter(r => r.status === 'success')
                      .reduce((fastest, current) => 
                        current.duration < fastest.duration ? current : fastest
                      ).model}
                  </div>
                  <div>
                    <span className="font-medium">Meilleure qualité : </span>
                    {testResults
                      .filter(r => r.status === 'success')
                      .reduce((best, current) => 
                        current.quality > best.quality ? current : best
                      ).model}
                  </div>
                  <div>
                    <span className="font-medium">Moins de mémoire : </span>
                    {testResults
                      .filter(r => r.status === 'success')
                      .reduce((lightest, current) => 
                        current.memoryUsage < lightest.memoryUsage ? current : lightest
                      ).model}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
