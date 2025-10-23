'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Languages, CheckCircle2, Loader2, Clock, Zap, Star, Gem, Database, Cpu, ChevronUp, ChevronDown } from 'lucide-react';
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
    translations: Array<BubbleTranslation | any>; // Accepte BubbleTranslation ou MessageTranslation du backend
    originalContent: string;
  };
  currentDisplayLanguage: string;
  isTranslating?: boolean;
  onSelectLanguage: (language: string) => void;
  onRequestTranslation: (language: string, model?: 'basic' | 'medium' | 'premium') => void;
  onClose: () => void;
}

export const LanguageSelectionMessageView = memo(function LanguageSelectionMessageView({
  message,
  currentDisplayLanguage,
  isTranslating = false,
  onSelectLanguage,
  onRequestTranslation,
  onClose
}: LanguageSelectionMessageViewProps) {
  const { t } = useI18n('bubbleStream');
  const [searchQuery, setSearchQuery] = useState('');

  // Utilitaires pour l'affichage des informations
  const getModelIcon = (model: string, size = "h-3 w-3") => {
    switch (model?.toLowerCase()) {
      case 'basic': return <Zap className={`${size} text-yellow-500`} />;
      case 'medium': 
      case 'standard': return <Star className={`${size} text-blue-500`} />;
      case 'premium': return <Gem className={`${size} text-purple-500`} />;
      default: return <Cpu className={`${size} text-gray-500`} />;
    }
  };

  const getModelLabel = (model: string) => {
    switch (model?.toLowerCase()) {
      case 'basic': return 'Basic';
      case 'medium':
      case 'standard': return 'Standard';
      case 'premium': return 'Premium';
      default: return 'Unknown';
    }
  };

  const getModelTier = (model: string): 'basic' | 'medium' | 'premium' | null => {
    const normalized = model?.toLowerCase();
    if (normalized === 'basic') return 'basic';
    if (normalized === 'medium' || normalized === 'standard') return 'medium';
    if (normalized === 'premium') return 'premium';
    return null;
  };

  const getNextTier = (currentTier: string): string | null => {
    const tier = getModelTier(currentTier);
    if (tier === 'basic') return 'medium';
    if (tier === 'medium') return 'premium';
    return null;
  };

  const getPreviousTier = (currentTier: string): string | null => {
    const tier = getModelTier(currentTier);
    if (tier === 'premium') return 'medium';
    if (tier === 'medium') return 'basic';
    return null;
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
    const map = new Map<string, any[]>();
    message.translations.forEach((translation: any) => {
      // Supporte BubbleTranslation (language) et MessageTranslation (targetLanguage)
      const lang = translation.language || translation.targetLanguage;
      const existing = map.get(lang) || [];
      existing.push(translation);
      map.set(lang, existing);
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
          // Supporte BubbleTranslation (content) et MessageTranslation (translatedContent)
          content: bestTranslation.content || bestTranslation.translatedContent || '',
          isOriginal: false,
          // Supporte confidence et confidenceScore
          confidence: bestTranslation.confidence || bestTranslation.confidenceScore || 0.9,
          // Supporte translationModel et model
          model: bestTranslation.translationModel || bestTranslation.model || 'basic'
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


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "relative w-full mx-auto rounded-lg border shadow-lg bg-white dark:bg-gray-800",
        "max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl",
        "h-[400px] sm:h-[450px] md:h-[500px] flex flex-col"
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
      <Tabs defaultValue="available" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b h-8 bg-white dark:bg-gray-800 flex-shrink-0">
          <TabsTrigger value="available" className="text-xs px-2 py-1 flex-1 max-w-[50%]">
            <span className="truncate">{t('available')} ({filteredVersions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="generate" className="text-xs px-2 py-1 flex-1 max-w-[50%]">
            <span className="truncate">{t('generate')} ({filteredMissingLanguages.length})</span>
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="available" className="h-full mt-0">
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
                        {!version.isOriginal && version.model && (
                          <div className="flex items-center gap-1">
                            {getModelIcon(version.model, "h-3 w-3")}
                            <Badge variant="outline" className="text-xs h-4 px-1.5">
                              {getModelLabel(version.model)}
                            </Badge>
                          </div>
                        )}
                        {version.isOriginal && (
                          <Badge variant="secondary" className="text-xs h-4 px-1">
                            {t('originalBadge')}
                          </Badge>
                        )}
                        {isCurrentlyDisplayed && (
                          <CheckCircle2 className="h-3 w-3 text-blue-600" />
                        )}
                        
                        {/* Boutons pour changer de modèle */}
                        {!version.isOriginal && version.model && (
                          <div className="flex items-center gap-0.5 ml-auto">
                            <TooltipProvider>
                              {/* Upgrade tier */}
                              {getNextTier(version.model || 'basic') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      disabled={isTranslating}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextTier = getNextTier(version.model || 'basic');
                                        if (nextTier) {
                                          onRequestTranslation(version.language, nextTier as 'basic' | 'medium' | 'premium');
                                        }
                                      }}
                                    >
                                      <ChevronUp className="h-3 w-3 text-green-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t('improveQuality', { 
                                      current: getModelLabel(version.model || 'basic'), 
                                      next: getModelLabel(getNextTier(version.model || 'basic') || '') 
                                    })}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* Downgrade tier */}
                              {getPreviousTier(version.model || 'basic') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      disabled={isTranslating}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const prevTier = getPreviousTier(version.model || 'basic');
                                        if (prevTier) {
                                          onRequestTranslation(version.language, prevTier as 'basic' | 'medium' | 'premium');
                                        }
                                      }}
                                    >
                                      <ChevronDown className="h-3 w-3 text-orange-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Réduire vers {getModelLabel(getPreviousTier(version.model || 'basic') || '')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug mb-2">
                        {version.content}
                      </p>
                      
                      {/* Barre de qualité avec pourcentage */}
                      {!version.isOriginal && version.confidence !== undefined && (
                        <div className="mt-1 flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200/40 dark:bg-gray-700/40 rounded-full h-0.5">
                            <div 
                              className="bg-green-400 dark:bg-green-500 h-0.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.round(version.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            {Math.round(version.confidence * 100)}%
                          </span>
                        </div>
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

          <TabsContent value="generate" className="h-full mt-0">
            <div className="p-2 space-y-1">
              {filteredMissingLanguages.map((lang) => (
                <div
                  key={lang.code}
                  onClick={() => {
                    onRequestTranslation(lang.code, 'basic');
                  }}
                  className="p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{lang.flag}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{lang.name}</span>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          <Badge variant="outline" className="text-xs h-4 px-1.5">
                            Basic
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Click to translate with Basic model
                      </div>
                    </div>
                    
                    {/* Actions pour chaque tier - Icônes seulement */}
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        {/* Basic tier - déjà actif par défaut */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                              disabled={isTranslating}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestTranslation(lang.code, 'basic');
                              }}
                            >
                              <Zap className="h-4 w-4 text-yellow-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('translateWith')} {t('translation.basic.title')}</p>
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* Standard tier */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              disabled={isTranslating}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestTranslation(lang.code, 'medium');
                              }}
                            >
                              <Star className="h-4 w-4 text-blue-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('translateWith')} {t('translation.standard.title')}</p>
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* Premium tier */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                              disabled={isTranslating}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestTranslation(lang.code, 'premium');
                              }}
                            >
                              <Gem className="h-4 w-4 text-purple-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('translateWith')} {t('translation.premium.title')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
        </div>
      </Tabs>

      {/* Footer avec disclaimer AI */}
      <div className="px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-start space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <Languages className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 opacity-60" />
          <p className="leading-relaxed">
            {t('translation.aiDisclaimer')}
          </p>
        </div>
      </div>
    </motion.div>
  );
});