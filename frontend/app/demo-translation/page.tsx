'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Languages, Zap, Globe, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TranslationResult {
  translated_text: string;
  source_language: string;
  target_language: string;
  original_text: string;
  confidence: number;
  timestamp: string;
}

interface WebSocketTranslation {
  type: 'translation' | 'error';
  messageId: string;
  originalText: string;
  translatedText?: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
  fromCache?: boolean;
  modelUsed?: string;
  error?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

const getModelInfo = (tier: string) => {
  switch (tier) {
    case 'basic':
      return {
        name: 'Basic (M2M100-418M)',
        color: 'bg-green-100 text-green-800',
        icon: <Zap className="w-3 h-3" />,
        description: '< 20 caractères - Rapide'
      };
    case 'medium':
      return {
        name: 'Medium (M2M100-1.2B)',
        color: 'bg-blue-100 text-blue-800',
        icon: <Globe className="w-3 h-3" />,
        description: '20-100 caractères - Équilibré'
      };
    case 'premium':
      return {
        name: 'Premium (NLLB-200-3.3B)',
        color: 'bg-purple-100 text-purple-800',
        icon: <Brain className="w-3 h-3" />,
        description: '> 100 caractères - Précis'
      };
    default:
      return {
        name: 'Inconnu',
        color: 'bg-gray-100 text-gray-800',
        icon: <Languages className="w-3 h-3" />,
        description: ''
      };
  }
};

const getPredictedModel = (textLength: number): string => {
  if (textLength < 20) return 'basic';
  if (textLength <= 100) return 'medium';
  return 'premium';
};

export default function DemoTranslationPage() {
  const [text, setText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [testMode, setTestMode] = useState<'rest' | 'websocket'>('rest');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Vérifier le statut du backend au chargement
  useEffect(() => {
    checkBackendStatus();
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [websocket]);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        const data = await response.json();
        setBackendStatus('online');
        console.log('Backend health:', data);
      } else {
        setBackendStatus('offline');
      }
    } catch (err) {
      console.error('Erreur vérification backend:', err);
      setBackendStatus('offline');
    }
  };

  const connectWebSocket = () => {
    if (websocket) {
      websocket.close();
    }

    setWsStatus('connecting');
    const ws = new WebSocket('ws://localhost:3000/ws');
    
    ws.onopen = () => {
      console.log('WebSocket connecté');
      setWsStatus('connected');
      setWebsocket(ws);
    };

    ws.onmessage = (event) => {
      const data: WebSocketTranslation = JSON.parse(event.data);
      console.log('Message WebSocket reçu:', data);
      
      if (data.type === 'translation') {
        setResult({
          translated_text: data.translatedText || '',
          source_language: data.sourceLanguage,
          target_language: data.targetLanguage,
          original_text: data.originalText,
          confidence: data.confidence || 0,
          timestamp: new Date().toISOString()
        });
        setIsTranslating(false);
      } else if (data.type === 'error') {
        setError(data.error || 'Erreur de traduction');
        setIsTranslating(false);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket fermé');
      setWsStatus('disconnected');
      setWebsocket(null);
    };

    ws.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
      setWsStatus('disconnected');
      setError('Erreur de connexion WebSocket');
      setIsTranslating(false);
    };
  };

