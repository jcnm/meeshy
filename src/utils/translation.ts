// import * as tf from '@tensorflow/tfjs'; // Sera utilisé pour l'implémentation réelle
import { TranslationCache } from '@/types';

/**
 * Générer une clé de cache unique pour une traduction
 */
export function generateCacheKey(
  message: string,
  sourceLanguage: string,
  targetLanguage: string
): string {
  const data = `${message}_${sourceLanguage}_${targetLanguage}`;
  // Simple hash function pour créer une clé unique
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `translation_${Math.abs(hash)}`;
}

/**
 * Sauvegarder une traduction dans le cache localStorage
 */
export function saveTranslationToCache(
  originalMessage: string,
  sourceLanguage: string,
  targetLanguage: string,
  translatedMessage: string
): void {
  try {
    const key = generateCacheKey(originalMessage, sourceLanguage, targetLanguage);
    const cache: TranslationCache = {
      key,
      originalMessage,
      sourceLanguage,
      targetLanguage,
      translatedMessage,
      timestamp: new Date(),
    };

    localStorage.setItem(key, JSON.stringify(cache));
    
    // Nettoyer le cache si nécessaire (garder max 1000 entrées)
    cleanupCache();
  } catch (error) {
    console.error('Erreur lors de la sauvegarde en cache:', error);
  }
}

/**
 * Récupérer une traduction depuis le cache
 */
export function getTranslationFromCache(
  message: string,
  sourceLanguage: string,
  targetLanguage: string
): string | null {
  try {
    const key = generateCacheKey(message, sourceLanguage, targetLanguage);
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const cache: TranslationCache = JSON.parse(cached);
    
    // Vérifier si le cache n'est pas trop ancien (30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (new Date(cache.timestamp) < thirtyDaysAgo) {
      localStorage.removeItem(key);
      return null;
    }
    
    return cache.translatedMessage;
  } catch (error) {
    console.error('Erreur lors de la récupération du cache:', error);
    return null;
  }
}

/**
 * Nettoyer le cache en gardant seulement les 1000 entrées les plus récentes
 */
function cleanupCache(): void {
  try {
    const translationKeys: Array<{ key: string; timestamp: Date }> = [];
    
    // Récupérer toutes les clés de traduction
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('translation_')) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const cache: TranslationCache = JSON.parse(cached);
          translationKeys.push({ key, timestamp: new Date(cache.timestamp) });
        }
      }
    }
    
    // Si plus de 1000 entrées, supprimer les plus anciennes
    if (translationKeys.length > 1000) {
      translationKeys.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Supprimer les entrées au-delà de 1000
      for (let i = 1000; i < translationKeys.length; i++) {
        localStorage.removeItem(translationKeys[i].key);
      }
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage du cache:', error);
  }
}

/**
 * Déterminer si un message est simple ou complexe
 * Simple: ≤50 caractères et faible complexité syntaxique
 */
export function isSimpleMessage(message: string): boolean {
  if (message.length > 50) return false;
  
  // Vérifier la complexité syntaxique
  const complexPatterns = [
    /[.!?]{2,}/, // Plusieurs ponctuations
    /[;:]/, // Points-virgules ou deux-points
    /\b(que|qui|dont|où|because|since|although|however)\b/i, // Mots de liaison complexes
    /\([^)]*\)/, // Parenthèses
    /\[[^\]]*\]/, // Crochets
    /"[^"]*"/, // Guillemets
  ];
  
  return !complexPatterns.some(pattern => pattern.test(message));
}

/**
 * Détecter la langue d'un texte (fonction simple basée sur des patterns)
 */
export function detectLanguage(text: string): string {
  const languagePatterns = {
    en: /\b(the|and|is|are|was|were|have|has|will|would|could|should)\b/gi,
    fr: /\b(le|la|les|et|est|sont|était|étaient|avoir|aura|aurait|pourrait|devrait)\b/gi,
    es: /\b(el|la|los|las|y|es|son|era|eran|tener|tendrá|tendría|podría|debería)\b/gi,
    de: /\b(der|die|das|und|ist|sind|war|waren|haben|wird|würde|könnte|sollte)\b/gi,
    ru: /[а-яё]/gi,
    zh: /[\u4e00-\u9fff]/g,
    ja: /[\u3040-\u309f\u30a0-\u30ff]/g,
    ar: /[\u0600-\u06ff]/g,
  };
  
  let maxMatches = 0;
  let detectedLanguage = 'en';
  
  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    const matches = text.match(pattern);
    const matchCount = matches ? matches.length : 0;
    
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      detectedLanguage = lang;
    }
  }
  
  return detectedLanguage;
}

/**
 * Fonction simulée de traduction MT5 (remplacer par l'implémentation réelle)
 */
export async function translateWithMT5(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  // Vérifier le cache d'abord
  const cached = getTranslationFromCache(text, sourceLanguage, targetLanguage);
  if (cached) return cached;
  
  // Simulation de traduction (remplacer par l'implémentation TensorFlow.js réelle)
  await new Promise(resolve => setTimeout(resolve, 500)); // Simuler le temps de traduction
  
  const mockTranslation = `[MT5] ${text} (${sourceLanguage}→${targetLanguage})`;
  
  // Sauvegarder en cache
  saveTranslationToCache(text, sourceLanguage, targetLanguage, mockTranslation);
  
  return mockTranslation;
}

/**
 * Fonction simulée de traduction NLLB (remplacer par l'implémentation réelle)
 */
export async function translateWithNLLB(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  // Vérifier le cache d'abord
  const cached = getTranslationFromCache(text, sourceLanguage, targetLanguage);
  if (cached) return cached;
  
  // Simulation de traduction (remplacer par l'implémentation TensorFlow.js réelle)
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simuler le temps de traduction plus long
  
  const mockTranslation = `[NLLB] ${text} (${sourceLanguage}→${targetLanguage})`;
  
  // Sauvegarder en cache
  saveTranslationToCache(text, sourceLanguage, targetLanguage, mockTranslation);
  
  return mockTranslation;
}

/**
 * Fonction principale de traduction qui choisit automatiquement le modèle
 */
export async function translateMessage(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  if (sourceLanguage === targetLanguage) return text;
  
  try {
    if (isSimpleMessage(text)) {
      return await translateWithMT5(text, sourceLanguage, targetLanguage);
    } else {
      return await translateWithNLLB(text, sourceLanguage, targetLanguage);
    }
  } catch (error) {
    console.error('Erreur de traduction:', error);
    return text; // Fallback: retourner le texte original
  }
}
