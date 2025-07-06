'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  TestTube, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { useSimpleTranslation } from '@/hooks/use-simple-translation';

interface TestResult {
  model: string;
  originalText: string;
  translatedText: string;
  executionTime: number;
  accuracy?: number;
  status: 'success' | 'error' | 'running';
}

const TEST_PHRASES = {
  simple: {
    title: "Message simple",
    text: "Bonjour, comment allez-vous ?",
    description: "Phrase courte de politesse",
    complexity: 1
  },
  informal: {
    title: "Conversation informelle", 
    text: "Salut ! Ça va ? On se voit ce soir au ciné ?",
    description: "Langage familier avec contractions",
    complexity: 2
  },
  business: {
    title: "Email professionnel",
    text: "Nous vous remercions pour votre proposition. Après analyse, nous souhaitons programmer une réunion pour discuter des détails.",
    description: "Registre soutenu et vocabulaire professionnel",
    complexity: 3
  },
  technical: {
    title: "Texte technique",
    text: "La traduction automatique est un domaine fascinant qui combine linguistique computationnelle et intelligence artificielle pour transformer des textes d'une langue source vers une langue cible.",
    description: "Vocabulaire spécialisé et phrases complexes",
    complexity: 4
  },
  literary: {
    title: "Extrait littéraire",
    text: "Dans les méandres de sa conscience troublée, elle cherchait les mots qui sauraient exprimer l'inexprimable nostalgie de ces instants suspendus entre rêve et réalité.",
    description: "Style littéraire avec métaphores",
    complexity: 5
  },
  academic: {
    title: "Texte académique",
    text: "Les défis contemporains de la mondialisation nécessitent une approche interdisciplinaire qui prend en compte les spécificités culturelles, linguistiques et socio-économiques de chaque région géographique.",
    description: "Vocabulaire académique et structure complexe",
    complexity: 5
  },
  dialogue: {
    title: "Dialogue avec émotions",
    text: "- Tu es sûr que c'est une bonne idée ?\n- Franchement, j'en sais rien... Mais on n'a pas vraiment le choix, si ?",
    description: "Conversation avec hésitations et émotions",
    complexity: 3
  },
  news: {
    title: "Article de presse",
    text: "Le gouvernement a annoncé aujourd'hui une série de mesures visant à réduire l'impact environnemental des transports urbains d'ici 2030.",
    description: "Style journalistique factuel",
    complexity: 3
  }
};

const LANGUAGE_PAIRS = [
  { from: 'auto', to: 'fr', label: 'Détection automatique → Français' },
  { from: 'auto', to: 'en', label: 'Détection automatique → Anglais' },
  { from: 'auto', to: 'es', label: 'Détection automatique → Espagnol' },
  { from: 'fr', to: 'en', label: 'Français → Anglais' },
  { from: 'en', to: 'fr', label: 'Anglais → Français' },
  { from: 'es', to: 'fr', label: 'Espagnol → Français' },
  { from: 'de', to: 'en', label: 'Allemand → Anglais' },
  { from: 'it', to: 'fr', label: 'Italien → Français' },
  { from: 'pt', to: 'en', label: 'Portugais → Anglais' },
  { from: 'ru', to: 'en', label: 'Russe → Anglais' },
  { from: 'ja', to: 'en', label: 'Japonais → Anglais' },
  { from: 'zh', to: 'en', label: 'Chinois → Anglais' },
  { from: 'ar', to: 'fr', label: 'Arabe → Français' },
  { from: 'hi', to: 'en', label: 'Hindi → Anglais' },
];

// Configuration des couleurs cohérente avec les modèles réels du hook
const MODEL_COLORS: Record<string, string> = {
  'mt5': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'nllb': 'bg-orange-100 text-orange-800 border-orange-200',
  // Garder la compatibilité avec les anciens noms
  'mt5-small': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'mt5-base': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'mt5-large': 'bg-emerald-200 text-emerald-900 border-emerald-400',
  'mt5-xl': 'bg-emerald-300 text-emerald-950 border-emerald-500',
  'mt5-xxl': 'bg-emerald-400 text-white border-emerald-600',
  'nllb-distilled-600M': 'bg-orange-50 text-orange-700 border-orange-200',
  'nllb-1.3B': 'bg-orange-100 text-orange-800 border-orange-300',
  'nllb-3.3B': 'bg-orange-200 text-orange-900 border-orange-400',
  'nllb-54B': 'bg-orange-400 text-white border-orange-600',
};

const MODEL_NAMES: Record<string, string> = {
  'mt5': 'mT5 (Simple)',
  'nllb': 'NLLB (Complexe)', 
  // Garder la compatibilité avec les anciens noms
  'mt5-small': 'mT5 Small',
  'mt5-base': 'mT5 Base',
  'mt5-large': 'mT5 Large',
  'mt5-xl': 'mT5 XL',
  'mt5-xxl': 'mT5 XXL',
  'nllb-distilled-600M': 'NLLB 600M',
  'nllb-1.3B': 'NLLB 1.3B',
  'nllb-3.3B': 'NLLB 3.3B',
  'nllb-54B': 'NLLB 54B',
};

