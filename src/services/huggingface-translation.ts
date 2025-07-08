/**
 * Service de traduction utilisant @huggingface/transformers
 * Gestion RÉELLE des modèles MT5 et NLLB avec téléchargement et cache automatique
 */

import { pipeline } from '@huggingface/transformers';
import { 
  getAllActiveModels,
  selectModelForMessage,
  getActiveModelConfig,
  type AllowedModelType 
} from '@/lib/unified-model-config';
import { 
  type UnifiedModelConfig,
  UNIFIED_TRANSLATION_MODELS,
  type TranslationModelType 
} from '@/lib/unified-model-config';

export interface TranslationProgress {
  modelName: string;
  status: 'downloading' | 'loading' | 'ready' | 'error';
  progress?: number; // 0-100
  error?: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelUsed: string;
  confidence?: number;
}

// Type pour le pipeline de traduction (simplifié)
type TranslationPipeline = any;

/**
 * Service de traduction utilisant Hugging Face Transformers
 */
export class HuggingFaceTranslationService {
  private static instance: HuggingFaceTranslationService;
  private loadedPipelines = new Map<string, TranslationPipeline>();
  private loadingPromises = new Map<string, Promise<TranslationPipeline>>();
  private progressCallbacks = new Map<string, (progress: TranslationProgress) => void>();
  
  // Clés pour la persistance localStorage
  private readonly STORAGE_KEY_LOADED_MODELS = 'meeshy_loaded_models';
  private readonly STORAGE_KEY_MODEL_CACHE = 'meeshy_model_cache_metadata';

  static getInstance(): HuggingFaceTranslationService {
    if (!HuggingFaceTranslationService.instance) {
      HuggingFaceTranslationService.instance = new HuggingFaceTranslationService();
    }
    return HuggingFaceTranslationService.instance;
  }

  private constructor() {
    console.log('🤗 Service de traduction Hugging Face initialisé');
    this.loadPersistedState();
    
    // Recharger automatiquement les modèles persistés en arrière-plan
    this.autoReloadPersistedModels();
  }

