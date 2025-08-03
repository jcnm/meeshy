/**
 * Utilitaires pour la détection et gestion des langues
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
];

/**
 * Détecte la langue d'un texte en utilisant des patterns simples
 * Fallback basique avant d'utiliser des APIs externes
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'en'; // Langue par défaut
  }

  // Nettoyer le texte
  const cleanText = text.toLowerCase().trim();

  // Patterns de détection basiques
  const patterns: Record<string, RegExp[]> = {
    fr: [
      /\b(le|la|les|de|du|des|un|une|et|est|avec|pour|par|dans|sur|son|sa|ses|que|qui|où|quand|comment|pourquoi)\b/g,
      /[àâäéèêëïîôöùûüÿç]/g,
    ],
    es: [
      /\b(el|la|los|las|de|del|un|una|y|es|con|para|por|en|sobre|su|sus|que|quien|donde|cuando|como|porque)\b/g,
      /[áéíóúüñ]/g,
    ],
    de: [
      /\b(der|die|das|den|dem|ein|eine|und|ist|mit|für|von|in|auf|sein|seine|ihre|dass|wer|wo|wann|wie|warum)\b/g,
      /[äöüß]/g,
    ],
    it: [
      /\b(il|la|lo|gli|le|di|del|un|una|e|è|con|per|da|in|su|suo|sua|che|chi|dove|quando|come|perché)\b/g,
      /[àèéìíîòóù]/g,
    ],
    pt: [
      /\b(o|a|os|as|de|do|da|um|uma|e|é|com|para|por|em|sobre|seu|sua|que|quem|onde|quando|como|porque)\b/g,
      /[àáâãéêíóôõú]/g,
    ],
    ru: [
      /[а-яё]/g,
      /\b(и|в|на|с|по|к|из|от|за|для|про|под|над|при|без|через|между|среди|около|вокруг|внутри)\b/g,
    ],
    ar: [
      /[ا-ي]/g,
      /\b(في|من|إلى|على|عن|مع|بعد|قبل|عند|لدى|حول|خلال|بين|ضد|نحو|تحت|فوق|أمام|خلف|يمين|شمال)\b/g,
    ],
    zh: [
      /[\u4e00-\u9fff]/g,
      /\b(的|了|在|是|我|有|和|人|这|中|大|为|上|个|国|年|到|说|们|就|出|要|以|时|和|地|们|得|可|下|对|生|也|子|后|自|回|她|哪|并|那|意|发|样|等|法|应|加|好)\b/g,
    ],
    ja: [
      /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g,
      /\b(は|が|を|に|で|と|から|まで|より|へ|の|だ|である|です|ます|した|する|される|なる|ある|いる|この|その|あの|どの)\b/g,
    ],
    ko: [
      /[\uac00-\ud7af]/g,
      /\b(은|는|이|가|을|를|에|에서|으로|로|와|과|의|도|만|조차|까지|부터|보다|처럼|같이|위해|대해|통해|따라|관해|대한|위한)\b/g,
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

  if (sortedScores.length > 0) {
    return sortedScores[0][0];
  }

  // Détection par défaut selon le navigateur
  if (typeof window !== 'undefined') {
    const browserLang = navigator.language.split('-')[0];
    if (SUPPORTED_LANGUAGES.some(lang => lang.code === browserLang)) {
      return browserLang;
    }
  }

  return 'en'; // Fallback
}

/**
 * Obtient les informations d'une langue par son code
 */
export function getLanguageInfo(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

/**
 * Formate le nom d'une langue pour l'affichage
 */
export function formatLanguageName(code: string, format: 'name' | 'native' | 'both' = 'both'): string {
  const lang = getLanguageInfo(code);
  if (!lang) return code.toUpperCase();

  switch (format) {
    case 'name':
      return lang.name;
    case 'native':
      return lang.nativeName;
    case 'both':
      return lang.name === lang.nativeName 
        ? `${lang.flag} ${lang.name}` 
        : `${lang.flag} ${lang.name} (${lang.nativeName})`;
    default:
      return lang.name;
  }
}

/**
 * Valide si une langue est supportée
 */
export function isSupportedLanguage(code: string): boolean {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
}

/**
 * Obtient la langue préférée de l'utilisateur
 */
export function getUserPreferredLanguage(): string {
  if (typeof window === 'undefined') return 'en';

  // Vérifier le localStorage d'abord
  const savedLang = localStorage.getItem('meeshy-preferred-language');
  if (savedLang && isSupportedLanguage(savedLang)) {
    return savedLang;
  }

  // Ensuite vérifier la langue du navigateur
  const browserLang = navigator.language.split('-')[0];
  if (isSupportedLanguage(browserLang)) {
    return browserLang;
  }

  return 'en';
}

/**
 * Sauvegarde la langue préférée de l'utilisateur
 */
export function saveUserPreferredLanguage(code: string): void {
  if (typeof window === 'undefined') return;
  
  if (isSupportedLanguage(code)) {
    localStorage.setItem('meeshy-preferred-language', code);
  }
}
