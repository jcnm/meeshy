'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Languages, CheckCircle2, ArrowUp, Loader2, Clock, Zap, Star, Gem, Database, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, getLanguageInfo } from '@shared/types';
import type { Message, BubbleTranslation } from '@shared/types';
import { useI18n } from '@/hooks/useI18n';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LanguageSelectionMessageViewProps {
  message: Message & {
    originalLanguage: string;
    translations: BubbleTranslation[];
    originalContent: string;
  };
  currentDisplayLanguage: string;
  isOwnMessage: boolean;
  isTranslating?: boolean;
  onSelectLanguage: (language: string) => void;
  onRequestTranslation: (language: string, model?: 'basic' | 'medium' | 'premium') => void;
  onClose: () => void;
  userLanguage: string;
  usedLanguages: string[];
}

export const LanguageSelectionMessageView = memo(function LanguageSelectionMessageView({
  message,
  currentDisplayLanguage,
  isOwnMessage,
  isTranslating = false,
  onSelectLanguage,
  onRequestTranslation,
  onClose,
  userLanguage,
  usedLanguages
}: LanguageSelectionMessageViewProps) {
  const { t } = useI18n('languages');
  const [searchQuery, setSearchQuery] = useState('');

  // Utilitaires pour l'affichage des informations
  const getModelIcon = (model: string) => {
    switch (model) {
      case 'basic': return <Zap className="h-3 w-3 text-yellow-500" />;
      case 'medium': return <Star className="h-3 w-3 text-blue-500" />;
      case 'premium': return <Gem className="h-3 w-3 text-purple-500" />;
      default: return <Cpu className="h-3 w-3 text-gray-500" />;
    }
  };

  const getModelLabel = (model: string) => {
    switch (model) {
      case 'basic': return 'Basic';
      case 'medium': return 'Standard';
      case 'premium': return 'Premium';
      default: return 'Unknown';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatTimestamp = (date: Date | string) => {
    try {
      const timestamp = new Date(date);
      return formatDistanceToNow(timestamp, { addSuffix: true, locale: fr });
    } catch {
      return 'Date invalide';
    }
  };

  // Grouper les traductions par langue
  const translationsByLanguage = useMemo(() => {
    const map = new Map<string, BubbleTranslation[]>();
    message.translations.forEach(translation => {
      const existing = map.get(translation.targetLanguage) || [];
      existing.push(translation);
      map.set(translation.targetLanguage, existing);
    });
    return map;
  }, [message.translations]);

  // Construire les versions disponibles (original + traductions)
  const availableVersions = useMemo(() => {
    const versions: Array<{
      language: string;
      content: string;
      isOriginal: boolean;
      confidence?: number;
      model?: string;
    }> = [];

    // Version originale
    const originalLang = message.originalLanguage || 'fr';
    versions.push({
      language: originalLang,
      content: message.originalContent || message.content,
      isOriginal: true
    });

    // Traductions
    translationsByLanguage.forEach((translations, lang) => {
      if (lang !== originalLang) {
        // Prendre la meilleure traduction pour cette langue
        const bestTranslation = translations.reduce((best, current) => 
          (current.confidence || 0) > (best.confidence || 0) ? current : best
        );
        
        versions.push({
          language: lang,
          content: bestTranslation.content || bestTranslation.translatedContent || '',
          isOriginal: false,
          confidence: bestTranslation.confidence,
          model: bestTranslation.model
        });
      }
    });

    return versions;
  }, [message, translationsByLanguage]);

  // Langues manquantes
  const missingLanguages = useMemo(() => {
    const existingLangs = new Set(availableVersions.map(v => v.language));
    
    return SUPPORTED_LANGUAGES
      .filter(lang => !existingLangs.has(lang.code))
      .map(lang => ({
        code: lang.code,
        name: lang.name,
        flag: lang.flag
      }));
  }, [availableVersions]);

  // Filtrage par recherche
  const filteredVersions = useMemo(() => {
    if (!searchQuery.trim()) return availableVersions;
    
    return availableVersions.filter(version => {
      const langInfo = getLanguageInfo(version.language);
      const searchTerm = searchQuery.toLowerCase();
      return (
        langInfo.name.toLowerCase().includes(searchTerm) ||
        langInfo.code.toLowerCase().includes(searchTerm) ||
        version.content.toLowerCase().includes(searchTerm)
      );
    });
  }, [availableVersions, searchQuery]);

  const filteredMissingLanguages = useMemo(() => {
    if (!searchQuery.trim()) return missingLanguages;
    
    const searchTerm = searchQuery.toLowerCase();
    return missingLanguages.filter(lang => 
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  }, [missingLanguages, searchQuery]);

  const handleLanguageSelect = useCallback((language: string) => {
    onSelectLanguage(language);
    onClose();
  }, [onSelectLanguage, onClose]);

  const handleRequestTranslation = useCallback((language: string) => {
    onRequestTranslation(language, 'medium');
    onClose();
  }, [onRequestTranslation, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "relative w-96 mx-auto rounded-lg border shadow-lg overflow-hidden bg-white dark:bg-gray-800",
        "max-h-[400px] flex flex-col"
      )}
    >
      {/* Header avec recherche */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Languages className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-sm">{t('selectLanguage')}</span>
          {isTranslating && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
          
          {/* Statistiques globales */}
          <div className="flex items-center gap-2 ml-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs h-5 px-2">
                    {availableVersions.length - 1}/{availableVersions.length + missingLanguages.length - 1}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{availableVersions.length - 1} traductions sur {availableVersions.length + missingLanguages.length - 1} langues possibles</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-auto h-6 w-6 p-0 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
          <Input
            type="text"
            placeholder={t('searchLanguage')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Contenu avec tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="available" className="w-full h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b h-9 bg-white dark:bg-gray-800">
            <TabsTrigger value="available" className="text-xs">
              {t('available')} ({filteredVersions.length})
            </TabsTrigger>
            <TabsTrigger value="generate" className="text-xs">
              {t('generate')} ({filteredMissingLanguages.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="available" className="flex-1 mt-0 overflow-y-auto">
            <div className="p-2 space-y-1">
              {filteredVersions.map((version, index) => {
                const langInfo = getLanguageInfo(version.language);
                const isCurrentlyDisplayed = currentDisplayLanguage === version.language;
                
                return (
                  <div
                    key={`${version.language}-${index}`}
                    onClick={() => handleLanguageSelect(version.language)}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors text-left group",
                      isCurrentlyDisplayed
                        ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    <span className="text-lg mt-0.5">{langInfo.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{langInfo.name}</span>
                        <Badge variant="outline" className="text-xs h-4 px-1">
                          {version.language.toUpperCase()}
                        </Badge>
                        {version.isOriginal && (
                          <Badge variant="secondary" className="text-xs h-4 px-1">
                            {t('original')}
                          </Badge>
                        )}
                        {isCurrentlyDisplayed && (
                          <CheckCircle2 className="h-3 w-3 text-blue-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug mb-2">
                        {version.content}
                      </p>
                      
                      {!version.isOriginal && (
                        <TooltipProvider>
                          <div className="space-y-1">
                            {/* Première ligne : Modèle + Confiance */}
                            <div className="flex items-center gap-3">
                              {version.model && (
                                <div className="flex items-center gap-1">
                                  {getModelIcon(version.model)}
                                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                                    {getModelLabel(version.model)}
                                  </span>
                                </div>
                              )}
                              
                              {version.confidence !== undefined && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1">
                                      <div className={cn(
                                        "flex items-center text-[10px] font-medium",
                                        getConfidenceColor(version.confidence)
                                      )}>
                                        <span className="mr-1">★</span>
                                        <span>{Math.round(version.confidence * 100)}%</span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Score de confiance: {(version.confidence * 100).toFixed(1)}%</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>

                            {/* Deuxième ligne : Cache + Timestamp */}
                            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                              {/* Indicateur de cache */}
                              {translationsByLanguage.get(version.language)?.[0] && (
                                <>
                                  {(translationsByLanguage.get(version.language)?.[0] as any).cached && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 text-green-600">
                                          <Database className="h-2.5 w-2.5" />
                                          <span>Cache</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Traduction depuis le cache (plus rapide)</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  
                                  {/* Timestamp */}
                                  {(translationsByLanguage.get(version.language)?.[0] as any).createdAt && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-2.5 w-2.5" />
                                          <span>
                                            {formatTimestamp((translationsByLanguage.get(version.language)?.[0] as any).createdAt)}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Date de création de la traduction</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredVersions.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  {t('noLanguagesFound')}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="generate" className="flex-1 mt-0 overflow-y-auto">
            <div className="p-2 space-y-1">
              {filteredMissingLanguages.map((lang) => (
                <div
                  key={lang.code}
                  onClick={() => handleRequestTranslation(lang.code)}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="text-lg">{lang.flag}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{lang.name}</span>
                      <Badge variant="outline" className="text-xs h-4 px-1">
                        {lang.code.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span>{t('clickToTranslate')}</span>
                      {/* Indicateur du modèle par défaut */}
                      <div className="flex items-center gap-1">
                        <Star className="h-2.5 w-2.5 text-blue-500" />
                        <span>Standard</span>
                      </div>
                    </div>
                    {/* Estimation du temps de traduction */}
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock className="h-2 w-2" />
                      <span>~2-5 secondes</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ArrowUp className="h-3 w-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    {/* Indicateur de disponibilité du modèle */}
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Basic disponible</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Standard disponible</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Premium disponible</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredMissingLanguages.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  {t('allLanguagesTranslated')}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer avec informations sur les performances */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            {/* Traductions en cache */}
            {translationsByLanguage.size > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-green-600" />
                      <span>
                        {Array.from(translationsByLanguage.values()).flat()
                          .filter(t => (t as any).cached).length}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Traductions en cache (chargement instantané)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Modèles utilisés */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    <span>
                      {Array.from(new Set(
                        Array.from(translationsByLanguage.values())
                          .flat()
                          .map(t => (t as any).model || 'unknown')
                          .filter(m => m !== 'unknown')
                      )).length} modèles
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nombre de modèles de traduction différents utilisés</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Indicateur de qualité moyenne */}
          {translationsByLanguage.size > 0 && (
            <div className="flex items-center gap-1">
              <span>Qualité moyenne:</span>
              <div className={cn(
                "flex items-center gap-1 font-medium",
                (() => {
                  const avgConfidence = Array.from(translationsByLanguage.values())
                    .flat()
                    .filter(t => (t as any).confidence !== undefined)
                    .reduce((sum, t, _, arr) => sum + ((t as any).confidence || 0) / arr.length, 0);
                  return getConfidenceColor(avgConfidence);
                })()
              )}>
                <span>★</span>
                <span>
                  {Math.round(
                    Array.from(translationsByLanguage.values())
                      .flat()
                      .filter(t => (t as any).confidence !== undefined)
                      .reduce((sum, t, _, arr) => sum + ((t as any).confidence || 0) / arr.length, 0) * 100
                  )}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});