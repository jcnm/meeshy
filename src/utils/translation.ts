/**
 * Système de traduction avec modèles TensorFlow.js et fallback API
 * Supporte mT5 et NLLB avec différentes tailles selon les capacités machine
 */

import * as tf from '@tensorflow/tfjs';
import { 
  detectSystemCapabilities, 
  recommendModelVariants, 
  getModelConfig 
} from '@/lib/model-config';
import { modelCache } from '@/lib/model-cache';

// Configuration globale
const systemCapabilities = detectSystemCapabilities();
const recommendedVariants = recommendModelVariants(systemCapabilities);

// Cache de traduction simple
const translationCache = new Map<string, string>();

// Modèles TensorFlow.js chargés
const loadedModels = new Map<string, tf.GraphModel>();
const loadingPromises = new Map<string, Promise<tf.GraphModel | null>>();

/**
 * Génère une clé de cache pour une traduction
 */
function getCacheKey(text: string, sourceLang: string, targetLang: string): string {
  return `${sourceLang}-${targetLang}-${text.trim().toLowerCase()}`;
}

/**
 * Détecte la langue d'un texte avec des patterns simples
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'en'; // Langue par défaut
  }

  const cleanText = text.toLowerCase().trim();

  // Patterns de détection basiques
  const patterns: Record<string, RegExp[]> = {
    fr: [
      /\b(le|la|les|de|du|des|un|une|et|est|avec|pour|par|dans|sur|son|sa|ses|que|qui|où|quand|comment|pourquoi|je|tu|il|elle|nous|vous|ils|elles|moi|toi|lui|eux|ça|ce|cette|ces|mon|ma|mes|ton|ta|tes)\b/g,
      /[àâäéèêëïîôöùûüÿç]/g,
    ],
    es: [
      /\b(el|la|los|las|de|del|un|una|y|es|con|para|por|en|sobre|su|sus|que|quien|donde|cuando|como|porque|yo|tú|él|ella|nosotros|vosotros|ellos|ellas|mi|tu|su|nuestro|vuestro)\b/g,
      /[áéíóúüñ]/g,
    ],
    de: [
      /\b(der|die|das|den|dem|ein|eine|und|ist|mit|für|von|in|auf|sein|seine|ihre|dass|wer|wo|wann|wie|warum|ich|du|er|sie|es|wir|ihr|sie|mein|dein|sein|unser|euer)\b/g,
      /[äöüß]/g,
    ],
    it: [
      /\b(il|la|lo|gli|le|di|del|un|una|e|è|con|per|da|in|su|suo|sua|che|chi|dove|quando|come|perché|io|tu|lui|lei|noi|voi|loro|mio|tuo|suo|nostro|vostro)\b/g,
      /[àèéìíîòóù]/g,
    ],
    pt: [
      /\b(o|a|os|as|de|do|da|um|uma|e|é|com|para|por|em|sobre|seu|sua|que|quem|onde|quando|como|porque|eu|tu|ele|ela|nós|vós|eles|elas|meu|teu|seu|nosso|vosso)\b/g,
      /[àáâãéêíóôõú]/g,
    ],
    en: [
      /\b(the|a|an|and|is|with|for|by|in|on|his|her|their|that|who|where|when|how|why|i|you|he|she|we|they|me|him|her|us|them|my|your|his|her|our|their)\b/g,
    ],
  };

  // Compter les matches pour chaque langue
  const scores: Record<string, number> = {};

  for (const [lang, langPatterns] of Object.entries(patterns)) {
    let score = 0;
    for (const pattern of langPatterns) {
      const matches = cleanText.match(pattern);
      if (matches) {
        score += matches.length;
      }
    }
    scores[lang] = score;
  }

  // Trouver la langue avec le meilleur score
  const sortedScores = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  if (sortedScores.length > 0 && sortedScores[0][1] > 1) {
    return sortedScores[0][0];
  }

  // Fallback à l'anglais
  return 'en';
}

/**
 * Sélectionne le modèle approprié selon le message
 */
