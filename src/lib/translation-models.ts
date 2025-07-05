import * as tf from '@tensorflow/tfjs';

// Types pour les modèles de traduction
export interface TranslationModel {
  name: string;
  maxTokens: number;
  complexity: 'simple' | 'complex';
  languages: string[];
}

// Configuration des modèles
export const MODELS_CONFIG: Record<string, TranslationModel> = {
  mt5: {
    name: 'MT5',
    maxTokens: 50,
    complexity: 'simple',
    languages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
  },
  nllb: {
    name: 'NLLB',
    maxTokens: 500,
    complexity: 'complex',
    languages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr']
  }
};

// Service de gestion des modèles TensorFlow.js
export class TranslationModelsService {
  private static instance: TranslationModelsService;
  private models: Map<string, tf.GraphModel | null> = new Map();
  private loadingPromises: Map<string, Promise<tf.GraphModel>> = new Map();

  static getInstance(): TranslationModelsService {
    if (!TranslationModelsService.instance) {
      TranslationModelsService.instance = new TranslationModelsService();
    }
    return TranslationModelsService.instance;
  }

  private constructor() {
    // Initialiser les modèles comme null
    this.models.set('mt5', null);
    this.models.set('nllb', null);
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
  async loadModel(modelName: string): Promise<tf.GraphModel> {
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

    // Commencer le chargement du modèle
    const promise = this.loadModelFromPath(modelName);
    this.loadingPromises.set(modelName, promise);

    try {
      const model = await promise;
      this.models.set(modelName, model);
      this.loadingPromises.delete(modelName);
      console.log(`✅ Modèle ${modelName} chargé avec succès`);
      return model;
    } catch (error) {
      this.loadingPromises.delete(modelName);
      console.error(`❌ Erreur lors du chargement du modèle ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Charge le modèle depuis le système de fichiers ou URL
   */
  private async loadModelFromPath(modelName: string): Promise<tf.GraphModel> {
    const modelPath = `/models/${modelName}/model.json`;
    
    try {
      // Vérifier si le modèle existe
      const response = await fetch(modelPath, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Modèle ${modelName} non trouvé à ${modelPath}`);
      }

      // Charger le modèle TensorFlow.js
      const model = await tf.loadGraphModel(modelPath);
      return model;
    } catch (error) {
      console.warn(`⚠️ Modèle ${modelName} non disponible, utilisation du mock`);
      // Retourner un modèle factice pour le développement
      return this.createMockModel();
    }
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

      // Pour le développement, utiliser une traduction simulée
      if (!model || this.isMockModel(model)) {
        return this.simulateTranslation(text, sourceLang, targetLang, modelName);
      }

      // Ici, nous aurions la logique réelle de traduction avec TensorFlow.js
      // Pour l'instant, utiliser la simulation
      return this.simulateTranslation(text, sourceLang, targetLang, modelName);
    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      throw new Error(`Erreur de traduction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Vérifie si c'est un modèle factice
   */
  private isMockModel(model: tf.GraphModel): boolean {
    return !model.inputs || model.inputs.length === 0;
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
    // Dictionnaire simple pour simulation
    const translations: Record<string, Record<string, string>> = {
      'Hello': { fr: 'Bonjour', es: 'Hola', de: 'Hallo', it: 'Ciao' },
      'How are you?': { fr: 'Comment allez-vous ?', es: '¿Cómo estás?', de: 'Wie geht es dir?', it: 'Come stai?' },
      'Thank you': { fr: 'Merci', es: 'Gracias', de: 'Danke', it: 'Grazie' },
      'Good morning': { fr: 'Bonjour', es: 'Buenos días', de: 'Guten Morgen', it: 'Buongiorno' },
      'Goodbye': { fr: 'Au revoir', es: 'Adiós', de: 'Auf Wiedersehen', it: 'Arrivederci' }
    };

    // Simulation basée sur le texte exact ou traduction générique
    const exactTranslation = translations[text]?.[targetLang];
    if (exactTranslation) {
      return exactTranslation;
    }

    // Traduction générique avec indicateur du modèle utilisé
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
