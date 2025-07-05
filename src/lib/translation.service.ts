import * as tf from '@tensorflow/tfjs';

export class TranslationService {
  private static instance: TranslationService;
  private mt5Model: tf.LayersModel | null = null;
  private nllbModel: tf.LayersModel | null = null;
  private isLoadingMT5 = false;
  private isLoadingNLLB = false;

  private constructor() {}

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  /**
   * Détermine quel modèle utiliser basé sur la longueur et la complexité du message
   */
  private shouldUseMT5(message: string): boolean {
    const isShort = message.length <= 50;
    const isSimple = this.isSimpleMessage(message);
    return isShort && isSimple;
  }

  /**
   * Évalue la complexité syntaxique d'un message
   */
  private isSimpleMessage(message: string): boolean {
    // Critères de simplicité :
    // - Pas de phrases complexes avec plusieurs propositions
    // - Pas de ponctuation complexe
    // - Vocabulaire basique
    const complexPunctuation = /[;:(){}[\]"«»]/g;
    const multipleCommas = (message.match(/,/g) || []).length > 2;
    const hasComplexPunctuation = complexPunctuation.test(message);
    
    return !multipleCommas && !hasComplexPunctuation;
  }

  /**
   * Charge le modèle MT5 (pour messages courts et simples)
   */
  private async loadMT5Model(): Promise<void> {
    if (this.mt5Model || this.isLoadingMT5) {
      return;
    }

    this.isLoadingMT5 = true;
    try {
      // En production, on chargerait le vrai modèle MT5
      // Pour la démo, on simule le chargement
      console.log('Chargement du modèle MT5...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulation d'un modèle chargé
      this.mt5Model = {} as tf.LayersModel;
      console.log('Modèle MT5 chargé avec succès');
    } catch (error) {
      console.error('Erreur lors du chargement du modèle MT5:', error);
      throw error;
    } finally {
      this.isLoadingMT5 = false;
    }
  }

  /**
   * Charge le modèle NLLB (pour messages longs et complexes)
   */
  private async loadNLLBModel(): Promise<void> {
    if (this.nllbModel || this.isLoadingNLLB) {
      return;
    }

    this.isLoadingNLLB = true;
    try {
      // En production, on chargerait le vrai modèle NLLB
      // Pour la démo, on simule le chargement
      console.log('Chargement du modèle NLLB...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulation d'un modèle chargé
      this.nllbModel = {} as tf.LayersModel;
      console.log('Modèle NLLB chargé avec succès');
    } catch (error) {
      console.error('Erreur lors du chargement du modèle NLLB:', error);
      throw error;
    } finally {
      this.isLoadingNLLB = false;
    }
  }

  /**
   * Traduit un message en utilisant le modèle approprié
   */
  public async translateMessage(
    message: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      // Vérifier le cache d'abord
      const cachedTranslation = this.getCachedTranslation(message, sourceLanguage, targetLanguage);
      if (cachedTranslation) {
        console.log('Traduction trouvée dans le cache');
        return cachedTranslation;
      }

      // Déterminer quel modèle utiliser
      const useMT5 = this.shouldUseMT5(message);
      
      let translatedMessage: string;
      
      if (useMT5) {
        await this.loadMT5Model();
        translatedMessage = await this.translateWithMT5(message, sourceLanguage, targetLanguage);
        console.log('Traduit avec MT5');
      } else {
        await this.loadNLLBModel();
        translatedMessage = await this.translateWithNLLB(message, sourceLanguage, targetLanguage);
        console.log('Traduit avec NLLB');
      }

      // Mettre en cache la traduction
      this.cacheTranslation(message, sourceLanguage, targetLanguage, translatedMessage);

      return translatedMessage;
    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      // Fallback : retourner le message original
      return message;
    }
  }

  /**
   * Traduction avec le modèle MT5 (simulation)
   */
  private async translateWithMT5(
    message: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    // Simulation de traduction MT5
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Pour la démo, on utilise des traductions simulées
    return this.simulateTranslation(message, sourceLanguage, targetLanguage);
  }

  /**
   * Traduction avec le modèle NLLB (simulation)
   */
  private async translateWithNLLB(
    message: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    // Simulation de traduction NLLB
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Pour la démo, on utilise des traductions simulées
    return this.simulateTranslation(message, sourceLanguage, targetLanguage);
  }

  /**
   * Simulation de traduction pour la démo
   */
  private simulateTranslation(message: string, sourceLanguage: string, targetLanguage: string): string {
    // Dictionnaire de traductions simulées pour la démo
    const translations: Record<string, Record<string, string>> = {
      'Bonjour': {
        'en': 'Hello',
        'es': 'Hola',
        'de': 'Hallo',
        'ru': 'Привет',
      },
      'Comment allez-vous ?': {
        'en': 'How are you?',
        'es': '¿Cómo estás?',
        'de': 'Wie geht es Ihnen?',
        'ru': 'Как дела?',
      },
      'Hello': {
        'fr': 'Bonjour',
        'es': 'Hola',
        'de': 'Hallo',
        'ru': 'Привет',
      },
    };

    return translations[message]?.[targetLanguage] || `[${targetLanguage.toUpperCase()}] ${message}`;
  }

  /**
   * Génère une clé de cache pour une traduction
   */
  private generateCacheKey(message: string, sourceLanguage: string, targetLanguage: string): string {
    const content = `${message}_${sourceLanguage}_${targetLanguage}`;
    // Simple hash pour la clé de cache
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en 32-bit integer
    }
    return `translation_${Math.abs(hash)}`;
  }

  /**
   * Récupère une traduction du cache
   */
  private getCachedTranslation(message: string, sourceLanguage: string, targetLanguage: string): string | null {
    try {
      const cacheKey = this.generateCacheKey(message, sourceLanguage, targetLanguage);
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const translation = JSON.parse(cached);
        const now = new Date();
        const cacheDate = new Date(translation.timestamp);
        const daysDiff = (now.getTime() - cacheDate.getTime()) / (1000 * 3600 * 24);
        
        // Cache valide pour 30 jours
        if (daysDiff < 30) {
          return translation.translatedMessage;
        } else {
          // Supprimer l'entrée expirée
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du cache:', error);
    }
    
    return null;
  }

  /**
   * Met en cache une traduction
   */
  private cacheTranslation(
    message: string,
    sourceLanguage: string,
    targetLanguage: string,
    translatedMessage: string
  ): void {
    try {
      const cacheKey = this.generateCacheKey(message, sourceLanguage, targetLanguage);
      const translation = {
        key: cacheKey,
        originalMessage: message,
        sourceLanguage,
        targetLanguage,
        translatedMessage,
        timestamp: new Date().toISOString(),
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(translation));
      
      // Gérer la limite de cache (1000 entrées maximum)
      this.manageCacheSize();
    } catch (error) {
      console.error('Erreur lors de la mise en cache:', error);
    }
  }

  /**
   * Gère la taille du cache (limite à 1000 entrées)
   */
  private manageCacheSize(): void {
    try {
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('translation_'));
      
      if (cacheKeys.length > 1000) {
        // Supprimer les entrées les plus anciennes
        const entries = cacheKeys.map(key => {
          const value = localStorage.getItem(key);
          return {
            key,
            timestamp: value ? JSON.parse(value).timestamp : new Date(0).toISOString()
          };
        });
        
        entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        
        // Supprimer les 100 plus anciennes
        entries.slice(0, 100).forEach(entry => {
          localStorage.removeItem(entry.key);
        });
      }
    } catch (error) {
      console.error('Erreur lors de la gestion du cache:', error);
    }
  }

  /**
   * Nettoie le cache de traduction
   */
  public clearCache(): void {
    try {
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('translation_'));
      cacheKeys.forEach(key => localStorage.removeItem(key));
      console.log('Cache de traduction nettoyé');
    } catch (error) {
      console.error('Erreur lors du nettoyage du cache:', error);
    }
  }

  /**
   * Retourne les statistiques du cache
   */
  public getCacheStats(): { totalEntries: number; totalSize: string } {
    try {
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('translation_'));
      let totalSize = 0;
      
      cacheKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      });
      
      return {
        totalEntries: cacheKeys.length,
        totalSize: `${(totalSize / 1024).toFixed(2)} KB`
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des stats du cache:', error);
      return { totalEntries: 0, totalSize: '0 KB' };
    }
  }
}