function selectModel(text: string): { family: string; variant: string } {
  const length = text.length;
  const hasComplexPunctuation = /[;:,!?(){}[\]"']/.test(text);
  const wordCount = text.split(/\s+/).length;
  const hasMultipleSentences = text.split(/[.!?]+/).length > 1;

  // Utiliser mT5 pour les messages courts et simples
  if (length <= 100 && wordCount <= 15 && !hasComplexPunctuation && !hasMultipleSentences) {
    return { family: 'mt5', variant: recommendedVariants.mt5 };
  }

  // Utiliser NLLB pour les messages longs et complexes
  return { family: 'nllb', variant: recommendedVariants.nllb };
}

/**
 * Charge un modèle TensorFlow.js depuis le cache ou télécharge-le
 */
async function loadModel(family: string, variant: string): Promise<tf.GraphModel | null> {
  const modelKey = `${family}-${variant}`;
  
  // Si déjà chargé en mémoire
  if (loadedModels.has(modelKey)) {
    return loadedModels.get(modelKey)!;
  }
  
  // Si en cours de chargement
  if (loadingPromises.has(modelKey)) {
    return loadingPromises.get(modelKey)!;
  }

  const loadingPromise = (async (): Promise<tf.GraphModel | null> => {
    try {
      console.log(`🔄 Chargement du modèle ${family}-${variant}...`);

      // Vérifier le cache local d'abord
      const cachedModel = await modelCache.getCachedModel(family, variant);
      
      if (cachedModel) {
        console.log(`📦 Modèle ${family}-${variant} trouvé dans le cache`);
        // Charger depuis le blob en cache
        const modelArrayBuffer = await cachedModel.modelBlob.arrayBuffer();
        const model = await tf.loadGraphModel(tf.io.fromMemory(modelArrayBuffer));
        loadedModels.set(modelKey, model);
        return model;
      }

      // Si pas en cache, essayer de télécharger
      const config = getModelConfig(family, variant);
      if (!config) {
        console.error(`❌ Configuration non trouvée pour ${family}-${variant}`);
        return null;
      }

      console.log(`⬇️ Téléchargement du modèle ${family}-${variant} depuis ${config.variant.modelUrl}`);
      
      // Télécharger et mettre en cache
      const downloadSuccess = await modelCache.downloadAndCacheModel(
        family,
        variant,
        config.variant.modelUrl,
        config.variant.tokenizerUrl
      );

      if (!downloadSuccess) {
        console.error(`❌ Échec du téléchargement de ${family}-${variant}`);
        return null;
      }

      // Recharger depuis le cache maintenant qu'il est téléchargé
      const newCachedModel = await modelCache.getCachedModel(family, variant);
      if (newCachedModel) {
        const modelArrayBuffer = await newCachedModel.modelBlob.arrayBuffer();
        const model = await tf.loadGraphModel(tf.io.fromMemory(modelArrayBuffer));
        loadedModels.set(modelKey, model);
        return model;
      }

      return null;
    } catch (error) {
      console.error(`❌ Erreur lors du chargement du modèle ${family}-${variant}:`, error);
      return null;
    }
  })();

  loadingPromises.set(modelKey, loadingPromise);
  
  try {
    const result = await loadingPromise;
    loadingPromises.delete(modelKey);
    return result;
  } catch (error) {
    loadingPromises.delete(modelKey);
    throw error;
  }
}

/**
 * Traduit un texte avec les modèles TensorFlow.js
 */
async function translateWithModels(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (sourceLang === targetLang) {
    return text;
  }

  try {
    const { family, variant } = selectModel(text);
    
    console.log(`🤖 Tentative de traduction avec ${family}-${variant}: ${sourceLang} → ${targetLang}`);
    
    const model = await loadModel(family, variant);
    
    if (!model) {
      throw new Error(`Modèle ${family}-${variant} non disponible`);
    }

    // TODO: Implémentation réelle de la traduction avec TensorFlow.js
    // Pour l'instant, nous simulons un échec pour utiliser le fallback API
    // Dans une version complète, ici on ferait:
    // 1. Tokenisation du texte source
    // 2. Inférence avec le modèle
    // 3. Décodage du résultat
    
    console.log(`⚠️ Traduction TensorFlow.js pas encore implémentée pour ${family}-${variant}`);
    throw new Error('Traduction TensorFlow.js non implémentée');
    
  } catch (error) {
    console.error('Erreur modèle TensorFlow.js:', error);
    throw error;
  }
}

/**
 * Traduit un texte avec l'API MyMemory (fallback)
 */
async function translateWithAPI(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (sourceLang === targetLang) {
    return text;
  }

  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${sourceLang}|${targetLang}`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData) {
      const translatedText = data.responseData.translatedText;
      
      // Vérifier que la traduction n'est pas identique (signe d'échec)
      if (translatedText && translatedText.trim() !== text.trim()) {
        return translatedText;
      }
    }
    
    throw new Error('Traduction API non disponible');
  } catch (error) {
    console.error('Erreur API de traduction:', error);
    throw error;
  }
}

/**
 * Fonction principale de traduction
 * Essaie d'abord les modèles TensorFlow.js, puis fallback vers l'API
 */
export async function translateMessage(
  text: string, 
  sourceLang: string, 
  targetLang: string
): Promise<string> {
  if (!text || !text.trim()) {
    return text;
  }

  if (sourceLang === targetLang) {
    return text;
  }

  // Vérifier le cache d'abord
  const cacheKey = getCacheKey(text, sourceLang, targetLang);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    console.log('✅ Traduction trouvée dans le cache');
    return cached;
  }

  let translatedText: string;

  try {
    // Essayer d'abord les modèles TensorFlow.js
    console.log(`🤖 Tentative de traduction avec modèles TensorFlow.js: ${sourceLang} → ${targetLang}`);
    translatedText = await translateWithModels(text, sourceLang, targetLang);
    console.log('✅ Traduction réussie avec modèles TensorFlow.js');
  } catch {
    console.log('⚠️ Échec des modèles TensorFlow.js, tentative avec API...');
    
    try {
      // Fallback vers l'API
      translatedText = await translateWithAPI(text, sourceLang, targetLang);
      console.log('✅ Traduction réussie avec API de fallback');
    } catch {
      console.error('❌ Échec de toutes les méthodes de traduction');
      throw new Error('Échec de traduction');
    }
  }

  // Mettre en cache le résultat
  if (translatedText && translatedText !== text) {
    translationCache.set(cacheKey, translatedText);
  }

  return translatedText;
}

/**
 * Nettoie le cache de traduction
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * Obtient les statistiques du cache
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: translationCache.size,
    keys: Array.from(translationCache.keys()),
  };
}

/**
 * Obtient une traduction du cache
 */
export function getCachedTranslation(text: string, sourceLang: string, targetLang: string): string | null {
  const cacheKey = getCacheKey(text, sourceLang, targetLang);
  return translationCache.get(cacheKey) || null;
}

/**
 * Met en cache une traduction
 */
export function setCachedTranslation(
  text: string, 
  sourceLang: string, 
  targetLang: string, 
  translation: string
): void {
  const cacheKey = getCacheKey(text, sourceLang, targetLang);
  translationCache.set(cacheKey, translation);
}
