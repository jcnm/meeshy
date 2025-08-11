'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Globe, CheckCircle2 } from 'lucide-react';

// Données de test simples
const testTranslations = [
  {
    language: 'fr',
    content: 'Bonjour, comment allez-vous ?',
    status: 'completed' as const,
    confidence: 0.95,
    timestamp: new Date()
  },
  {
    language: 'es',
    content: 'Hola, ¿cómo estás?',
    status: 'completed' as const,
    confidence: 0.92,
    timestamp: new Date()
  },
  {
    language: 'de',
    content: 'Hallo, wie geht es dir?',
    status: 'completed' as const,
    confidence: 0.88,
    timestamp: new Date()
  }
];

const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

export function SimpleGlobeTest() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  
  const translationCount = testTranslations.length;
  
  const getLanguageInfo = (langCode: string) => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === langCode) || SUPPORTED_LANGUAGES[0];
  };

  const handleLanguageSwitch = (langCode: string) => {
    setCurrentLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Simple - Icône Globe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-4">
              Message de test avec {translationCount} traductions disponibles.
              Cliquez sur l'icône globe pour voir les traductions.
            </p>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Message original:</span>
              <span className="font-medium">"Hello, how are you?"</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Actions:</span>
            
            {/* Icône Globe */}
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`relative p-2 rounded-full transition-all duration-200 ${
                          translationCount > 0 
                            ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-100' 
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Globe className={`h-4 w-4 transition-transform duration-200 ${
                          translationCount > 0 ? 'animate-pulse' : ''
                        }`} />
                        {/* Badge pour indiquer le nombre de traductions */}
                        {translationCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium animate-bounce">
                            {translationCount}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {translationCount > 0 
                        ? `Voir les ${translationCount} traduction${translationCount > 1 ? 's' : ''} disponible${translationCount > 1 ? 's' : ''}`
                        : 'Aucune traduction disponible pour le moment'
                      }
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-0 shadow-xl border-0" 
                side="top" 
                align="start"
                sideOffset={8}
                style={{ zIndex: 9999 }}
              >
                <div className="p-4 bg-white rounded-lg shadow-2xl border border-gray-200">
                  <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-100">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-gray-900">Versions disponibles</span>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                      {testTranslations.length + 1}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                    {/* Version originale */}
                    <button
                      onClick={() => handleLanguageSwitch('en')}
                      className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                        currentLanguage === 'en'
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400' 
                          : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">🇬🇧</span>
                          <span className="font-medium text-gray-900">English</span>
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700">Original</Badge>
                          {currentLanguage === 'en' && (
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                        Hello, how are you?
                      </p>
                    </button>

                    {/* Traductions */}
                    {testTranslations.map((translation) => {
                      const langInfo = getLanguageInfo(translation.language);
                      const isCurrentlyDisplayed = currentLanguage === translation.language;
                      
                      return (
                        <button
                          key={translation.language}
                          onClick={() => handleLanguageSwitch(translation.language)}
                          className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                            isCurrentlyDisplayed 
                              ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400' 
                              : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{langInfo.flag}</span>
                              <span className="font-medium text-gray-900">{langInfo.name}</span>
                              {isCurrentlyDisplayed && (
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded font-medium">
                              {Math.round(translation.confidence * 100)}%
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                            {translation.content}
                          </p>
                          
                          {/* Indicateur de qualité pour les traductions */}
                          <div className="mt-2 flex items-center space-x-1">
                            <div className="flex-1 bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-green-500 h-1 rounded-full transition-all"
                                style={{ width: `${Math.round(translation.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              Qualité: {Math.round(translation.confidence * 100)}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Langue actuellement affichée :</strong> {getLanguageInfo(currentLanguage).name} ({currentLanguage})
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