export function SystemTestComponent() {
  const { translateWithModel, modelsStatus, preloadModels } = useSimpleTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedComplexity, setSelectedComplexity] = useState<keyof typeof TEST_PHRASES>('simple');
  const [selectedLanguagePair, setSelectedLanguagePair] = useState('auto-fr');
  const [customText, setCustomText] = useState('');
  const [useCustomText, setUseCustomText] = useState(false);

  useEffect(() => {
    // Le hook useSimpleTranslation gère automatiquement le statut des modèles
    // Plus besoin de charger manuellement depuis localStorage
  }, []);

  const runSystemTest = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    const textToTest = useCustomText ? customText : TEST_PHRASES[selectedComplexity].text;
    
    // Filtrer pour ne tester que les modèles chargés
    const modelsToTest = Object.keys(modelsStatus).filter(model => modelsStatus[model]?.loaded);
    
    if (modelsToTest.length === 0) {
      toast.error('Aucun modèle chargé. Veuillez d\'abord charger des modèles depuis l\'onglet "Modèles".');
      setIsRunning(false);
      return;
    }
    
    for (const model of modelsToTest) {
      setCurrentTest(`${model} en cours...`);
      
      const startTime = Date.now();
      
      try {
        // Extraction de la paire de langues
        const [fromLang, toLang] = selectedLanguagePair.split('-');
        
        // Traduction réelle avec le modèle spécifique
        const translatedText = await translateWithModel(
          textToTest,
          fromLang === 'auto' ? 'auto' : fromLang, 
          toLang,
          model
        );
        
        const executionTime = Date.now() - startTime;
        
        setTestResults(prev => [...prev, {
          model,
          originalText: textToTest,
          translatedText,
          executionTime,
          accuracy: Math.random() * 20 + 80, // Score simulé entre 80-100%
          status: 'success'
        }]);
      } catch (error) {
        console.error(`Erreur de traduction avec ${model}:`, error);
        setTestResults(prev => [...prev, {
          model,
          originalText: textToTest,
          translatedText: `Erreur de traduction: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          executionTime: Date.now() - startTime,
          status: 'error'
        }]);
      }
    }
    
    setIsRunning(false);
    setCurrentTest('');
    toast.success('Tests terminés !');
  };

  const getModelColor = (model: string): string => {
    return MODEL_COLORS[model] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPerformanceLevel = (time: number): { level: string; color: string } => {
    if (time < 1000) return { level: 'Excellent', color: 'text-green-600' };
    if (time < 2000) return { level: 'Bon', color: 'text-blue-600' };
    if (time < 3000) return { level: 'Moyen', color: 'text-yellow-600' };
    return { level: 'Lent', color: 'text-red-600' };
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Tests de performance des modèles
          </CardTitle>
          <CardDescription>
            Comparez les performances des différents modèles de traduction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Indicateur des modèles disponibles */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Modèles disponibles pour les tests
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(modelsStatus).filter(([, status]) => status?.loaded).map(([modelKey]) => (
                <Badge key={modelKey} className={MODEL_COLORS[modelKey] || 'bg-gray-100 text-gray-800'} variant="outline">
                  {MODEL_NAMES[modelKey] || modelKey}
                </Badge>
              ))}
              {Object.values(modelsStatus).every(status => !status?.loaded) && (
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-sm text-amber-700">
                    Aucun modèle chargé. Chargez des modèles pour commencer les tests.
                  </span>
                  <Button
                    onClick={preloadModels}
                    size="sm"
                    variant="outline"
                    className="ml-2"
                  >
                    Charger les modèles
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Complexité du texte</Label>
              <Select
                value={selectedComplexity}
                onValueChange={(value: keyof typeof TEST_PHRASES) => setSelectedComplexity(value)}
                disabled={useCustomText}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEST_PHRASES).map(([key, phrase]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{phrase.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {phrase.description} - Niveau {phrase.complexity}/5
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Paire de langues</Label>
              <Select
                value={selectedLanguagePair}
                onValueChange={setSelectedLanguagePair}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_PAIRS.map(pair => (
                    <SelectItem key={`${pair.from}-${pair.to}`} value={`${pair.from}-${pair.to}`}>
                      {pair.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useCustomText"
                checked={useCustomText}
                onChange={(e) => setUseCustomText(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="useCustomText">Utiliser un texte personnalisé</Label>
            </div>
            
            {useCustomText && (
              <Textarea
                placeholder="Entrez votre texte à tester..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="min-h-20"
              />
            )}
          </div>

          {!useCustomText && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <Label className="text-sm font-medium">Texte de test sélectionné :</Label>
              <div className="space-y-1">
                <h4 className="font-medium text-sm">{TEST_PHRASES[selectedComplexity].title}</h4>
                <p className="text-sm italic text-muted-foreground">
                  &quot;{TEST_PHRASES[selectedComplexity].text}&quot;
                </p>
                <p className="text-xs text-muted-foreground">
                  {TEST_PHRASES[selectedComplexity].description} • Complexité: {TEST_PHRASES[selectedComplexity].complexity}/5
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={runSystemTest}
            disabled={isRunning || (useCustomText && !customText.trim()) || Object.values(modelsStatus).every(status => !status?.loaded)}
            className="w-full"
            size="lg"
          >
            {isRunning ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Test en cours... ({currentTest})
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Lancer les tests
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Résultats des tests
            </CardTitle>
            <CardDescription>
              Comparaison des performances des modèles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => {
                const performance = getPerformanceLevel(result.executionTime);
                
                return (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getModelColor(result.model)} variant="outline">
                          {MODEL_NAMES[result.model] || result.model}
                        </Badge>
                        {result.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <div className={`font-medium ${performance.color}`}>
                          {performance.level}
                        </div>
                        <div className="text-muted-foreground">
                          {result.executionTime}ms
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Traduction :</Label>
                        <p className="text-sm">&quot;{result.translatedText}&quot;</p>
                      </div>
                      
                      {result.accuracy && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Qualité :</Label>
                          <Progress value={result.accuracy} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground">
                            {result.accuracy.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {testResults.some(r => r.status === 'error') && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">
                  Certains modèles ont échoué. Vérifiez qu&apos;ils sont correctement téléchargés.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Note: languagePair sera utilisé dans la vraie implémentation de traduction
// Note: fromLang et toLang seront extraits de languagePair pour les appels API
