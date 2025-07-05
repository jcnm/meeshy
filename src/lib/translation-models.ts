import * as tf from '@tensorflow/tfjs';

// Types pour les modèles de traduction
export interface TranslationModel {
  name: string;
  maxTokens: number;
  complexity: 'simple' | 'complex';
  languages: string[];
  modelUrl?: string;
  tokenizer?: string;
}

// Configuration des modèles avec URLs réelles
export const MODELS_CONFIG: Record<string, TranslationModel> = {
  mt5: {
    name: 'MT5',
    maxTokens: 50,
    complexity: 'simple',
    languages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
    modelUrl: 'https://huggingface.co/google/mt5-small/resolve/main/model.json',
    tokenizer: 'mt5-small'
  },
  nllb: {
    name: 'NLLB',
    maxTokens: 500,
    complexity: 'complex',
    languages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr'],
    modelUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/main/model.json',
    tokenizer: 'nllb-200-distilled-600M'
  }
};

// Service de gestion des modèles TensorFlow.js
export class TranslationModelsService {
  private static instance: TranslationModelsService;
  private models: Map<string, tf.GraphModel | null> = new Map();
  private loadingPromises: Map<string, Promise<tf.GraphModel | null>> = new Map();
  private initializationAttempted: Map<string, boolean> = new Map();

  static getInstance(): TranslationModelsService {
    if (!TranslationModelsService.instance) {
      TranslationModelsService.instance = new TranslationModelsService();
    }
    return TranslationModelsService.instance;
  }

  private constructor() {
    // Initialiser TensorFlow.js
    this.initializeTensorFlow();
    
    // Initialiser les modèles comme null
    this.models.set('mt5', null);
    this.models.set('nllb', null);
    this.initializationAttempted.set('mt5', false);
    this.initializationAttempted.set('nllb', false);
  }

