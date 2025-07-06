'use client';

import { useState, useCallback, useEffect } from 'react';
import { getCachedTranslation, setCachedTranslation } from '@/utils/translation';
import { translationModels } from '@/lib/translation-models';

interface UseSimpleTranslationReturn {
  translate: (text: string, sourceLang: string, targetLang: string) => Promise<string>;
  translateWithModel: (text: string, sourceLang: string, targetLang: string, model: string) => Promise<string>;
  isTranslating: boolean;
  error: string | null;
  modelsStatus: Record<string, { loaded: boolean; loading: boolean }>;
  preloadModels: () => Promise<void>;
}

export const useSimpleTranslation = (): UseSimpleTranslationReturn => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsStatus, setModelsStatus] = useState<Record<string, { loaded: boolean; loading: boolean }>>({});

  // Mettre à jour le statut des modèles
  const updateModelsStatus = useCallback(() => {
    const allModels = translationModels.getAllAvailableModels();
    const status: Record<string, { loaded: boolean; loading: boolean }> = {};
    
    allModels.forEach(modelType => {
      const modelKey = translationModels.getModelKey(modelType);
      status[modelKey] = {
        loaded: translationModels.isModelLoaded(modelKey),
        loading: false
      };
    });
    
    setModelsStatus(status);
  }, []);

  useEffect(() => {
    updateModelsStatus();
    // Mettre à jour le statut périodiquement
    const interval = setInterval(updateModelsStatus, 2000);
    return () => clearInterval(interval);
  }, [updateModelsStatus]);

  const preloadModels = useCallback(async () => {
    try {
      setError(null);
      console.log('🚀 Préchargement des modèles de traduction...');
      
      // Charger les modèles essentiels en parallèle
      const allModels = translationModels.getAllAvailableModels();
      const loadPromises = allModels.slice(0, 3).map(async (modelType) => {
        try {
          const modelKey = translationModels.getModelKey(modelType);
          await translationModels.loadModel(modelKey);
          console.log(`✅ Modèle ${modelType} préchargé`);
        } catch (error) {
          console.warn(`⚠️ Échec du préchargement du modèle ${modelType}:`, error);
        }
      });

      await Promise.allSettled(loadPromises);
      updateModelsStatus();
      console.log('🎉 Préchargement des modèles terminé');
    } catch (error) {
      console.error('❌ Erreur lors du préchargement des modèles:', error);
      setError('Erreur lors du préchargement des modèles');
    }
  }, [updateModelsStatus]);

  const translateWithModel = useCallback(async (
    text: string,
    sourceLang: string,
    targetLang: string,
    model: string
  ): Promise<string> => {
    // Vérifier si même langue
    if (sourceLang === targetLang) {
      return text;
    }

    setIsTranslating(true);
    setError(null);

    try {
      // Vérifier le cache d'abord avec une clé incluant le modèle
      const cacheKey = `${text}-${sourceLang}-${targetLang}-${model}`;
      const cached = getCachedTranslation(cacheKey, sourceLang, targetLang);
      if (cached) {
        console.log(`📦 Traduction trouvée en cache pour le modèle ${model}`);
        return cached;
      }

      console.log(`🔄 Traduction en cours avec ${model}: "${text}" (${sourceLang} → ${targetLang})`);
      
      // Utiliser la méthode translateWithModel implémentée
      const translated = await translationModels.translateWithModel(text, sourceLang, targetLang, model);
      
      // Sauvegarder en cache avec la clé spécifique au modèle
      setCachedTranslation(cacheKey, sourceLang, targetLang, translated);
      
      console.log(`✅ Traduction terminée avec ${model}: "${translated}"`);
      return translated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction inconnue';
      console.error(`❌ Erreur de traduction avec ${model}:`, errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsTranslating(false);
      updateModelsStatus();
    }
  }, [updateModelsStatus]);

  const translate = useCallback(async (
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> => {
    // Vérifier si même langue
    if (sourceLang === targetLang) {
      return text;
    }

    setIsTranslating(true);
    setError(null);

    try {
      // Vérifier le cache d'abord
      const cached = getCachedTranslation(text, sourceLang, targetLang);
      if (cached) {
        console.log('📦 Traduction trouvée en cache');
        return cached;
      }

      console.log(`🔄 Traduction en cours: "${text}" (${sourceLang} → ${targetLang})`);
      
      // Utiliser la vraie méthode translate de TranslationModels
      const translated = await translationModels.translate(text, sourceLang, targetLang);
      
      // Sauvegarder en cache
      setCachedTranslation(text, sourceLang, targetLang, translated);
      
      console.log(`✅ Traduction terminée: "${translated}"`);
      return translated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de traduction inconnue';
      console.error('❌ Erreur de traduction:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsTranslating(false);
      updateModelsStatus();
    }
  }, [updateModelsStatus]);

  return {
    translate,
    translateWithModel,
    isTranslating,
    error,
    modelsStatus,
    preloadModels
  };
};
