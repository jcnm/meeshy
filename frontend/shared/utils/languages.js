"use strict";
/**
 * Utilitaires unifiés pour la gestion des langues dans Meeshy
 * Module partagé entre Gateway, Frontend, et Translator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPING_CANCELATION_DELAY = exports.TOAST_ERROR_DURATION = exports.TOAST_LONG_DURATION = exports.TOAST_SHORT_DURATION = exports.MAX_MESSAGE_LENGTH = exports.SUPPORTED_LANGUAGES = void 0;
exports.getLanguageInfo = getLanguageInfo;
exports.getLanguageName = getLanguageName;
exports.getLanguageFlag = getLanguageFlag;
exports.getLanguageColor = getLanguageColor;
exports.getLanguageTranslateText = getLanguageTranslateText;
exports.isSupportedLanguage = isSupportedLanguage;
exports.getSupportedLanguageCodes = getSupportedLanguageCodes;
exports.filterSupportedLanguages = filterSupportedLanguages;
/**
 * Liste complète des langues supportées avec toutes les propriétés
 * Fusion de toutes les versions existantes pour préserver la plus longue liste
 */
exports.SUPPORTED_LANGUAGES = [
    {
        code: 'fr',
        name: 'Français',
        flag: '🇫🇷',
        color: 'bg-blue-500',
        translateText: 'Traduire ce message en français'
    },
    {
        code: 'en',
        name: 'English',
        flag: '🇬🇧',
        color: 'bg-red-500',
        translateText: 'Translate this message to English'
    },
    {
        code: 'es',
        name: 'Español',
        flag: '🇪🇸',
        color: 'bg-yellow-500',
        translateText: 'Traducir este mensaje al español'
    },
    {
        code: 'de',
        name: 'Deutsch',
        flag: '🇩🇪',
        color: 'bg-gray-800',
        translateText: 'Diese Nachricht ins Deutsche übersetzen'
    },
    {
        code: 'pt',
        name: 'Português',
        flag: '🇵🇹',
        color: 'bg-green-500',
        translateText: 'Traduzir esta mensagem para português'
    },
    {
        code: 'zh',
        name: '中文',
        flag: '🇨🇳',
        color: 'bg-red-600',
        translateText: '将此消息翻译成中文'
    },
    {
        code: 'ja',
        name: '日本語',
        flag: '🇯🇵',
        color: 'bg-white border',
        translateText: 'このメッセージを日本語に翻訳'
    },
    {
        code: 'ar',
        name: 'العربية',
        flag: '🇸🇦',
        color: 'bg-green-600',
        translateText: 'ترجمة هذه الرسالة إلى العربية'
    },
];
/**
 * Cache pour améliorer les performances des recherches répétées
 */
const languageCache = new Map();
/**
 * Initialise le cache des langues
 */
function initializeLanguageCache() {
    if (languageCache.size === 0) {
        exports.SUPPORTED_LANGUAGES.forEach(lang => {
            languageCache.set(lang.code, lang);
        });
    }
}
/**
 * Obtient les informations complètes d'une langue par son code
 * Version optimisée avec cache et fallback robuste
 */
function getLanguageInfo(code) {
    // Initialiser le cache si nécessaire
    initializeLanguageCache();
    // Gérer les cas edge
    if (!code || code.trim() === '' || code === 'unknown') {
        return {
            code: 'fr',
            name: 'Français',
            flag: '🇫🇷',
            color: 'bg-blue-500',
            translateText: 'Traduire ce message en français'
        };
    }
    // Normaliser le code (minuscules, trim)
    const normalizedCode = code.toLowerCase().trim();
    // Recherche dans le cache
    const found = languageCache.get(normalizedCode);
    if (found) {
        return found;
    }
    // Fallback: créer un objet pour langues non supportées
    return {
        code: normalizedCode,
        name: normalizedCode.toUpperCase(),
        flag: '🌐',
        color: 'bg-gray-500',
        translateText: `Translate this message to ${normalizedCode}`
    };
}
/**
 * Obtient le nom d'une langue par son code
 */
function getLanguageName(code) {
    const lang = getLanguageInfo(code);
    return lang.name;
}
/**
 * Obtient le drapeau d'une langue par son code
 */
function getLanguageFlag(code) {
    const lang = getLanguageInfo(code);
    return lang.flag;
}
/**
 * Obtient la couleur d'une langue par son code
 */
function getLanguageColor(code) {
    const lang = getLanguageInfo(code);
    return lang.color || 'bg-gray-500';
}
/**
 * Obtient le texte de traduction d'une langue par son code
 */
function getLanguageTranslateText(code) {
    const lang = getLanguageInfo(code);
    return lang.translateText || `Translate this message to ${lang.name}`;
}
/**
 * Vérifie si un code de langue est supporté
 */
function isSupportedLanguage(code) {
    if (!code)
        return false;
    initializeLanguageCache();
    return languageCache.has(code.toLowerCase().trim());
}
/**
 * Obtient tous les codes de langue supportés
 */
function getSupportedLanguageCodes() {
    return exports.SUPPORTED_LANGUAGES.map(lang => lang.code);
}
/**
 * Filtre les langues supportées selon un critère
 */
function filterSupportedLanguages(predicate) {
    return exports.SUPPORTED_LANGUAGES.filter(predicate);
}
// Constants pour compatibilité avec les versions précédentes
exports.MAX_MESSAGE_LENGTH = 300;
exports.TOAST_SHORT_DURATION = 2000;
exports.TOAST_LONG_DURATION = 3000;
exports.TOAST_ERROR_DURATION = 5000;
exports.TYPING_CANCELATION_DELAY = 2000;
//# sourceMappingURL=languages.js.map