  /**
   * Initialise TensorFlow.js avec la configuration optimale
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      // Configurer TensorFlow.js pour utiliser WebGL si disponible
      await tf.ready();
      console.log('🚀 TensorFlow.js initialisé avec backend:', tf.getBackend());
      
      // Afficher les informations sur la mémoire
      console.log('💾 Mémoire TensorFlow.js:', tf.memory());
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de TensorFlow.js:', error);
    }
  }

  /**
   * Détermine quel modèle utiliser selon le message
   */
  selectModel(message: string): keyof typeof MODELS_CONFIG {
    const length = message.length;
    const hasComplexPunctuation = /[;:,!?(){}[\]"']/.test(message);
    const wordCount = message.split(/\s+/).length;

    // Utiliser MT5 pour les messages courts et simples
    if (length <= 50 && wordCount <= 10 && !hasComplexPunctuation) {
      return 'mt5';
    }

    // Utiliser NLLB pour les messages longs et complexes
    return 'nllb';
  }

  /**
   * Charge un modèle de traduction de manière asynchrone
   */
  async loadModel(modelName: string): Promise<tf.GraphModel | null> {
    // Si le modèle est déjà chargé, le retourner
    const cachedModel = this.models.get(modelName);
    if (cachedModel) {
      return cachedModel;
    }

    // Si le modèle est en cours de chargement, attendre
    const loadingPromise = this.loadingPromises.get(modelName);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Éviter les tentatives répétées de chargement d'un modèle qui a échoué
    if (this.initializationAttempted.get(modelName)) {
      console.log(`⚠️ Modèle ${modelName} déjà tenté, utilisation du fallback`);
      return null;
    }

    // Commencer le chargement du modèle
    const promise = this.loadModelFromPath(modelName);
    this.loadingPromises.set(modelName, promise);
    this.initializationAttempted.set(modelName, true);

    try {
      const model = await promise;
      this.models.set(modelName, model);
      this.loadingPromises.delete(modelName);
      
      if (model) {
        console.log(`✅ Modèle ${modelName} chargé avec succès`);
      } else {
        console.log(`⚠️ Modèle ${modelName} non disponible, utilisation du fallback`);
      }
      
      return model;
    } catch (loadError) {
      this.loadingPromises.delete(modelName);
      console.error(`❌ Erreur lors du chargement du modèle ${modelName}:`, loadError);
      return null;
    }
  }

  /**
   * Charge le modèle depuis le système de fichiers ou URL
   */
  private async loadModelFromPath(modelName: string): Promise<tf.GraphModel | null> {
    const config = MODELS_CONFIG[modelName];
    if (!config) {
      throw new Error(`Configuration pour le modèle ${modelName} non trouvée`);
    }

    // Essayer de charger depuis le dossier public local d'abord
    const localPath = `/models/${modelName}/model.json`;
    
    try {
      // Vérifier si le modèle existe localement
      const response = await fetch(localPath, { method: 'HEAD' });
      if (response.ok) {
        console.log(`📁 Chargement du modèle ${modelName} depuis le dossier local`);
        const model = await tf.loadGraphModel(localPath);
        return model;
      }
    } catch {
      console.log(`⚠️ Modèle ${modelName} non trouvé localement, tentative depuis Hugging Face`);
    }

    // Essayer de charger depuis Hugging Face
    if (config.modelUrl) {
      try {
        console.log(`🌐 Chargement du modèle ${modelName} depuis Hugging Face`);
        const model = await tf.loadGraphModel(config.modelUrl);
        return model;
      } catch (remoteError) {
        console.warn(`⚠️ Impossible de charger ${modelName} depuis Hugging Face:`, remoteError);
      }
    }

    // Si aucun modèle n'est disponible, retourner null pour utiliser le fallback
    console.log(`🔄 Aucun modèle physique trouvé pour ${modelName}, utilisation du service de traduction fallback`);
    return null;
  }

  /**
   * Crée un modèle factice pour le développement
   */
  private createMockModel(): tf.GraphModel {
    // Créer un modèle très simple pour les tests
    const model = {
      predict: () => tf.tensor2d([[0.8, 0.2]]),
      dispose: () => {},
      inputs: [],
      outputs: [],
      weights: [],
    } as unknown as tf.GraphModel;

    return model;
  }

  /**
   * Effectue une traduction avec le modèle approprié
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    try {
      const modelName = this.selectModel(text);
      const model = await this.loadModel(modelName);

      // Si nous avons un modèle TensorFlow.js chargé, l'utiliser
      if (model && this.isRealModel(model)) {
        return this.translateWithTensorFlow(model, text, sourceLang, targetLang, modelName);
      }

      // Fallback vers l'API de traduction
      return this.translateWithAPI(text, sourceLang, targetLang, modelName);
    } catch (translationError) {
      console.error('Erreur lors de la traduction:', translationError);
      
      // En cas d'erreur totale, utiliser la simulation de base
      return this.simulateTranslation(text, sourceLang, targetLang, 'fallback');
    }
  }

  /**
   * Traduit avec TensorFlow.js (modèle réel)
   */
  private async translateWithTensorFlow(
    model: tf.GraphModel,
    text: string,
    sourceLang: string,
    targetLang: string,
    modelName: string
  ): Promise<string> {
    // TODO: Implémentation réelle avec tokenisation et inférence
    // Pour l'instant, utiliser l'API fallback
    console.log(`🧠 Utilisation du modèle TensorFlow.js ${modelName} (simulation)`);
    return this.translateWithAPI(text, sourceLang, targetLang, modelName);
  }

  /**
   * Traduit via une API de traduction externe
   */
  private async translateWithAPI(
    text: string,
    sourceLang: string,
    targetLang: string,
    modelName: string
  ): Promise<string> {
    try {
      // Construire l'URL avec les paramètres pour MyMemory API (gratuite)
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', text);
      url.searchParams.set('langpair', `${sourceLang}|${targetLang}`);

      const apiResponse = await fetch(url.toString());
      
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          console.log(`🌐 Traduction API réussie avec ${modelName}`);
          return data.responseData.translatedText;
        }
      }
      
      throw new Error('API de traduction indisponible');
    } catch (apiError) {
      console.warn('❌ Erreur API de traduction:', apiError);
      // Fallback vers la simulation
      return this.simulateTranslation(text, sourceLang, targetLang, modelName);
    }
  }

  /**
   * Vérifie si c'est un vrai modèle TensorFlow.js
   */
  private isRealModel(model: tf.GraphModel): boolean {
    return model.inputs && model.inputs.length > 0 && model.outputs && model.outputs.length > 0;
  }

  /**
   * Simulation de traduction pour le développement
   */
  private simulateTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
    modelUsed: string
  ): string {
    // Dictionnaire étendu pour simulation
    const translations: Record<string, Record<string, string>> = {
      'Hello': { 
        fr: 'Bonjour', 
        es: 'Hola', 
        de: 'Hallo', 
        it: 'Ciao', 
        pt: 'Olá', 
        ru: 'Привет',
        ja: 'こんにちは',
        ko: '안녕하세요',
        zh: '你好',
        ar: 'مرحبا',
        hi: 'नमस्ते'
      },
      'How are you?': { 
        fr: 'Comment allez-vous ?', 
        es: '¿Cómo estás?', 
        de: 'Wie geht es dir?', 
        it: 'Come stai?',
        pt: 'Como está?',
        ru: 'Как дела?',
        ja: '元気ですか？',
        ko: '어떻게 지내세요?'
      },
      'Thank you': { 
        fr: 'Merci', 
        es: 'Gracias', 
        de: 'Danke', 
        it: 'Grazie',
        pt: 'Obrigado',
        ru: 'Спасибо',
        ja: 'ありがとう',
        ko: '감사합니다'
      },
      'Good morning': { 
        fr: 'Bonjour', 
        es: 'Buenos días', 
        de: 'Guten Morgen', 
        it: 'Buongiorno',
        pt: 'Bom dia',
        ru: 'Доброе утро',
        ja: 'おはようございます'
      },
      'Goodbye': { 
        fr: 'Au revoir', 
        es: 'Adiós', 
        de: 'Auf Wiedersehen', 
        it: 'Arrivederci',
        pt: 'Tchau',
        ru: 'До свидания',
        ja: 'さようなら'
      },
      'Yes': {
        fr: 'Oui',
        es: 'Sí',
        de: 'Ja',
        it: 'Sì',
        pt: 'Sim',
        ru: 'Да',
        ja: 'はい',
        ko: '네'
      },
      'No': {
        fr: 'Non',
        es: 'No',
        de: 'Nein',
        it: 'No',
        pt: 'Não',
        ru: 'Нет',
        ja: 'いいえ',
        ko: '아니요'
      }
    };

    // Simulation basée sur le texte exact ou traduction générique
    const exactTranslation = translations[text]?.[targetLang];
    if (exactTranslation) {
      return exactTranslation;
    }

    // Traduction générique avec indicateur du modèle utilisé
    if (modelUsed === 'fallback') {
      return `[SIMULATION] ${text} (${sourceLang}→${targetLang})`;
    }
    
    return `[${modelUsed.toUpperCase()}] ${text} → ${targetLang}`;
  }

  /**
   * Vérifie si un modèle est disponible
   */
  isModelLoaded(modelName: string): boolean {
    const model = this.models.get(modelName);
    return model !== null && model !== undefined;
  }

  /**
   * Libère la mémoire des modèles
   */
  dispose(): void {
    this.models.forEach((model, name) => {
      if (model) {
        model.dispose();
        console.log(`🗑️ Modèle ${name} libéré de la mémoire`);
      }
    });
    this.models.clear();
    this.loadingPromises.clear();
  }

  /**
   * Obtient les informations sur l'état des modèles
   */
  getModelsStatus(): Record<string, { loaded: boolean; loading: boolean }> {
    const status: Record<string, { loaded: boolean; loading: boolean }> = {};
    
    Object.keys(MODELS_CONFIG).forEach(modelName => {
      status[modelName] = {
        loaded: this.isModelLoaded(modelName),
        loading: this.loadingPromises.has(modelName)
      };
    });

    return status;
  }
}

// Instance singleton pour l'utilisation globale
export const translationModels = TranslationModelsService.getInstance();
