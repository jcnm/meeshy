'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { translateMessage, detectLanguage } from '@/utils/translation';
import { runQuickTest } from '@/utils/test-runner';
import { Loader2, Send, TestTube } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
];

export function TranslationTest() {
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [error, setError] = useState('');

  const handleDetectLanguage = () => {
    if (inputText.trim()) {
      const detected = detectLanguage(inputText);
      setDetectedLang(detected);
      setSourceLang(detected);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim() || !sourceLang || !targetLang) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsTranslating(true);
    setError('');
    setTranslatedText('');

    try {
      const result = await translateMessage(inputText, sourceLang, targetLang);
      setTranslatedText(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de traduction');
      console.error('Erreur de traduction:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRunAutoTest = async () => {
    setIsRunningTest(true);
    setError('');
    console.log('🧪 Démarrage du test automatique...');
    
    try {
      await runQuickTest();
      console.log('✅ Test automatique terminé');
    } catch (err) {
      console.error('❌ Test automatique échoué:', err);
      setError('Test automatique échoué - voir console pour détails');
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Test de Traduction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test automatique */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h3 className="font-medium mb-2">Test Automatique du Système</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Lance un test complet du téléchargement de modèles et de traduction (voir console F12).
          </p>
          <Button 
            onClick={handleRunAutoTest} 
            disabled={isRunningTest}
            variant="outline"
            className="w-full"
          >
            {isRunningTest ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Lancer le test automatique
              </>
            )}
          </Button>
        </div>

        {/* Texte d'entrée */}
        <div className="space-y-2">
          <Label htmlFor="input-text">Texte à traduire</Label>
          <Input
            id="input-text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Entrez votre texte ici..."
            className="min-h-[80px]"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDetectLanguage}
            disabled={!inputText.trim()}
          >
            Détecter la langue
          </Button>
          {detectedLang && (
            <p className="text-sm text-muted-foreground">
              Langue détectée: {languages.find(l => l.code === detectedLang)?.name || detectedLang}
            </p>
          )}
        </div>

        {/* Sélection des langues */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Langue source</Label>
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Langue cible</Label>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bouton de traduction */}
        <Button 
          onClick={handleTranslate} 
          disabled={isTranslating || !inputText.trim() || !sourceLang || !targetLang}
          className="w-full"
        >
          {isTranslating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Traduction en cours...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Traduire
            </>
          )}
        </Button>

        {/* Résultat */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {translatedText && (
          <div className="space-y-2">
            <Label>Traduction</Label>
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-700">{translatedText}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
