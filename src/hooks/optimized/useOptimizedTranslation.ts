'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslationCache } from '@/context/AppContext';

interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  useCache?: boolean;
}

interface TranslationResult {
  translatedText: string | null;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
}

export function useOptimizedTranslation() {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const { getFromCache, addToCache } = useTranslationCache();
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateCacheKey = useCallback((text: string, sourceLanguage: string, targetLanguage: string) => {
    // Utilise un hash simple pour la clé de cache
    const content = `${text}|${sourceLanguage}|${targetLanguage}`;
    return btoa(content).replace(/[+/=]/g, '');
  }, []);

  const translate = useCallback(async (
    text: string, 
    options: TranslationOptions
  ): Promise<TranslationResult> => {
    const { sourceLanguage, targetLanguage, useCache = true } = options;
    
    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    // Vérifier le cache en premier
    if (useCache) {
      const cacheKey = generateCacheKey(text, sourceLanguage, targetLanguage);
      const cachedResult = getFromCache(cacheKey);
      
      if (cachedResult) {
        return {
          translatedText: cachedResult,
          isLoading: false,
          error: null,
          fromCache: true,
        };
      }
    }

    try {
      setIsModelLoading(true);
      setModelError(null);

      // Détecter le modèle optimal selon la longueur du texte
      const useNLLB = text.length > 50 || /[.!?]/.test(text);
      const modelType = useNLLB ? 'NLLB' : 'MT5';

      // Simuler l'appel au service de traduction optimisé
      // En production, ceci ferait appel au service réel
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          sourceLanguage,
          targetLanguage,
          modelType,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Erreur de traduction: ${response.status}`);
      }

      const result = await response.json();
      const translatedText = result.translatedText;

      // Ajouter au cache
      if (useCache && translatedText) {
        const cacheKey = generateCacheKey(text, sourceLanguage, targetLanguage);
        addToCache(cacheKey, translatedText);
      }

      return {
        translatedText,
        isLoading: false,
        error: null,
        fromCache: false,
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          translatedText: null,
          isLoading: false,
          error: null,
          fromCache: false,
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Erreur de traduction inconnue';
      setModelError(errorMessage);
      
      return {
        translatedText: null,
        isLoading: false,
        error: errorMessage,
        fromCache: false,
      };
    } finally {
      setIsModelLoading(false);
    }
  }, [generateCacheKey, getFromCache, addToCache]);

  const cancelTranslation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  useEffect(() => {
    // Cleanup à la fin du composant
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    translate,
    cancelTranslation,
    isModelLoading,
    modelError,
  };
}