  const handleTranslateREST = async () => {
    if (!text.trim()) return;

    setIsTranslating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          source_language: sourceLanguage === 'auto' ? 'fr' : sourceLanguage, // Fallback pour auto-detect
          target_language: targetLanguage,
        }),
      });

      const data: TranslationResult = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(`Erreur ${response.status}: ${data}`);
      }
    } catch (err) {
      console.error('Erreur de traduction:', err);
      setError('Impossible de se connecter au service de traduction');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateWebSocket = async () => {
    if (!text.trim() || !websocket || websocket.readyState !== WebSocket.OPEN) {
      setError('WebSocket non connecté');
      return;
    }

    setIsTranslating(true);
    setError(null);
    setResult(null);

    const message = {
      type: 'translate',
      messageId: `demo-${Date.now()}`,
      text: text.trim(),
      sourceLanguage: sourceLanguage === 'auto' ? 'fr' : sourceLanguage,
      targetLanguage: targetLanguage,
    };

    websocket.send(JSON.stringify(message));
  };

  const handleTranslate = () => {
    if (testMode === 'rest') {
      handleTranslateREST();
    } else {
      handleTranslateWebSocket();
    }
  };

  const clearResults = () => {
    setText('');
    setResult(null);
    setError(null);
  };

  const predictedModel = getPredictedModel(text.length);
  const modelInfo = getModelInfo(predictedModel);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Languages className="w-10 h-10 text-blue-600" />
            Démo Traduction Meeshy
          </h1>
          <p className="text-gray-600">
            Testez la pipeline complète de traduction avec sélection automatique de modèles IA
          </p>
          
          {/* Statut Backend */}
          <div className="flex justify-center">
            <Badge 
              variant={backendStatus === 'online' ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              <div className={`w-2 h-2 rounded-full ${
                backendStatus === 'online' ? 'bg-green-500' : 
                backendStatus === 'offline' ? 'bg-red-500' : 
                'bg-yellow-500'
              }`} />
              Backend: {
                backendStatus === 'online' ? 'En ligne' :
                backendStatus === 'offline' ? 'Hors ligne' :
                'Vérification...'
              }
            </Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Panneau de saisie */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Texte à traduire
              </CardTitle>
              <CardDescription>
                Saisissez votre texte (max 300 caractères)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sélection des langues */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Langue source
                  </label>
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔍 Détection automatique</SelectItem>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Langue cible
                  </label>
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

              {/* Zone de texte */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Votre texte
                  </label>
                  <span className={`text-xs ${
                    text.length > 300 ? 'text-red-500' : 
                    text.length > 250 ? 'text-yellow-500' : 
                    'text-gray-500'
                  }`}>
                    {text.length}/300
                  </span>
                </div>
                <Textarea
                  value={text}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value.slice(0, 300))}
                  placeholder="Tapez votre texte ici..."
                  className="min-h-[120px] resize-none"
                  disabled={isTranslating}
                />
              </div>

              {/* Prédiction du modèle */}
              {text.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Modèle prédit:</span>
                    <Badge className={`${modelInfo.color} flex items-center gap-1`}>
                      {modelInfo.icon}
                      {modelInfo.name}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{modelInfo.description}</p>
                </div>
              )}

              {/* Mode de test */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Mode de test
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={testMode === 'rest' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTestMode('rest')}
                      className="flex-1"
                    >
                      REST API
                    </Button>
                    <Button
                      variant={testMode === 'websocket' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTestMode('websocket')}
                      className="flex-1"
                    >
                      WebSocket
                    </Button>
                  </div>
                </div>

                {/* Contrôles WebSocket */}
                {testMode === 'websocket' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">Statut WebSocket</span>
                      <Badge variant={wsStatus === 'connected' ? 'default' : 'secondary'}>
                        <div className={`w-2 h-2 rounded-full mr-1 ${
                          wsStatus === 'connected' ? 'bg-green-500' : 
                          wsStatus === 'connecting' ? 'bg-yellow-500' : 
                          'bg-red-500'
                        }`} />
                        {wsStatus === 'connected' ? 'Connecté' :
                         wsStatus === 'connecting' ? 'Connexion...' :
                         'Déconnecté'}
                      </Badge>
                    </div>
                    {wsStatus !== 'connected' && (
                      <Button
                        size="sm"
                        onClick={connectWebSocket}
                        disabled={wsStatus === 'connecting'}
                        className="w-full"
                      >
                        {wsStatus === 'connecting' ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Connexion...
                          </>
                        ) : (
                          'Se connecter au WebSocket'
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-2">
                <Button
                  onClick={handleTranslate}
                  disabled={
                    !text.trim() || 
                    isTranslating || 
                    backendStatus !== 'online' ||
                    (testMode === 'websocket' && wsStatus !== 'connected')
                  }
                  className="flex-1"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Traduction...
                    </>
                  ) : (
                    <>
                      <Languages className="w-4 h-4 mr-2" />
                      Traduire via {testMode === 'rest' ? 'REST' : 'WebSocket'}
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={clearResults}
                  disabled={isTranslating}
                >
                  Effacer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Panneau de résultats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Résultat de traduction
              </CardTitle>
              <CardDescription>
                Traduction avec métadonnées détaillées
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {result && (
                <div className="space-y-4">
                  {/* Texte traduit */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <label className="text-sm font-medium text-green-800 block mb-1">
                      Traduction
                    </label>
                    <p className="text-green-900 text-lg leading-relaxed">
                      {result.translated_text}
                    </p>
                  </div>

                  {/* Métadonnées */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Langue source:</span>
                      <Badge variant="outline">
                        {SUPPORTED_LANGUAGES.find(l => l.code === result.source_language)?.flag} 
                        {result.source_language.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Langue cible:</span>
                      <Badge variant="outline">
                        {SUPPORTED_LANGUAGES.find(l => l.code === result.target_language)?.flag}
                        {result.target_language.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Modèle utilisé:</span>
                      <Badge className={getModelInfo(predictedModel).color}>
                        {getModelInfo(predictedModel).icon}
                        {predictedModel.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Timestamp:</span>
                      <span className="font-mono text-xs">{new Date(result.timestamp).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Confiance:</span>
                      <span className="font-mono">{(result.confidence * 100).toFixed(1)}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mode:</span>
                      <Badge variant="outline">
                        {testMode === 'rest' ? "REST API" : "WebSocket"}
                      </Badge>
                    </div>
                  </div>

                  {/* Statistiques du modèle */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-1">
                      {getModelInfo(predictedModel).icon}
                      Informations sur le modèle {predictedModel}
                    </h4>
                    <p className="text-blue-800 text-sm">
                      {getModelInfo(predictedModel).description}
                    </p>
                  </div>
                </div>
              )}

              {!result && !error && !isTranslating && (
                <div className="text-center py-12 text-gray-500">
                  <Languages className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Entrez du texte et cliquez sur &quot;Traduire&quot; pour voir les résultats</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Informations sur les modèles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Sélection automatique des modèles IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <h3 className="font-medium text-green-900">Modèle Basic</h3>
                </div>
                <p className="text-sm text-green-800 mb-2">M2M100-418M</p>
                <p className="text-xs text-green-700">
                  Texte &lt; 20 caractères<br/>
                  Traduction rapide pour mots et phrases courtes
                </p>
              </div>

              <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-blue-600" />  
                  <h3 className="font-medium text-blue-900">Modèle Medium</h3>
                </div>
                <p className="text-sm text-blue-800 mb-2">M2M100-1.2B</p>
                <p className="text-xs text-blue-700">
                  Texte 20-100 caractères<br/>
                  Équilibre entre vitesse et précision
                </p>
              </div>

              <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <h3 className="font-medium text-purple-900">Modèle Premium</h3>
                </div>
                <p className="text-sm text-purple-800 mb-2">NLLB-200-3.3B</p>
                <p className="text-xs text-purple-700">
                  Texte &gt; 100 caractères<br/>
                  Précision maximale pour textes complexes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
