'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Languages, CheckCircle2, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, getLanguageInfo } from '@shared/types';
import type { Message, BubbleTranslation } from '@shared/types';

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
  t: (key: string) => string;
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
  t,
  userLanguage,
  usedLanguages
}: LanguageSelectionMessageViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

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
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug">
                        {version.content}
                      </p>
                      {!version.isOriginal && version.model && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-500">
                            {t('modelUsed')}: {version.model}
                          </span>
                          {version.confidence && (
                            <div className="flex items-center text-[10px] text-gray-500">
                              <span className="mr-1">{t('confidence')}:</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={cn(
                                    "text-[8px]",
                                    i < Math.round((version.confidence || 0) * 5) ? "text-yellow-400" : "text-gray-300"
                                  )}>★</span>
                                ))}
                              </div>
                            </div>
                          )}
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{lang.name}</span>
                      <Badge variant="outline" className="text-xs h-4 px-1">
                        {lang.code.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">{t('clickToTranslate')}</span>
                  </div>
                  <ArrowUp className="h-3 w-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
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
    </motion.div>
  );
});