'use client';

import { useState, useCallback, useEffect } from 'react';
import { getCachedTranslation, setCachedTranslation } from '@/utils/translation';
import { translationModels, MODELS_CONFIG } from '@/lib/translation-models';

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
    setModelsStatus(translationModels.getModelsStatus());
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
      
      // Charger les modèles en parallèle
      const loadPromises = Object.keys(MODELS_CONFIG).map(async (modelName) => {
        try {
          await translationModels.loadModel(modelName);
          console.log(`✅ Modèle ${modelName} préchargé`);
        } catch (error) {
          console.warn(`⚠️ Échec du préchargement du modèle ${modelName}:`, error);
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
      
      // Utiliser le service de traduction avec un modèle spécifique
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
      
      // Utiliser le service de traduction avec TensorFlow.js
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
