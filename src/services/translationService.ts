export interface TranslationModel {
  name: string;
  languages: string[];
  maxLength: number;
  isLoaded: boolean;
}

export interface Translation {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  timestamp: string;
  confidence?: number;
}

export interface TranslationCache {
  [key: string]: Translation;
}

export interface TranslationPreferences {
  autoTranslate: boolean;
  preferredModel: 'mt5' | 'nllb' | 'auto';
  cacheEnabled: boolean;
  showOriginal: boolean;
  languages: {
    source: string;
    target: string;
  };
}

/**
 * Service de traduction côté client avec TensorFlow.js
 * Utilise MT5 pour messages courts et NLLB pour messages longs
 */
export const translationService = {
  // Modèles disponibles
  models: {
    mt5: {
      name: 'MT5',
      languages: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
      maxLength: 50,
      isLoaded: false,
    } as TranslationModel,
    
    nllb: {
      name: 'NLLB',
      languages: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'],
      maxLength: 1000,
      isLoaded: false,
    } as TranslationModel,
  },

  // Cache local
  cache: new Map<string, Translation>(),

  /**
   * Initialise le service de traduction
   */
  async initialize(): Promise<void> {
    try {
      this.loadCacheFromStorage();
      // L'initialisation des modèles se fera en lazy loading
      console.log('Service de traduction initialisé');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service de traduction:', error);
    }
  },

  /**
   * Traduit un texte
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    preferredModel?: 'mt5' | 'nllb' | 'auto'
  ): Promise<Translation> {
    try {
      // Vérifier le cache
      const cacheKey = this.generateCacheKey(text, sourceLang, targetLang);
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        console.log('Traduction trouvée dans le cache');
        return cached;
      }

      // Sélectionner le modèle approprié
      const model = this.selectModel(text, preferredModel);
      
      // Pour l'instant, simulation de traduction (en attendant l'implémentation TensorFlow.js)
      const translatedText = await this.mockTranslate(text, sourceLang, targetLang, model);

      const translation: Translation = {
        id: this.generateTranslationId(),
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
        model,
        timestamp: new Date().toISOString(),
        confidence: 0.95, // Simulation
      };

      // Ajouter au cache
      this.cache.set(cacheKey, translation);
      this.saveCacheToStorage();

      return translation;
    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      throw new Error('Échec de la traduction');
    }
  },

  /**
   * Sélectionne le modèle approprié
   */
  selectModel(text: string, preferredModel?: 'mt5' | 'nllb' | 'auto'): 'mt5' | 'nllb' {
    if (preferredModel && preferredModel !== 'auto') {
      return preferredModel;
    }

    // Logique automatique : MT5 pour textes courts, NLLB pour textes longs
    const complexity = this.analyzeComplexity(text);
    
    if (text.length <= this.models.mt5.maxLength && complexity < 0.5) {
      return 'mt5';
    }
    
    return 'nllb';
  },

  /**
   * Analyse la complexité d'un texte
   */
  analyzeComplexity(text: string): number {
    let complexity = 0;
    
    // Longueur
    complexity += Math.min(text.length / 200, 0.3);
    
    // Nombre de phrases
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    complexity += Math.min(sentences.length / 5, 0.2);
    
    // Caractères spéciaux et ponctuation
    const specialChars = (text.match(/[^\w\s]/g) || []).length;
    complexity += Math.min(specialChars / text.length, 0.3);
    
    // Mots techniques (URLs, emails, etc.)
    const technicalWords = (text.match(/\b(?:https?:\/\/|www\.|@\w+|\w+\.\w+)\b/g) || []).length;
    complexity += Math.min(technicalWords * 0.1, 0.2);
    
    return Math.min(complexity, 1);
  },

  /**
   * Simulation de traduction (remplacer par TensorFlow.js)
   */
  async mockTranslate(text: string, sourceLang: string, targetLang: string, model: string): Promise<string> {
    // Simulation de délai de traduction
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Dictionnaire de traduction simple pour la simulation
    const mockTranslations: Record<string, Record<string, string>> = {
      'fr': {
        'en': 'Hello! This is a mock translation.',
        'es': '¡Hola! Esta es una traducción simulada.',
        'de': 'Hallo! Das ist eine Scheinübersetzung.',
      },
      'en': {
        'fr': 'Bonjour ! Ceci est une traduction simulée.',
        'es': '¡Hola! Esta es una traducción simulada.',
        'de': 'Hallo! Das ist eine Scheinübersetzung.',
      },
    };
    
    // Retourner une traduction simulée ou le texte original
    return mockTranslations[sourceLang]?.[targetLang] || 
           `[${model.toUpperCase()}] Traduction simulée: ${text}`;
  },

  /**
   * Génère une clé de cache
   */
  generateCacheKey(text: string, sourceLang: string, targetLang: string): string {
    const content = `${text}|${sourceLang}|${targetLang}`;
    return this.simpleHash(content);
  },

  /**
   * Génère un hash simple pour les clés de cache
   */
  simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  },

  /**
   * Génère un ID unique pour une traduction
   */
  generateTranslationId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Sauvegarde le cache dans localStorage
   */
  saveCacheToStorage(): void {
    try {
      const cacheData: TranslationCache = {};
      this.cache.forEach((value, key) => {
        cacheData[key] = value;
      });
      localStorage.setItem('meeshy_translation_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du cache:', error);
    }
  },

  /**
   * Charge le cache depuis localStorage
   */
  loadCacheFromStorage(): void {
    try {
      const cacheData = localStorage.getItem('meeshy_translation_cache');
      if (cacheData) {
        const parsed: TranslationCache = JSON.parse(cacheData);
        this.cache.clear();
        Object.entries(parsed).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        console.log(`Cache de traduction chargé: ${this.cache.size} entrées`);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du cache:', error);
    }
  },

  /**
   * Vide le cache de traduction
   */
  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem('meeshy_translation_cache');
    console.log('Cache de traduction vidé');
  },

  /**
   * Récupère les statistiques du cache
   */
  getCacheStats(): { size: number; totalSize: string; oldestEntry?: string } {
    const size = this.cache.size;
    let totalSizeBytes = 0;
    let oldestTimestamp: string | undefined;

    this.cache.forEach((translation) => {
      // Estimation de la taille en bytes
      const entrySize = JSON.stringify(translation).length * 2; // UTF-16
      totalSizeBytes += entrySize;
      
      if (!oldestTimestamp || translation.timestamp < oldestTimestamp) {
        oldestTimestamp = translation.timestamp;
      }
    });

    const totalSize = this.formatBytes(totalSizeBytes);

    return {
      size,
      totalSize,
      oldestEntry: oldestTimestamp,
    };
  },

  /**
   * Formate les bytes en unité lisible
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  },

  /**
   * Obtient l'historique des traductions
   */
  getTranslationHistory(limit: number = 50): Translation[] {
    const translations = Array.from(this.cache.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    return translations;
  },

  /**
   * Recherche dans l'historique des traductions
   */
  searchTranslationHistory(query: string): Translation[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.cache.values()).filter(translation =>
      translation.originalText.toLowerCase().includes(lowerQuery) ||
      translation.translatedText.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Vérifie si une langue est supportée
   */
  isLanguageSupported(lang: string, model?: 'mt5' | 'nllb'): boolean {
    if (model) {
      return this.models[model].languages.includes(lang);
    }
    
    return this.models.mt5.languages.includes(lang) || this.models.nllb.languages.includes(lang);
  },

  /**
   * Obtient la liste des langues supportées
   */
  getSupportedLanguages(model?: 'mt5' | 'nllb'): string[] {
    if (model) {
      return [...this.models[model].languages];
    }
    
    // Union des langues supportées par tous les modèles
    const allLanguages = new Set([
      ...this.models.mt5.languages,
      ...this.models.nllb.languages,
    ]);
    
    return Array.from(allLanguages).sort();
  },
};

export default translationService;
