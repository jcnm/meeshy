/**
 * Système de traduction unifié - Wrapper autour de TranslationModels
 * Maintient la compatibilité avec l'API existante tout en utilisant la nouvelle architecture
 */

import { translationModels } from '@/lib/translation-models';

// Cache de traduction simple pour compatibilité
const translationCache = new Map<string, string>();

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
 * Fonction principale de traduction
 * Utilise TranslationModels de manière transparente
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

  try {
    // Utiliser TranslationModels pour la traduction
    const translatedText = await translationModels.translate(text, sourceLang, targetLang);
    
    // Mettre en cache le résultat
    if (translatedText && translatedText !== text) {
      translationCache.set(cacheKey, translatedText);
    }
    
    return translatedText;
  } catch (error) {
    console.error('❌ Erreur de traduction:', error);
    throw new Error('Échec de traduction');
  }
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
