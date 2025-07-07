import { useState, useCallback, useRef } from 'react';

interface TranslationQueueItem {
  id: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelType: string;
  callback: (result: string) => void;
  errorCallback: (error: Error) => void;
}

/**
 * Hook pour optimiser les performances de traduction
 * - Gère une queue pour éviter les traductions simultanées
 * - Limite la charge sur le navigateur
 * - Fournit des indicateurs de progression
 */
export function useTranslationPerformance() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const queueRef = useRef<TranslationQueueItem[]>([]);
  const processingRef = useRef(false);

  /**
   * Traite la queue de traductions une par une
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    setIsTranslating(true);

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift();
      if (!item) break;

      setQueueLength(queueRef.current.length);

      try {
        // Ajouter un délai pour permettre à l'interface de respirer
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ici, vous intégreriez votre service de traduction
        // const result = await translationService.translateText(...)
        
        // Pour l'instant, on simule une traduction
        await new Promise(resolve => setTimeout(resolve, 1000));
        item.callback("Traduction simulée"); // Remplacer par le vrai résultat
        
      } catch (error) {
        console.error('Erreur de traduction dans la queue:', error);
        item.errorCallback(error instanceof Error ? error : new Error('Erreur inconnue'));
      }

      // Petit délai entre les traductions pour éviter le gel
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    processingRef.current = false;
    setIsTranslating(false);
    setQueueLength(0);
  }, []);

  /**
   * Ajoute une traduction à la queue
   */
  const queueTranslation = useCallback((item: TranslationQueueItem) => {
    queueRef.current.push(item);
    setQueueLength(queueRef.current.length);
    
    if (!processingRef.current) {
      processQueue();
    }
  }, [processQueue]);

  /**
   * Vide la queue de traductions
   */
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setQueueLength(0);
    processingRef.current = false;
    setIsTranslating(false);
  }, []);

  /**
   * Recommandations de performance
   */
  const getPerformanceRecommendation = useCallback((textLength: number, modelType: string) => {
    if (textLength > 200) {
      return {
        level: 'warning' as const,
        message: 'Texte très long - risque de gel du navigateur. Divisez en parties plus courtes.',
        shouldProceed: false
      };
    }
    
    if (textLength > 100 && modelType === 'MT5_BASE') {
      return {
        level: 'info' as const,
        message: 'Texte long avec MT5 - utilisez NLLB pour de meilleurs résultats.',
        shouldProceed: true
      };
    }

    if (queueRef.current.length > 3) {
      return {
        level: 'warning' as const,
        message: 'Plusieurs traductions en attente - attendez la fin des précédentes.',
        shouldProceed: false
      };
    }

    return {
      level: 'success' as const,
      message: 'Conditions optimales pour la traduction.',
      shouldProceed: true
    };
  }, []);

  /**
   * Vérifie si une traduction peut être lancée
   */
  const canTranslate = useCallback((textLength: number) => {
    if (textLength > 200) return false;
    if (queueRef.current.length > 5) return false;
    return true;
  }, []);

  return {
    isTranslating,
    queueLength,
    queueTranslation,
    clearQueue,
    getPerformanceRecommendation,
    canTranslate,
    
    // Statistiques utiles
    stats: {
      queueLength: queueRef.current.length,
      isProcessing: processingRef.current,
      canAcceptMore: queueRef.current.length < 5
    }
  };
}