  /**
   * Charge l'état persisté depuis localStorage
   */
  private loadPersistedState(): void {
    try {
      const savedModels = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS);
      if (savedModels) {
        const modelIds: string[] = JSON.parse(savedModels);
        console.log(`📂 Modèles persistés trouvés: ${modelIds.join(', ')}`);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors du chargement de l\'état persisté:', error);
    }
  }

  /**
   * Recharge automatiquement les modèles persistés en arrière-plan
   */
  private async autoReloadPersistedModels(): Promise<void> {
    const persistedModels = this.getPersistedLoadedModels();
    
    if (persistedModels.length > 0) {
      console.log(`🔄 Rechargement automatique de ${persistedModels.length} modèles persistés...`);
      
      // Recharger les modèles un par un pour éviter de surcharger la mémoire
      for (const modelType of persistedModels) {
        try {
          // Rechargement silencieux (sans callback de progression)
          await this.loadModel(modelType);
          console.log(`✅ Modèle ${modelType} rechargé automatiquement`);
        } catch (error) {
          console.warn(`⚠️ Échec du rechargement automatique de ${modelType}:`, error);
          // Retirer le modèle défaillant de la persistance
          this.removeFromPersistence(modelType);
        }
      }
    }
  }

  /**
   * Retire un modèle de la persistance s'il ne peut pas être rechargé
   */
  private removeFromPersistence(modelType: TranslationModelType): void {
    try {
      const config = UNIFIED_TRANSLATION_MODELS[modelType];
      if (!config) return;

      const savedModels = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS);
      if (savedModels) {
        const modelIds: string[] = JSON.parse(savedModels);
        const filteredIds = modelIds.filter(id => id !== config.huggingFaceId);
        localStorage.setItem(this.STORAGE_KEY_LOADED_MODELS, JSON.stringify(filteredIds));
        console.log(`🗑️ Modèle ${modelType} retiré de la persistance`);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la suppression de persistance:', error);
    }
  }

  /**
   * Obtient les modèles marqués comme chargés (incluant ceux persistés)
   */
  getPersistedLoadedModels(): TranslationModelType[] {
    try {
      const savedModels = localStorage.getItem(this.STORAGE_KEY_LOADED_MODELS);
      if (savedModels) {
        const modelIds: string[] = JSON.parse(savedModels);
        return Object.values(UNIFIED_TRANSLATION_MODELS)
          .filter(config => modelIds.includes(config.huggingFaceId))
          .map(config => config.name);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la lecture des modèles persistés:', error);
    }
    return [];
  }

  /**
   * Sauvegarde l'état dans localStorage
   */
  private persistState(): void {
    try {
      const loadedModelIds = Array.from(this.loadedPipelines.keys());
      localStorage.setItem(this.STORAGE_KEY_LOADED_MODELS, JSON.stringify(loadedModelIds));
      
      // Sauvegarder aussi les métadonnées pour affichage
      const modelMetadata = loadedModelIds.map(modelId => {
        const config = Object.values(UNIFIED_TRANSLATION_MODELS).find(c => c.huggingFaceId === modelId);
        return {
          modelId,
          modelType: config?.name,
          displayName: config?.displayName,
          family: config?.family,
          loadedAt: new Date().toISOString()
        };
      });
      
      localStorage.setItem(this.STORAGE_KEY_MODEL_CACHE, JSON.stringify(modelMetadata));
      console.log(`💾 État persisté: ${loadedModelIds.length} modèles`);
    } catch (error) {
      console.warn('⚠️ Erreur lors de la sauvegarde de l\'état:', error);
    }
  }

  /**
   * Charge un modèle de traduction
   */
  async loadModel(
    modelType: TranslationModelType,
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationPipeline> {
    const config = UNIFIED_TRANSLATION_MODELS[modelType];
    if (!config) {
      throw new Error(`Modèle ${modelType} non trouvé dans la configuration`);
    }

    const modelId = config.huggingFaceId;
    
    // Vérifier si déjà chargé
    if (this.loadedPipelines.has(modelId)) {
      console.log(`✅ Modèle ${modelType} déjà chargé`);
      return this.loadedPipelines.get(modelId)!;
    }

    // Vérifier si en cours de chargement
    if (this.loadingPromises.has(modelId)) {
      return this.loadingPromises.get(modelId)!;
    }

    // Enregistrer le callback de progression
    if (onProgress) {
      this.progressCallbacks.set(modelId, onProgress);
    }

    // Démarrer le chargement
    const loadingPromise = this.performModelLoading(config);
    this.loadingPromises.set(modelId, loadingPromise);

    try {
      const translationPipeline = await loadingPromise;
      this.loadedPipelines.set(modelId, translationPipeline);
      this.loadingPromises.delete(modelId);
      
      // Persister l'état après chargement réussi
      this.persistState();
      
      this.notifyProgress(modelId, {
        modelName: modelType,
        status: 'ready',
        progress: 100
      });

      return translationPipeline;
    } catch (error) {
      this.loadingPromises.delete(modelId);
      this.notifyProgress(modelId, {
        modelName: modelType,
        status: 'error',
        error: error instanceof Error ? error.message : 'Erreur de chargement'
      });
      throw error;
    }
  }

  /**
   * Effectue le chargement réel du modèle
   */
  private async performModelLoading(config: UnifiedModelConfig): Promise<TranslationPipeline> {
    console.log(`🔄 Chargement du modèle: ${config.huggingFaceId}`);
    
    this.notifyProgress(config.huggingFaceId, {
      modelName: config.name,
      status: 'downloading',
      progress: 0
    });

    try {
      // Charger le pipeline approprié selon le type de modèle
      // MT5 utilise text2text-generation, NLLB peut utiliser translation
      const taskType = config.family === 'MT5' ? 'text2text-generation' : 'translation';
      
      // @huggingface/transformers gère automatiquement le téléchargement et le cache
      const translationPipeline = await pipeline(taskType, config.huggingFaceId);

      console.log(`✅ Modèle ${config.huggingFaceId} chargé avec succès`);
      return translationPipeline;

    } catch (error) {
      console.error(`❌ Erreur chargement ${config.huggingFaceId}:`, error);
      throw error;
    }
  }

  /**
   * Traduit un texte avec un modèle spécifique
   */
  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    modelType: TranslationModelType,
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationResult> {
    if (!text.trim()) {
      throw new Error('Le texte à traduire ne peut pas être vide');
    }

    // Limiter la taille du texte pour éviter les erreurs de mémoire et le gel
    if (text.length > 200) {
      throw new Error('Texte trop long (maximum 200 caractères). Réduisez la taille pour éviter le gel de l\'interface.');
    }

    const config = UNIFIED_TRANSLATION_MODELS[modelType];
    if (!config) {
      throw new Error(`Modèle ${modelType} non supporté`);
    }

    console.log(`🔄 Traduction: "${text}" (${sourceLanguage} → ${targetLanguage}) avec ${modelType}`);

    try {
      // Charger le modèle si nécessaire
      const translationPipeline = await this.loadModel(modelType, onProgress);

      // Utiliser setTimeout pour éviter de bloquer l'interface utilisateur
      const result = await this.executeTranslationWithTimeout(
        translationPipeline,
        text,
        sourceLanguage,
        targetLanguage,
        config
      );

      // Extraire le texte traduit
      let translatedText: string;
      
      if (Array.isArray(result) && result.length > 0) {
        const firstResult = result[0];
        if (typeof firstResult === 'object' && firstResult !== null) {
          // Essayer différentes propriétés possibles
          translatedText = (firstResult as any).translation_text || 
                          (firstResult as any).generated_text || 
                          (firstResult as any).text ||
                          String(firstResult);
        } else {
          translatedText = String(firstResult);
        }
      } else if (typeof result === 'object' && result !== null) {
        translatedText = (result as any).translation_text || 
                        (result as any).generated_text || 
                        (result as any).text ||
                        String(result);
      } else {
        translatedText = String(result);
      }

      // Nettoyer le texte traduit de manière plus robuste
      translatedText = this.cleanTranslationText(translatedText.trim());

      // Validation du résultat - détecter les résultats corrompus
      if (!translatedText || translatedText === text || this.isCorruptedResult(translatedText)) {
        console.warn(`⚠️ Traduction corrompue ou vide détectée: "${translatedText}"`);
        
        // Essayer une stratégie de fallback plus simple
        if (config.family === 'MT5') {
          throw new Error('Traduction MT5 corrompue. Essayez un texte plus simple ou utilisez le modèle NLLB.');
        } else {
          translatedText = text; // Garder le texte original en dernier recours
        }
      }

      console.log(`✅ Traduction réussie: "${translatedText}"`);

      return {
        translatedText,
        sourceLanguage,
        targetLanguage,
        modelUsed: config.displayName,
        confidence: 0.95 // Valeur par défaut, pourrait être extraite du résultat
      };

    } catch (error) {
      console.error(`❌ Erreur traduction avec ${modelType}:`, error);
      
      // Gestion spécifique des erreurs de mémoire et de tokenisation
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('522819016')) {
        throw new Error('Erreur de tokenisation: Le texte contient des caractères incompatibles avec ce modèle. Essayez de simplifier le texte ou d\'utiliser un autre modèle.');
      }
      
      if (errorMsg.includes('out of memory') || errorMsg.includes('OOM')) {
        throw new Error('Mémoire insuffisante: Essayez un texte plus court ou déchargez d\'autres modèles.');
      }
      
      throw new Error(`Échec de traduction: ${errorMsg}`);
    }
  }

  /**
   * Exécute la traduction avec un timeout pour éviter le gel
   */
  private async executeTranslationWithTimeout(
    translationPipeline: any,
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    config: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Timeout de 30 secondes pour éviter le gel infini
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: La traduction prend trop de temps. Essayez un texte plus court.'));
      }, 30000);

      // Exécuter la traduction de manière asynchrone
      const executeTranslation = async () => {
        try {
          let result: any;
          
          if (config.family === 'MT5') {
            // Pour MT5 : utiliser le format text2text-generation avec des paramètres optimisés
            const prompt = `translate ${sourceLanguage} to ${targetLanguage}: ${text}`;
            console.log(`🔄 MT5 prompt: "${prompt}"`);
            
            result = await translationPipeline(prompt, {
              max_length: Math.min(100, text.length + 20), // Plus conservateur pour éviter le gel
              do_sample: false,
              temperature: 0.1, // Plus déterministe
              num_return_sequences: 1,
              early_stopping: true,
              num_beams: 1 // Simplifier pour plus de rapidité
            });
            
          } else if (config.family === 'NLLB') {
            // Pour NLLB : utiliser les codes de langue spécifiques
            const srcLangCode = this.convertToNLLBCode(sourceLanguage);
            const tgtLangCode = this.convertToNLLBCode(targetLanguage);
            
            console.log(`🔄 NLLB codes: ${srcLangCode} → ${tgtLangCode}`);
            
            result = await translationPipeline(text, {
              src_lang: srcLangCode,
              tgt_lang: tgtLangCode,
              max_length: Math.min(100, text.length + 20), // Plus conservateur
              num_beams: 1, // Simplifier pour plus de rapidité
              early_stopping: true
            });
            
          } else {
            throw new Error(`Famille de modèle non supportée: ${config.family}`);
          }

          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      // Utiliser setTimeout pour permettre à l'interface de respirer
      setTimeout(executeTranslation, 10);
    });
  }

  /**
   * Détecte si un résultat de traduction est corrompu
   */
  private isCorruptedResult(text: string): boolean {
    if (!text || text.length === 0) return true;
    
    // Détecter les patterns de corruption courants
    const corruptionPatterns = [
      /^[:.\s\-n]+$/, // Seulement des caractères de ponctuation et 'n'
      /^[:\s]+$/, // Seulement des deux-points et espaces
      /^[-\s]+$/, // Seulement des tirets et espaces
      /^\s*n\s*n\s*n/, // Répétition de 'n'
      /^[^a-zA-Z]*$/ // Aucune lettre
    ];
    
    return corruptionPatterns.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Convertit un code de langue ISO en code NLLB
   */
  private convertToNLLBCode(languageCode: string): string {
    const nllbCodes: Record<string, string> = {
      'en': 'eng_Latn',
      'fr': 'fra_Latn',
      'es': 'spa_Latn',
      'de': 'deu_Latn',
      'it': 'ita_Latn',
      'pt': 'por_Latn',
      'ru': 'rus_Cyrl',
      'ja': 'jpn_Jpan',
      'ko': 'kor_Hang',
      'zh': 'zho_Hans',
      'ar': 'arb_Arab',
      'hi': 'hin_Deva',
      'tr': 'tur_Latn',
      'pl': 'pol_Latn',
      'nl': 'nld_Latn',
      'sv': 'swe_Latn',
      'da': 'dan_Latn',
      'no': 'nor_Latn',
      'fi': 'fin_Latn',
      'cs': 'ces_Latn'
    };

    return nllbCodes[languageCode] || languageCode;
  }

  /**
   * Notifie la progression
   */
  private notifyProgress(modelId: string, progress: TranslationProgress): void {
    const callback = this.progressCallbacks.get(modelId);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * Vérifie si un modèle est chargé
   */
  isModelLoaded(modelType: TranslationModelType): boolean {
    const config = UNIFIED_TRANSLATION_MODELS[modelType];
    return config ? this.loadedPipelines.has(config.huggingFaceId) : false;
  }

  /**
   * Obtient la liste des modèles chargés
   */
  getLoadedModels(): TranslationModelType[] {
    const loadedIds = Array.from(this.loadedPipelines.keys());
    return Object.values(UNIFIED_TRANSLATION_MODELS)
      .filter(config => loadedIds.includes(config.huggingFaceId))
      .map(config => config.name);
  }

  /**
   * Décharge un modèle de la mémoire
   */
  async unloadModel(modelType: TranslationModelType): Promise<boolean> {
    const config = UNIFIED_TRANSLATION_MODELS[modelType];
    if (!config) return false;

    const modelId = config.huggingFaceId;
    if (this.loadedPipelines.has(modelId)) {
      // Note: @huggingface/transformers ne fournit pas de méthode dispose explicite
      // mais la suppression de la référence permettra au garbage collector de faire son travail
      this.loadedPipelines.delete(modelId);
      this.progressCallbacks.delete(modelId);
      
      // Persister l'état après déchargement
      this.persistState();
      
      console.log(`🗑️ Modèle ${modelType} déchargé`);
      return true;
    }
    return false;
  }

  /**
   * Décharge tous les modèles
   */
  async unloadAllModels(): Promise<void> {
    for (const modelType of this.getLoadedModels()) {
      await this.unloadModel(modelType);
    }
    console.log(`🧹 Tous les modèles déchargés`);
  }

  /**
   * Obtient des statistiques sur les modèles
   */
  getModelStats(): { 
    loaded: number; 
    total: number; 
    loadedModels: TranslationModelType[];
    availableModels: TranslationModelType[];
  } {
    const availableModels = Object.keys(UNIFIED_TRANSLATION_MODELS) as TranslationModelType[];
    const loadedModels = this.getLoadedModels();

    return {
      loaded: loadedModels.length,
      total: availableModels.length,
      loadedModels,
      availableModels
    };
  }

  /**
   * Précharge les modèles recommandés pour le système
   */
  async preloadRecommendedModels(onProgress?: (progress: TranslationProgress) => void): Promise<void> {
    try {
      const activeModels = getAllActiveModels();
      const basicModel = activeModels.find(m => m.type === 'basic')?.config.name;
      const highModel = activeModels.find(m => m.type === 'high')?.config.name;
      
      if (!basicModel || !highModel) {
        throw new Error('Modèles actifs non configurés');
      }
      
      console.log(`🚀 Préchargement des modèles actifs: ${basicModel}, ${highModel}`);
      
      // Précharger le modèle de base d'abord (plus léger)
      await this.loadModel(basicModel, onProgress);
      console.log(`✅ Modèle de base préchargé: ${basicModel}`);
      
      // Puis le modèle avancé
      await this.loadModel(highModel, onProgress);
      console.log(`✅ Modèle avancé préchargé: ${highModel}`);
    } catch (error) {
      console.error('❌ Erreur lors du préchargement du modèle:', error);
      throw error;
    }
  }

  /**
   * Charge automatiquement le meilleur modèle disponible pour une tâche de traduction
   */
  /**
   * Charge automatiquement le meilleur modèle disponible pour une tâche de traduction
   */
  async loadBestAvailableModel(
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<{ modelType: TranslationModelType; pipeline: TranslationPipeline }> {
    // D'abord, vérifier s'il y a des modèles déjà chargés
    const loadedModels = this.getLoadedModels();
    if (loadedModels.length > 0) {
      // Prendre le premier modèle chargé
      const bestLoaded = loadedModels[0];
      const config = UNIFIED_TRANSLATION_MODELS[bestLoaded];
      const pipeline = this.loadedPipelines.get(config.huggingFaceId);
      
      if (pipeline) {
        console.log(`✅ Utilisation du modèle déjà chargé: ${bestLoaded}`);
        return { modelType: bestLoaded, pipeline };
      }
    }

    // Sinon, vérifier les modèles persistés
    const persistedModels = this.getPersistedLoadedModels();
    if (persistedModels.length > 0) {
      const bestPersisted = persistedModels[0];
      try {
        const pipeline = await this.loadModel(bestPersisted, onProgress);
        console.log(`✅ Modèle rechargé depuis la persistance: ${bestPersisted}`);
        return { modelType: bestPersisted, pipeline };
      } catch {
        console.warn(`⚠️ Échec du rechargement de ${bestPersisted}, essai du modèle recommandé`);
      }
    }

    // En dernier recours, charger un modèle recommandé selon la configuration
    try {
      const activeModels = getAllActiveModels();
      const basicModel = activeModels.find(m => m.type === 'basic')?.config.name;
      
      if (!basicModel) {
        throw new Error('Aucun modèle actif configuré');
      }
      
      const pipeline = await this.loadModel(basicModel, onProgress);
      
      console.log(`✅ Modèle de base chargé: ${basicModel}`);
      return { modelType: basicModel, pipeline };
    } catch (error) {
      console.error('❌ Impossible de charger un modèle:', error);
      throw new Error('Aucun modèle de traduction disponible');
    }
  }

  /**
   * Vérifie si un modèle est marqué comme chargé (en mémoire OU persisté)
   */
  isModelLoadedOrPersisted(modelType: TranslationModelType): boolean {
    const config = UNIFIED_TRANSLATION_MODELS[modelType];
    if (!config) return false;
    
    // Vérifier d'abord la mémoire
    if (this.loadedPipelines.has(config.huggingFaceId)) {
      return true;
    }
    
    // Puis vérifier la persistance
    const persistedModels = this.getPersistedLoadedModels();
    return persistedModels.includes(modelType);
  }

  /**
   * Force le rechargement d'un modèle même s'il est déjà chargé
   */
  async reloadModel(
    modelType: TranslationModelType,
    onProgress?: (progress: TranslationProgress) => void
  ): Promise<TranslationPipeline> {
    // Décharger d'abord s'il est chargé
    await this.unloadModel(modelType);
    
    // Puis recharger
    return this.loadModel(modelType, onProgress);
  }

  /**
   * Nettoie complètement le cache et la persistance
   */
  async clearAllCache(): Promise<void> {
    // Décharger tous les modèles de la mémoire
    await this.unloadAllModels();
    
    // Nettoyer le localStorage
    localStorage.removeItem(this.STORAGE_KEY_LOADED_MODELS);
    localStorage.removeItem(this.STORAGE_KEY_MODEL_CACHE);
    
    console.log(`🧹 Cache et persistance nettoyés complètement`);
  }

  /**
   * Nettoie le texte traduit des tokens et artefacts indésirables
   */
  private cleanTranslationText(text: string): string {
    if (!text) return '';
    
    return text
      // Supprimer les tokens extra_id problématiques
      .replace(/<extra_id_\d+>/g, '')
      // Supprimer les tokens de sous-mot
      .replace(/▁/g, ' ')
      // Supprimer les tokens de début/fin
      .replace(/<s>|<\/s>/g, '')
      // Supprimer les tokens de padding
      .replace(/<pad>/g, '')
      // Supprimer les tokens inconnus
      .replace(/<unk>/g, '')
      // Supprimer les tokens de masquage
      .replace(/<mask>/g, '')
      // Normaliser les espaces multiples
      .replace(/\s+/g, ' ')
      // Supprimer les espaces en début et fin
      .trim();
  }
}

// Export par défaut pour faciliter l'utilisation
export default HuggingFaceTranslationService;
