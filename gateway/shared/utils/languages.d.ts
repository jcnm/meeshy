/**
 * Utilitaires unifiés pour la gestion des langues dans Meeshy
 * Module partagé entre Gateway, Frontend, et Translator
 */
/**
 * Interface complète pour une langue supportée
 */
export interface SupportedLanguageInfo {
    code: string;
    name: string;
    flag: string;
    color?: string;
    translateText?: string;
}
/**
 * Liste complète des langues supportées avec toutes les propriétés
 * Fusion de toutes les versions existantes pour préserver la plus longue liste
 */
export declare const SUPPORTED_LANGUAGES: SupportedLanguageInfo[];
/**
 * Type pour les codes de langue supportés
 */
export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];
/**
 * Obtient les informations complètes d'une langue par son code
 * Version optimisée avec cache et fallback robuste
 */
export declare function getLanguageInfo(code: string | undefined): SupportedLanguageInfo;
/**
 * Obtient le nom d'une langue par son code
 */
export declare function getLanguageName(code: string | undefined): string;
/**
 * Obtient le drapeau d'une langue par son code
 */
export declare function getLanguageFlag(code: string | undefined): string;
/**
 * Obtient la couleur d'une langue par son code
 */
export declare function getLanguageColor(code: string | undefined): string;
/**
 * Obtient le texte de traduction d'une langue par son code
 */
export declare function getLanguageTranslateText(code: string | undefined): string;
/**
 * Vérifie si un code de langue est supporté
 */
export declare function isSupportedLanguage(code: string | undefined): boolean;
/**
 * Obtient tous les codes de langue supportés
 */
export declare function getSupportedLanguageCodes(): string[];
/**
 * Filtre les langues supportées selon un critère
 */
export declare function filterSupportedLanguages(predicate: (lang: SupportedLanguageInfo) => boolean): SupportedLanguageInfo[];
/**
 * Interface pour les statistiques de langues (compatibilité)
 */
export interface LanguageStats {
    language: string;
    flag: string;
    count: number;
    color: string;
}
export declare const MAX_MESSAGE_LENGTH = 300;
export declare const TOAST_SHORT_DURATION = 2000;
export declare const TOAST_LONG_DURATION = 3000;
export declare const TOAST_ERROR_DURATION = 5000;
export declare const TYPING_CANCELATION_DELAY = 2000;
//# sourceMappingURL=languages.d.ts.map