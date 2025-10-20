'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Zap, Star, Gem, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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

type TranslationTier = 'basic' | 'medium' | 'premium';

const TRANSLATION_TIERS: Record<TranslationTier, {
  icon: typeof Zap;
  label: string;
  color: string;
  description: string;
}> = {
  basic: {
    icon: Zap,
    label: 'Basic',
    color: 'text-yellow-600',
    description: 'Rapide - MT5'
  },
  medium: {
    icon: Star,
    label: 'Standard',
    color: 'text-blue-600',
    description: 'Standard - NLLB 600M'
  },
  premium: {
    icon: Gem,
    label: 'Premium',
    color: 'text-purple-600',
    description: 'Premium - NLLB 1.3B'
  }
};

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
  const [selectedTier, setSelectedTier] = useState<TranslationTier>('medium');

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

  // Langues disponibles et manquantes
  const { availableLanguages, missingLanguages } = useMemo(() => {
    const available: Array<{
      code: string;
      info: ReturnType<typeof getLanguageInfo>;
      translations: BubbleTranslation[];
      bestTranslation: BubbleTranslation;
    }> = [];
    
    const missing: Array<{
      code: string;
      info: ReturnType<typeof getLanguageInfo>;
    }> = [];

    const originalLang = message.originalLanguage || 'fr';

    Object.entries(SUPPORTED_LANGUAGES).forEach(([code, _]) => {
      if (code === originalLang) return; // Skip original language
      
      const info = getLanguageInfo(code);
      const translations = translationsByLanguage.get(code) || [];
      
      if (translations.length > 0) {
        // Trouver la meilleure traduction (tier le plus élevé)
        const bestTranslation = translations.reduce((best, current) => {
          const tierOrder = { basic: 1, medium: 2, premium: 3 };
          const currentTier = tierOrder[current.model as TranslationTier] || 0;
          const bestTier = tierOrder[best.model as TranslationTier] || 0;
          return currentTier > bestTier ? current : best;
        });
        
        available.push({ code, info, translations, bestTranslation });
      } else {
        missing.push({ code, info });
      }
    });

    return { availableLanguages: available, missingLanguages: missing };
  }, [translationsByLanguage, message.originalLanguage]);

  // Filtrer selon la recherche
  const filteredAvailable = useMemo(() => {
    if (!searchQuery) return availableLanguages;
    return availableLanguages.filter(lang => 
      lang.info.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableLanguages, searchQuery]);

  const filteredMissing = useMemo(() => {
    if (!searchQuery) return missingLanguages;
    return missingLanguages.filter(lang => 
      lang.info.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [missingLanguages, searchQuery]);

  const handleLanguageSelect = useCallback((language: string) => {
    onSelectLanguage(language);
    onClose();
  }, [onSelectLanguage, onClose]);

  const handleRequestTranslation = useCallback((language: string) => {
    onRequestTranslation(language, selectedTier);
  }, [onRequestTranslation, selectedTier]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  const originalInfo = getLanguageInfo(message.originalLanguage || 'fr');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "relative w-full max-w-lg mx-auto rounded-lg border shadow-lg overflow-hidden",
        isOwnMessage 
          ? "bg-gradient-to-br from-blue-400/95 to-blue-500/95 border-blue-400 backdrop-blur-sm" 
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        isOwnMessage 
          ? "border-white/20 bg-white/10" 
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
      )}>
        <h3 className={cn(
          "text-sm font-semibold",
          isOwnMessage ? "text-white" : "text-gray-800 dark:text-gray-100"
        )}>
          {t('translate')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className={cn(
            "h-6 w-6 p-0 rounded-full",
            isOwnMessage 
              ? "text-white/70 hover:text-white hover:bg-white/20" 
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          )}
          aria-label={t('close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Original Message */}
      <div className="px-4 py-3">
        <div className={cn(
          "rounded-md border p-3 mb-3",
          isOwnMessage 
            ? "bg-white/10 border-white/20" 
            : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{originalInfo.flag}</span>
            <span className={cn(
              "text-xs font-medium",
              isOwnMessage ? "text-white/80" : "text-gray-600 dark:text-gray-400"
            )}>
              {t('originalLanguage')}: {originalInfo.name}
            </span>
          </div>
          <p className={cn(
            "text-sm line-clamp-3 leading-relaxed",
            isOwnMessage ? "text-white/90" : "text-gray-700 dark:text-gray-300"
          )}>
            {message.originalContent || message.content}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
            isOwnMessage ? "text-white/50" : "text-gray-400"
          )} />
          <Input
            type="text"
            placeholder={t('searchLanguage')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-10 pr-4 h-9 text-sm",
              isOwnMessage 
                ? "bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 focus:border-white/50" 
                : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
            )}
          />
        </div>

        {/* Translation Quality Selector */}
        <div className="mb-3">
          <p className={cn(
            "text-xs mb-2",
            isOwnMessage ? "text-white/70" : "text-gray-500 dark:text-gray-400"
          )}>
            {t('translationQuality')}:
          </p>
          <div className="flex gap-1">
            {Object.entries(TRANSLATION_TIERS).map(([tier, config]) => {
              const IconComponent = config.icon;
              return (
                <Button
                  key={tier}
                  variant={selectedTier === tier ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTier(tier as TranslationTier)}
                  className={cn(
                    "h-7 px-2 text-xs",
                    selectedTier === tier
                      ? isOwnMessage 
                        ? "bg-white/30 border-white/50 text-white hover:bg-white/40"
                        : "bg-blue-600 text-white"
                      : isOwnMessage
                        ? "bg-white/10 border-white/30 text-white/80 hover:bg-white/20"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400"
                  )}
                >
                  <IconComponent className="h-3 w-3 mr-1" />
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Available Translations */}
      {filteredAvailable.length > 0 && (
        <div className={cn(
          "px-4 py-2 border-t",
          isOwnMessage 
            ? "border-white/20" 
            : "border-gray-200 dark:border-gray-700"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className={cn(
              "h-4 w-4",
              isOwnMessage ? "text-white/70" : "text-green-600"
            )} />
            <span className={cn(
              "text-xs font-medium",
              isOwnMessage ? "text-white/80" : "text-gray-700 dark:text-gray-300"
            )}>
              {t('availableTranslations')}:
            </span>
          </div>
          <ScrollArea className="max-h-32">
            <div className="space-y-1">
              {filteredAvailable.map(({ code, info, bestTranslation }) => {
                const TierIcon = TRANSLATION_TIERS[bestTranslation.model as TranslationTier]?.icon || Star;
                const tierInfo = TRANSLATION_TIERS[bestTranslation.model as TranslationTier];
                
                return (
                  <motion.button
                    key={code}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleLanguageSelect(code)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-md text-left transition-colors",
                      currentDisplayLanguage === code
                        ? isOwnMessage 
                          ? "bg-white/30 border border-white/50" 
                          : "bg-blue-50 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-700"
                        : isOwnMessage
                          ? "hover:bg-white/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-base">{info.flag}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "text-sm font-medium truncate",
                            isOwnMessage ? "text-white" : "text-gray-800 dark:text-gray-200"
                          )}>
                            {info.name}
                          </span>
                          <Badge variant="outline" className={cn(
                            "text-xs h-4 px-1",
                            isOwnMessage 
                              ? "border-white/30 text-white/70" 
                              : "border-gray-300 text-gray-600"
                          )}>
                            {code.toUpperCase()}
                          </Badge>
                        </div>
                        <p className={cn(
                          "text-xs line-clamp-1",
                          isOwnMessage ? "text-white/70" : "text-gray-500 dark:text-gray-400"
                        )}>
                          "{bestTranslation.content.substring(0, 40)}..."
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <TierIcon className={cn(
                        "h-3 w-3",
                        isOwnMessage ? "text-white/60" : tierInfo?.color || "text-gray-400"
                      )} />
                      <span className={cn(
                        "text-xs",
                        isOwnMessage ? "text-white/60" : "text-gray-500"
                      )}>
                        {tierInfo?.label}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Generate New Translations */}
      {filteredMissing.length > 0 && (
        <div className={cn(
          "px-4 py-2 border-t",
          isOwnMessage 
            ? "border-white/20" 
            : "border-gray-200 dark:border-gray-700"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className={cn(
              "h-4 w-4",
              isTranslating && "animate-spin",
              isOwnMessage ? "text-white/70" : "text-blue-600"
            )} />
            <span className={cn(
              "text-xs font-medium",
              isOwnMessage ? "text-white/80" : "text-gray-700 dark:text-gray-300"
            )}>
              {t('generateTranslation')}:
            </span>
          </div>
          <ScrollArea className="max-h-24">
            <div className="flex flex-wrap gap-1">
              {filteredMissing.slice(0, 12).map(({ code, info }) => (
                <motion.button
                  key={code}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRequestTranslation(code)}
                  disabled={isTranslating}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    isOwnMessage
                      ? "bg-white/20 hover:bg-white/30 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                  )}
                  title={info.name}
                >
                  <span className="text-sm">{info.flag}</span>
                  <span className="font-medium">{code.toUpperCase()}</span>
                </motion.button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  );
});