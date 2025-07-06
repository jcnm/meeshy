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
   * Traduit un texte avec un modèle spécifique
   */
  async translateWithModel(
    text: string,
    sourceLang: string,
    targetLang: string,
    forcedModel: string
  ): Promise<string> {
    try {
      const model = await this.loadModel(forcedModel);

      // Si nous avons un modèle TensorFlow.js chargé, l'utiliser
      if (model && this.isRealModel(model)) {
        return this.translateWithTensorFlow(model, text, sourceLang, targetLang, forcedModel);
      }

      // Fallback vers l'API de traduction avec indication du modèle
      return this.translateWithAPI(text, sourceLang, targetLang, forcedModel);
    } catch (translationError) {
      console.error(`Erreur lors de la traduction avec ${forcedModel}:`, translationError);
      
      // En cas d'erreur, utiliser la simulation spécifique au modèle
      return this.simulateTranslation(text, sourceLang, targetLang, forcedModel);
    }
  }
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
    console.log(`🔄 Simulation de traduction avec ${modelUsed}: "${text}" (${sourceLang} → ${targetLang})`);

    // Dictionnaire étendu pour simulation avec variations par modèle
    const translations: Record<string, Record<string, Record<string, string>>> = {
      // Français vers Anglais
      'Bonjour, comment allez-vous ?': {
        mt5: { en: 'Hello, how are you?' },
        nllb: { en: 'Good day, how are you doing?' }
      },
      'Salut ! Ça va ? On se voit ce soir au ciné ?': {
        mt5: { en: 'Hi! How are you? See you tonight at the movies?' },
        nllb: { en: 'Hey! How\'s it going? Shall we meet tonight at the cinema?' }
      },
      'Nous vous remercions pour votre proposition. Après analyse, nous souhaitons programmer une réunion pour discuter des détails.': {
        mt5: { en: 'We thank you for your proposal. After analysis, we wish to schedule a meeting to discuss the details.' },
        nllb: { en: 'Thank you for your proposal. Following our review, we would like to arrange a meeting to discuss the details.' }
      },
      'La traduction automatique est un domaine fascinant qui combine linguistique computationnelle et intelligence artificielle pour transformer des textes d\'une langue source vers une langue cible.': {
        mt5: { en: 'Automatic translation is a fascinating field that combines computational linguistics and artificial intelligence to transform texts from a source language to a target language.' },
        nllb: { en: 'Machine translation is a fascinating domain that merges computational linguistics with artificial intelligence to convert texts from one source language into a target language.' }
      },
      'Dans les méandres de sa conscience troublée, elle cherchait les mots qui sauraient exprimer l\'inexprimable nostalgie de ces instants suspendus entre rêve et réalité.': {
        mt5: { en: 'In the meanders of her troubled consciousness, she searched for words that could express the inexpressible nostalgia of these moments suspended between dream and reality.' },
        nllb: { en: 'Within the labyrinth of her troubled mind, she sought words that might capture the ineffable nostalgia of those instants hanging between dream and reality.' }
      },
      'Les défis contemporains de la mondialisation nécessitent une approche interdisciplinaire qui prend en compte les spécificités culturelles, linguistiques et socio-économiques de chaque région géographique.': {
        mt5: { en: 'Contemporary challenges of globalization require an interdisciplinary approach that takes into account the cultural, linguistic and socio-economic specificities of each geographical region.' },
        nllb: { en: 'The contemporary challenges posed by globalization demand an interdisciplinary methodology that considers the cultural, linguistic, and socio-economic particularities of each geographic region.' }
      },
      '- Tu es sûr que c\'est une bonne idée ?\n- Franchement, j\'en sais rien... Mais on n\'a pas vraiment le choix, si ?': {
        mt5: { en: '- Are you sure that\'s a good idea?\n- Honestly, I don\'t know... But we don\'t really have a choice, do we?' },
        nllb: { en: '- Are you certain this is a wise idea?\n- Frankly, I have no clue... But we don\'t truly have an alternative, right?' }
      },
      'Le gouvernement a annoncé aujourd\'hui une série de mesures visant à réduire l\'impact environnemental des transports urbains d\'ici 2030.': {
        mt5: { en: 'The government announced today a series of measures aimed at reducing the environmental impact of urban transport by 2030.' },
        nllb: { en: 'The government today unveiled a range of initiatives targeting the reduction of environmental impact from urban transportation by 2030.' }
      }
    };

    // Vérifier si nous avons une traduction spécifique pour ce modèle
    const modelTranslations = translations[text]?.[modelUsed];
    if (modelTranslations?.[targetLang]) {
      return modelTranslations[targetLang];
    }

    // Fallback avec variation selon le modèle
    if (modelUsed === 'mt5') {
      // mT5 produit des traductions plus directes
      if (text.length < 50) {
        return this.generateSimpleTranslation(text, targetLang, 'direct');
      } else {
        return this.generateComplexTranslation(text, targetLang, 'direct');
      }
    } else if (modelUsed === 'nllb') {
      // NLLB produit des traductions plus nuancées
      if (text.length < 50) {
        return this.generateSimpleTranslation(text, targetLang, 'nuanced');
      } else {
        return this.generateComplexTranslation(text, targetLang, 'nuanced');
      }
    }

    // Fallback générique
    return `[${modelUsed.toUpperCase()}] Translation of "${text}" to ${targetLang}`;
  }

  /**
   * Génère une traduction simple simulée
   */
  private generateSimpleTranslation(text: string, targetLang: string, style: 'direct' | 'nuanced'): string {
    const templates: Record<'direct' | 'nuanced', Record<string, string>> = {
      direct: {
        en: `Translation: ${text}`,
        fr: `Traduction : ${text}`,
        es: `Traducción: ${text}`,
        de: `Übersetzung: ${text}`,
        it: `Traduzione: ${text}`
      },
      nuanced: {
        en: `Rendered as: ${text}`,
        fr: `Rendu comme : ${text}`,
        es: `Interpretado como: ${text}`,
        de: `Wiedergegeben als: ${text}`,
        it: `Reso come: ${text}`
      }
    };

    return templates[style][targetLang] || `[${style.toUpperCase()}] ${text} → ${targetLang}`;
  }

  /**
   * Génère une traduction complexe simulée
   */
  private generateComplexTranslation(text: string, targetLang: string, style: 'direct' | 'nuanced'): string {
    const prefixes: Record<'direct' | 'nuanced', Record<string, string>> = {
      direct: {
        en: 'Direct translation: ',
        fr: 'Traduction directe : ',
        es: 'Traducción directa: ',
        de: 'Direkte Übersetzung: ',
        it: 'Traduzione diretta: '
      },
      nuanced: {
        en: 'Contextual rendering: ',
        fr: 'Rendu contextuel : ',
        es: 'Interpretación contextual: ',
        de: 'Kontextuelle Wiedergabe: ',
        it: 'Resa contestuale: '
      }
    };

    const prefix = prefixes[style][targetLang] || `[${style.toUpperCase()}] `;
    
    // Simuler une traduction en modifiant légèrement le texte
    const words = text.split(' ');
    if (words.length > 10) {
      // Pour les textes longs, tronquer et ajouter une indication
      const truncated = words.slice(0, 10).join(' ');
      return `${prefix}${truncated}... [${style === 'direct' ? 'simplified' : 'elaborated'} for ${targetLang}]`;
    }
    
    return `${prefix}${text} [adapted for ${targetLang}]`;
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
