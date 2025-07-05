/**
 * Service de traduction avec cache persistant
 * Gère les traductions via API et cache local pour la persistance
 */

import { TranslationModelType, TRANSLATION_MODELS } from '@/types';

export interface CachedTranslation {
  messageId: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  modelUsed: TranslationModelType;
  timestamp: number;
  version: number; // Pour la gestion des mises à jour
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  messageId: string;
  forceRetranslate?: boolean; // Force une nouvelle traduction même si elle existe
}

export interface TranslationResult {
  translatedText: string;
  modelUsed: TranslationModelType;
  fromCache: boolean;
  confidence?: number;
}

export class TranslationService {
  private static instance: TranslationService;
  private dbName = 'meeshy-translations';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private memoryCache: Map<string, CachedTranslation> = new Map();

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializeDatabase();
    }
  }

  /**
   * Initialise la base de données IndexedDB pour les traductions
   */
  private async initializeDatabase(): Promise<void> {
    if (typeof window === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Erreur lors de l\'ouverture de la base de données de traductions');
        reject(request.error);
      };

      request.onsuccess = async () => {
        this.db = request.result;
        console.log('✅ Base de données de traductions initialisée');
        await this.loadMemoryCache();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('translations')) {
          const store = db.createObjectStore('translations', { keyPath: 'id' });
          store.createIndex('messageId', 'messageId', { unique: false });
          store.createIndex('sourceLanguage', 'sourceLanguage', { unique: false });
          store.createIndex('targetLanguage', 'targetLanguage', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'modelType' });
        }
      };
    });
  }

  /**
   * Charge le cache mémoire depuis IndexedDB
   */
  private async loadMemoryCache(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['translations'], 'readonly');
      const store = transaction.objectStore('translations');
      const request = store.getAll();

      request.onsuccess = () => {
        const translations = request.result as (CachedTranslation & { id: string })[];
        this.memoryCache.clear();
        
        translations.forEach(translation => {
          const key = this.getTranslationKey(
            translation.messageId, 
            translation.sourceLanguage, 
            translation.targetLanguage
          );
          this.memoryCache.set(key, translation);
        });

        console.log(`✅ ${translations.length} traductions chargées en mémoire`);
        resolve();
      };

      request.onerror = () => {
        console.error('Erreur lors du chargement du cache mémoire');
        resolve();
      };
    });
  }

  /**
   * Génère une clé unique pour une traduction
   */
  private getTranslationKey(messageId: string, sourceLanguage: string, targetLanguage: string): string {
    return `${messageId}-${sourceLanguage}-${targetLanguage}`;
  }

  /**
   * Récupère une traduction depuis le cache
   */
  async getCachedTranslation(
    messageId: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<CachedTranslation | null> {
    if (!messageId || !sourceLanguage || !targetLanguage) {
      console.warn('Paramètres manquants pour getCachedTranslation');
      return null;
    }

    try {
      const key = this.getTranslationKey(messageId, sourceLanguage, targetLanguage);
      const cached = this.memoryCache.get(key);
      
      if (cached) {
        // Vérifier que la traduction n'est pas trop ancienne (7 jours)
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours en ms
        const isExpired = Date.now() - cached.timestamp > maxAge;
        
        if (isExpired) {
          console.log(`🗑️ Traduction expirée supprimée: ${key}`);
          this.memoryCache.delete(key);
          return null;
        }
      }
      
      return cached || null;
    } catch (error) {
      console.error('Erreur récupération cache:', error);
      return null;
    }
  }

  /**
   * Sauvegarde une traduction dans le cache
   */
  async saveTranslation(translation: CachedTranslation): Promise<boolean> {
    if (!translation || !translation.messageId || !translation.translatedText) {
      console.warn('Traduction invalide pour la sauvegarde');
      return false;
    }

    try {
      if (!this.db) {
        console.log('🔄 Initialisation de la base de données...');
        await this.initializeDatabase();
      }
      
      if (!this.db) {
        console.warn('Base de données non disponible, sauvegarde en mémoire uniquement');
        // Sauvegarder quand même en mémoire
        const key = this.getTranslationKey(
          translation.messageId, 
          translation.sourceLanguage, 
          translation.targetLanguage
        );
        this.memoryCache.set(key, translation);
        return true;
      }

      const key = this.getTranslationKey(
        translation.messageId, 
        translation.sourceLanguage, 
        translation.targetLanguage
      );

      // Mise à jour du cache mémoire
      this.memoryCache.set(key, translation);

      // Sauvegarde en base avec timeout
      return new Promise((resolve) => {
        try {
          const transaction = this.db!.transaction(['translations'], 'readwrite');
          const store = transaction.objectStore('translations');
          const translationWithId = { ...translation, id: key };
          const request = store.put(translationWithId);

          // Timeout pour éviter les blocages
          const timeoutId = setTimeout(() => {
            console.warn('Timeout sauvegarde IndexedDB');
            resolve(false);
          }, 5000);

          request.onsuccess = () => {
            clearTimeout(timeoutId);
            this.updateStats(translation.modelUsed).catch(error => {
              console.warn('Erreur mise à jour stats:', error);
            });
            resolve(true);
          };

          request.onerror = () => {
            clearTimeout(timeoutId);
            console.error('Erreur lors de la sauvegarde de la traduction:', request.error);
            resolve(false);
          };

          transaction.onerror = () => {
            clearTimeout(timeoutId);
            console.error('Erreur transaction IndexedDB:', transaction.error);
            resolve(false);
          };
        } catch (error) {
          console.error('Erreur création transaction:', error);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Erreur sauvegarde traduction:', error);
      return false;
    }
  }

  /**
   * Met à jour les statistiques d'utilisation des modèles
   */
  private async updateStats(modelUsed: TranslationModelType): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['stats'], 'readwrite');
      const store = transaction.objectStore('stats');
      const request = store.get(modelUsed);

      request.onsuccess = () => {
        const existing = request.result || { 
          modelType: modelUsed, 
          count: 0, 
          totalCost: { ...TRANSLATION_MODELS[modelUsed].cost }
        };
        
        existing.count++;
        const modelCost = TRANSLATION_MODELS[modelUsed].cost;
        existing.totalCost.energyConsumption += modelCost.energyConsumption;
        existing.totalCost.computationalCost += modelCost.computationalCost;
        existing.totalCost.co2Equivalent += modelCost.co2Equivalent;
        existing.totalCost.monetaryEquivalent += modelCost.monetaryEquivalent;
        existing.totalCost.memoryUsage += modelCost.memoryUsage;
        existing.totalCost.inferenceTime += modelCost.inferenceTime;

        const putRequest = store.put(existing);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => resolve();
      };

      request.onerror = () => resolve();
    });
  }

  /**
   * Effectue une traduction (depuis cache ou API)
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Validation des paramètres
    if (!request.text || !request.sourceLanguage || !request.targetLanguage || !request.messageId) {
      throw new Error('Paramètres de traduction manquants');
    }

    if (request.text.trim().length === 0) {
      throw new Error('Texte à traduire vide');
    }

    if (request.sourceLanguage === request.targetLanguage) {
      // Pas besoin de traduire si c'est la même langue
      return {
        translatedText: request.text,
        modelUsed: 'MT5_SMALL',
        fromCache: false
      };
    }

    try {
      // Vérifier le cache d'abord (sauf si force retranslate)
      if (!request.forceRetranslate) {
        const cached = await this.getCachedTranslation(
          request.messageId, 
          request.sourceLanguage, 
          request.targetLanguage
        );

        if (cached) {
          console.log(`✅ Traduction trouvée en cache: ${request.targetLanguage}`);
          return {
            translatedText: cached.translatedText,
            modelUsed: cached.modelUsed,
            fromCache: true,
          };
        }
      }

      // Sélectionner le modèle optimal
      const modelUsed = this.selectOptimalModel(request.text);

      // Effectuer la traduction via API
      const translatedText = await this.performTranslation(
        request.text, 
        request.sourceLanguage, 
        request.targetLanguage, 
        modelUsed
      );

      // Sauvegarder en cache
      const translation: CachedTranslation = {
        messageId: request.messageId,
        originalText: request.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translatedText,
        modelUsed,
        timestamp: Date.now(),
        version: 1,
      };

      // Sauvegarder de manière asynchrone pour ne pas bloquer
      this.saveTranslation(translation).catch(error => {
        console.warn('Erreur sauvegarde traduction:', error);
        // Ne pas faire échouer la traduction pour une erreur de sauvegarde
      });

      console.log(`✅ Traduction effectuée: ${request.sourceLanguage} → ${request.targetLanguage} (${modelUsed})`);

      return {
        translatedText,
        modelUsed,
        fromCache: false,
      };

    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      
      // Enrichir l'erreur avec des informations de contexte
      const enhancedError = new Error(
        `Erreur traduction ${request.sourceLanguage}→${request.targetLanguage}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      );
      
      throw enhancedError;
    }
  }

  /**
   * Sélectionne le modèle optimal pour un texte donné
   */
  private selectOptimalModel(text: string): TranslationModelType {
    const messageLength = text.length;
    
    // Analyse de la complexité du texte
    const hasComplexPunctuation = /[.!?;:,]{2,}|[""''«»]/g.test(text);
    const hasNumbers = /\d+/g.test(text);
    const hasSpecialChars = /[#@$%^&*()_+=\[\]{}|\\:";'<>?,./]/.test(text);
    const hasMultipleSentences = (text.match(/[.!?]+/g) || []).length > 1;
    const hasUpperCase = /[A-Z]{2,}/.test(text);
    
    let complexityScore = 0;
    if (hasComplexPunctuation) complexityScore += 1;
    if (hasNumbers) complexityScore += 1;
    if (hasSpecialChars) complexityScore += 1;
    if (hasMultipleSentences) complexityScore += 2;
    if (hasUpperCase) complexityScore += 1;
    
    // Sélection du modèle selon la longueur et complexité
    if (messageLength <= 15 && complexityScore === 0) {
      return 'MT5_SMALL';
    } else if (messageLength <= 30 && complexityScore <= 1) {
      return 'MT5_BASE';
    } else if (messageLength <= 60 && complexityScore <= 2) {
      return 'MT5_LARGE';
    } else if (messageLength <= 80 && complexityScore <= 3) {
      return 'MT5_XL';
    } else if (messageLength <= 100 && complexityScore <= 4) {
      return 'NLLB_200M';
    } else if (messageLength <= 200 && complexityScore <= 5) {
      return 'NLLB_DISTILLED_600M';
    } else if (messageLength <= 400 && complexityScore <= 6) {
      return 'NLLB_DISTILLED_1_3B';
    } else if (messageLength <= 600 && complexityScore <= 7) {
      return 'NLLB_1_3B';
    } else if (messageLength <= 1000 && complexityScore <= 8) {
      return 'NLLB_3_3B';
    } else {
      return 'NLLB_54B';
    }
  }

  /**
   * Effectue la traduction via API externe (MyMemory pour le développement)
   */
  private async performTranslation(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    modelUsed: TranslationModelType
  ): Promise<string> {
    if (!text || text.trim().length === 0) {
      throw new Error('Texte vide pour la traduction');
    }

    try {
      // Timeout pour éviter les blocages
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

      // Utiliser MyMemory API pour le développement
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`,
        { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Meeshy Translation App'
          }
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erreur API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || data.responseStatus !== 200) {
        throw new Error(`Réponse API invalide: ${data?.responseStatus || 'inconnue'}`);
      }

      if (!data.responseData || !data.responseData.translatedText) {
        throw new Error('Données de traduction manquantes dans la réponse API');
      }

      const translatedText = data.responseData.translatedText;
      
      // Validation basique du résultat
      if (!translatedText || translatedText.trim().length === 0) {
        throw new Error('Traduction vide reçue de l\'API');
      }

      // Ajouter un préfixe de développement si nécessaire
      console.log(`📡 Traduction API: ${sourceLanguage}→${targetLanguage}, modèle: ${modelUsed}`);
      
      return translatedText;

    } catch (error) {
      // Fallback : traduction simulée en cas d'erreur API
      console.warn('Fallback vers traduction simulée:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Timeout de l\'API de traduction');
      }
      
      return this.getSimulatedTranslation(text, sourceLanguage, targetLanguage);
    }
  }

  /**
   * Traduction simulée pour le développement
   */
  private getSimulatedTranslation(text: string, sourceLanguage: string, targetLanguage: string): string {
    const simpleTranslations: Record<string, Record<string, Record<string, string>>> = {
      'en': {
        'fr': { 'Hello': 'Bonjour', 'How are you?': 'Comment allez-vous ?', 'Good morning': 'Bonjour' },
        'es': { 'Hello': 'Hola', 'How are you?': '¿Cómo estás?', 'Good morning': 'Buenos días' },
      },
      'fr': {
        'en': { 'Bonjour': 'Hello', 'Comment allez-vous ?': 'How are you?', 'Merci': 'Thank you' },
        'es': { 'Bonjour': 'Hola', 'Comment allez-vous ?': '¿Cómo estás?', 'Merci': 'Gracias' },
      },
      'es': {
        'en': { 'Hola': 'Hello', '¿Cómo estás?': 'How are you?', 'Gracias': 'Thank you' },
        'fr': { 'Hola': 'Bonjour', '¿Cómo estás?': 'Comment allez-vous ?', 'Gracias': 'Merci' },
      },
    };

    const translations = simpleTranslations[sourceLanguage]?.[targetLanguage];
    if (translations && translations[text]) {
      return translations[text];
    }

    // Fallback générique
    return `[${targetLanguage.toUpperCase()}] ${text}`;
  }

  /**
   * Récupère toutes les traductions pour un message
   */
  async getMessageTranslations(messageId: string): Promise<CachedTranslation[]> {
    const translations: CachedTranslation[] = [];
    
    for (const translation of this.memoryCache.values()) {
      if (translation.messageId === messageId) {
        translations.push(translation);
      }
    }

    return translations.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Supprime toutes les traductions d'un message
   */
  async deleteMessageTranslations(messageId: string): Promise<void> {
    if (!this.db) return;

    const translations = await this.getMessageTranslations(messageId);
    
    for (const translation of translations) {
      const key = this.getTranslationKey(
        translation.messageId, 
        translation.sourceLanguage, 
        translation.targetLanguage
      );
      
      this.memoryCache.delete(key);
      
      // Supprimer de la base
      const transaction = this.db.transaction(['translations'], 'readwrite');
      const store = transaction.objectStore('translations');
      store.delete(key);
    }
  }

  /**
   * Exporte les statistiques de traduction
   */
  async getStats(): Promise<Record<string, unknown>> {
    if (!this.db) return {};

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['stats'], 'readonly');
      const store = transaction.objectStore('stats');
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const statsMap: Record<string, unknown> = {};
        results.forEach((stat: unknown, index: number) => {
          statsMap[`model_${index}`] = stat;
        });
        resolve(statsMap);
      };

      request.onerror = () => {
        resolve({});
      };
    });
  }
}

export const translationService = TranslationService.getInstance();
