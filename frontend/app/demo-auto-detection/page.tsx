
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { translationService } from '@/services';
import { SUPPORTED_LANGUAGES } from '@/types';
import { Loader2, Languages } from 'lucide-react';
import { detect, detectAll } from 'tinyld'; // Importation de tinyld pour la détection de langue

export default function DemoAutoDetection() {
  const [text, setText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('fr');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<any | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showDetectionDetails, setShowDetectionDetails] = useState(false);

  // Fonction pour détecter la langue
  const detectLanguage = async () => {
    if (!text.trim()) return;
    setIsDetecting(true);
    try {
      const detections = detectAll(text);
      if (detections.length > 0) {
        setDetectedLanguage({
          language: detections[0].lang,
          confidence: detections[0].accuracy,
          detectedLanguages: detections.map(d => ({ language: d.lang, confidence: d.accuracy }))
        });
      } else {
        setDetectedLanguage(null);
      }
    } catch (error) {
      console.error('Erreur de détection de langue:', error);
      setDetectedLanguage(null);
    } finally {
      setIsDetecting(false);
    }
  };

  // Fonction pour traduire avec détection automatique préalable
  const translateWithAutoDetection = async () => {
    if (!text.trim() || !targetLanguage) return;
    
    setIsTranslating(true);
    try {
      // Détecter la langue avant d'appeler le service de traduction
      const detections = detectAll(text);
      const sourceLang = detections.length > 0 ? detections[0].lang : 'en'; // Fallback à 'en' si non détecté

      const result = await translationService.translateText({
        text,
        sourceLanguage: sourceLang,
        targetLanguage: targetLanguage,
        model: 'basic'
      });
      setTranslatedText(result.translatedText);
      
      // Mettre à jour la langue détectée pour l'affichage
      setDetectedLanguage({
        language: sourceLang,
        confidence: detections.length > 0 ? detections[0].accuracy : 0,
        detectedLanguages: detections.map(d => ({ language: d.lang, confidence: d.accuracy }))
      });

    } catch (error) {
      console.error('Erreur de traduction:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="container py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Démonstration de détection automatique de langue</h1>
      
      <div className="grid gap-6">
        {/* Entrée */}
        <Card>
          <CardHeader>
            <CardTitle>Texte source</CardTitle>
            <CardDescription>Entrez du texte dans n&apos;importe quelle langue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Entrez votre texte ici..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[150px]"
            />
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline" 
                onClick={detectLanguage}
                disabled={!text.trim() || isDetecting}
                className="flex items-center gap-2"
              >
                {isDetecting && <Loader2 className="h-4 w-4 animate-spin" />}
                Détecter la langue uniquement
              </Button>
              
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Langue cible" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                onClick={translateWithAutoDetection}
                disabled={!text.trim() || !targetLanguage || isTranslating}
                className="flex items-center gap-2"
              >
                {isTranslating && <Loader2 className="h-4 w-4 animate-spin" />}
                <Languages className="h-4 w-4" />
                Traduire avec détection auto
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Résultats de détection */}
        {detectedLanguage && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                Résultat de détection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-white p-3 rounded-md border shadow-sm">
                  <span className="text-3xl">
                    {SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage.language)?.flag || '🔍'}
                  </span>
                </div>
                
                <div>
                  <p className="text-lg font-semibold">
                    Langue détectée: {SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage.language)?.name || detectedLanguage.language}
                  </p>
                  <p className="text-sm text-gray-600">
                    Confiance: {Math.round(detectedLanguage.confidence * 100)}%
                  </p>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetectionDetails(!showDetectionDetails)}
              >
                {showDetectionDetails ? 'Masquer les détails' : 'Afficher les détails'}
              </Button>
              
              {showDetectionDetails && detectedLanguage.detectedLanguages && detectedLanguage.detectedLanguages.length > 0 && (
                <div className="bg-white p-4 rounded-md border">
                  <p className="font-medium mb-2">Langues détectées (top 5):</p>
                  <ul className="space-y-1">
                    {detectedLanguage.detectedLanguages.slice(0, 5).map((lang: any, index: number) => (
                      <li key={index} className="flex justify-between">
                        <span>{lang.language}</span>
                        <span className="text-gray-600">{Math.round(lang.confidence * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Résultat de traduction */}
        {translatedText && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle>Traduction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-4 rounded-md border min-h-[100px] whitespace-pre-wrap">
                {translatedText}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


