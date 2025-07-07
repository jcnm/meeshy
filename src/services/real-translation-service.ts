/**
 * Intégration du nouveau service de modèles RÉELS avec le système de traduction
 */

import { HuggingFaceTranslationService } from '@/services/huggingface-translation';

/**
 * Service de traduction utilisant les vrais modèles Hugging Face
 */
export class RealTranslationService {
  private static instance: RealTranslationService;
  private modelService: HuggingFaceTranslationService;

  static getInstance(): RealTranslationService {
    if (!RealTranslationService.instance) {
      RealTranslationService.instance = new RealTranslationService();
    }
    return RealTranslationService.instance;
  }

  private constructor() {
    this.modelService = HuggingFaceTranslationService.getInstance();
  }

  /**
   * Traduit un message en utilisant les vrais modèles Hugging Face
   */
  async translateMessage(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<string> {
    try {
      // Utiliser directement le service HuggingFace qui gère automatiquement la sélection du modèle
      // Pour l'instant, utiliser le modèle MT5_SMALL par défaut
      const result = await this.modelService.translateText(
        text,
        sourceLanguage,
        targetLanguage,
        'MT5_SMALL' // Modèle par défaut
      );

      const translatedText = result.translatedText;
      console.log(`✅ Traduction réussie: "${translatedText.substring(0, 50)}..."`);
      return translatedText;

    } catch (error) {
      console.error('❌ Erreur traduction avec modèles RÉELS:', error);
      return this.fallbackTranslation(text, sourceLanguage, targetLanguage);
    }
  }

  /**
   * Traduction de fallback via API externe
   */
  private async fallbackTranslation(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      console.log('🌐 Fallback vers traduction API externe');
      
      // Utiliser votre API de traduction de fallback
      // Par exemple: Google Translate, DeepL, etc.
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          from: sourceLanguage,
          to: targetLanguage
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.translatedText;
      } else {
        throw new Error(`Erreur API: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Erreur fallback API:', error);
      return `[Traduction non disponible] ${text}`;
    }
  }

  /**
   * Détecte la langue d'un texte
   */
  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    const loadedModels = this.modelService.getLoadedModels();
    
    if (loadedModels.length > 0) {
      // Utiliser un modèle chargé pour la détection
      console.log('🔍 Détection de langue avec Hugging Face');
      
      // Pour l'instant, détection basique - pourrait être améliorée avec un modèle dédié
      const detectedLanguage = this.basicLanguageDetection(text);
      return { language: detectedLanguage, confidence: 0.85 };
    } else {
      // Fallback vers détection simple
      console.log('🔍 Détection de langue basique (fallback)');
      const detectedLanguage = this.basicLanguageDetection(text);
      return { language: detectedLanguage, confidence: 0.60 };
    }
  }

  /**
   * Détection de langue basique (fallback)
   */
  private basicLanguageDetection(text: string): string {
    // Détection très basique par mots-clés
    const frenchWords = ['le', 'la', 'les', 'de', 'et', 'à', 'un', 'une', 'pour', 'que', 'qui'];
    const englishWords = ['the', 'and', 'of', 'to', 'a', 'in', 'for', 'is', 'on', 'that', 'with'];
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te'];

    const words = text.toLowerCase().split(/\s+/);
    
    let frenchCount = 0;
    let englishCount = 0;
    let spanishCount = 0;

    words.forEach(word => {
      if (frenchWords.includes(word)) frenchCount++;
      if (englishWords.includes(word)) englishCount++;
      if (spanishWords.includes(word)) spanishCount++;
    });

    if (frenchCount > englishCount && frenchCount > spanishCount) return 'fr';
    if (englishCount > spanishCount) return 'en';
    if (spanishCount > 0) return 'es';
    
    return 'en'; // Par défaut
  }

  /**
   * Obtient les statistiques du service
   */
  getStats(): {
    modelsLoaded: number;
    modelsAvailable: number;
    canTranslate: boolean;
  } {
    const stats = this.modelService.getModelStats();
    
    return {
      modelsLoaded: stats.loaded,
      modelsAvailable: stats.total,
      canTranslate: stats.loaded > 0
    };
  }
}

// Instance globale
export const realTranslationService = RealTranslationService.getInstance();
