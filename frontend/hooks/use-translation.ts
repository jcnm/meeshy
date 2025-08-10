/**
 * Hook de traduction simplifié pour le service API
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { translationService, type TranslationResult } from '@/services/translation.service';
import type { Message, TranslatedMessage, User } from '@/types';

interface TranslationOptions {
  useCache?: boolean;
}

interface TranslationState {
  isTranslating: boolean;
  error: string | null;
}

export const useTranslation = () => {
  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const translateText = useCallback(async (
    text: string, 
    targetLanguage: string, 
    sourceLanguage?: string,
    options: TranslationOptions = {}
  ): Promise<TranslationResult | null> => {
    if (!text.trim()) return null;

    // Annuler la traduction précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState({ isTranslating: true, error: null });

    try {
      const result = await translationService.translateText({
        text,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage,
        model: 'basic'
      });
      
      setState({ isTranslating: false, error: null });
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Translation aborted');
        return null;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Erreur de traduction';
      setState({ isTranslating: false, error: errorMessage });
      console.error('Translation error:', error);
      return null;
    }
  }, []);

  const translateMessage = useCallback(async (
    message: Message,
    targetLanguage: string,
    currentUser?: User,
    options: TranslationOptions = {}
  ): Promise<TranslatedMessage | null> => {
    if (!message.content || !targetLanguage) return null;

    try {
      const result = await translateText(
        message.content,
        targetLanguage,
        'auto', // Détecter automatiquement la langue source
        options
      );

      if (!result) return null;

      return {
        ...message,
        translatedContent: result.translatedText,
        originalContent: message.content,
        targetLanguage,
        translationConfidence: result.confidence || 0.95,
        translatedAt: new Date(),
        translationModel: 'api-service'
      } as TranslatedMessage;
    } catch (error) {
      console.error('Message translation error:', error);
      return null;
    }
  }, [translateText]);

  const abortTranslation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ ...prev, isTranslating: false }));
    }
  }, []);

  return {
    ...state,
    translateText,
    translate: translateText, // Alias pour compatibilité
    translateMessage,
    abortTranslation
  };
};
