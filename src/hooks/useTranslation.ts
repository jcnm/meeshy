import { useState, useCallback, useMemo } from 'react';
import { TranslationService } from '@/lib/translation.service';

export const useTranslation = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState({
    mt5Loaded: false,
    nllbLoaded: false,
  });

  const translationService = useMemo(() => TranslationService.getInstance(), []);

  const translateMessage = useCallback(async (
    message: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> => {
    setIsTranslating(true);
    setError(null);

    try {
      const translatedMessage = await translationService.translateMessage(
        message,
        sourceLanguage,
        targetLanguage
      );
      return translatedMessage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsTranslating(false);
    }
  }, [translationService]);

  const clearCache = useCallback(() => {
    try {
      translationService.clearCache();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du nettoyage du cache';
      setError(errorMessage);
    }
  }, [translationService]);

  const getCacheStats = useCallback(() => {
    try {
      const stats = translationService.getCacheStats();
      setError(null);
      return stats;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la récupération des statistiques';
      setError(errorMessage);
      return { totalEntries: 0, totalSize: '0 KB' };
    }
  }, [translationService]);

  return {
    translateMessage,
    isTranslating,
    error,
    modelStatus,
    clearCache,
    getCacheStats,
  };
};
