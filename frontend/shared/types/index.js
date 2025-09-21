"use strict";
/**
 * Types partagés Meeshy - Index principal
 *
 * Centralise tous les types utilisés à travers l'application
 * Gateway, Frontend, et Translator
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_TYPES = exports.TRANSLATION_MODELS = exports.SUPPORTED_LANGUAGES = exports.DEFAULT_PERMISSIONS = exports.ROLE_HIERARCHY = exports.UserRoleEnum = void 0;
exports.getLanguageInfo = getLanguageInfo;
exports.getLanguageName = getLanguageName;
exports.getLanguageFlag = getLanguageFlag;
exports.getLanguageColor = getLanguageColor;
exports.getLanguageTranslateText = getLanguageTranslateText;
exports.isSupportedLanguage = isSupportedLanguage;
exports.getSupportedLanguageCodes = getSupportedLanguageCodes;
exports.filterSupportedLanguages = filterSupportedLanguages;
// ===== NOUVEAUX TYPES UNIFIÉS =====
// Export des types unifiés Phase 1
__exportStar(require("./conversation"), exports);
__exportStar(require("./user"), exports);
__exportStar(require("./anonymous"), exports);
__exportStar(require("./api-responses"), exports);
__exportStar(require("./migration-utils"), exports);
// Message types are now consolidated
// Export des types unifiés Phase 2 - Messaging
__exportStar(require("./messaging"), exports);
// Export des types unifiés Phase 3 - Affiliate
__exportStar(require("./affiliate"), exports);
// ===== ÉVÉNEMENTS SOCKET.IO =====
__exportStar(require("./socketio-events"), exports);
// ===== ENUM DES RÔLES UNIFORMES =====
var UserRoleEnum;
(function (UserRoleEnum) {
    UserRoleEnum["BIGBOSS"] = "BIGBOSS";
    UserRoleEnum["ADMIN"] = "ADMIN";
    UserRoleEnum["CREATOR"] = "CREATOR";
    UserRoleEnum["MODERATOR"] = "MODERATOR";
    UserRoleEnum["AUDIT"] = "AUDIT";
    UserRoleEnum["ANALYST"] = "ANALYST";
    UserRoleEnum["USER"] = "USER";
    UserRoleEnum["MEMBER"] = "MEMBER";
})(UserRoleEnum || (exports.UserRoleEnum = UserRoleEnum = {}));
// Utilitaires pour les rôles et permissions
exports.ROLE_HIERARCHY = {
    [UserRoleEnum.BIGBOSS]: 7,
    [UserRoleEnum.CREATOR]: 6,
    [UserRoleEnum.ADMIN]: 5,
    [UserRoleEnum.MODERATOR]: 4,
    [UserRoleEnum.AUDIT]: 3,
    [UserRoleEnum.ANALYST]: 2,
    [UserRoleEnum.USER]: 1,
    [UserRoleEnum.MEMBER]: 1,
};
exports.DEFAULT_PERMISSIONS = {
    [UserRoleEnum.BIGBOSS]: {
        canAccessAdmin: true,
        canManageUsers: true,
        canManageGroups: true,
        canManageConversations: true,
        canViewAnalytics: true,
        canModerateContent: true,
        canViewAuditLogs: true,
        canManageNotifications: true,
        canManageTranslations: true,
    },
    [UserRoleEnum.ADMIN]: {
        canAccessAdmin: true,
        canManageUsers: true,
        canManageGroups: true,
        canManageConversations: true,
        canViewAnalytics: true,
        canModerateContent: true,
        canViewAuditLogs: true,
        canManageNotifications: true,
        canManageTranslations: false,
    },
    [UserRoleEnum.CREATOR]: {
        canAccessAdmin: true,
        canManageUsers: true,
        canManageGroups: true,
        canManageConversations: true,
        canViewAnalytics: true,
        canModerateContent: true,
        canViewAuditLogs: true,
        canManageNotifications: true,
        canManageTranslations: false,
    },
    [UserRoleEnum.MODERATOR]: {
        canAccessAdmin: true,
        canManageUsers: false,
        canManageGroups: true,
        canManageConversations: true,
        canViewAnalytics: false,
        canModerateContent: true,
        canViewAuditLogs: false,
        canManageNotifications: false,
        canManageTranslations: false,
    },
    [UserRoleEnum.AUDIT]: {
        canAccessAdmin: true,
        canManageUsers: false,
        canManageGroups: false,
        canManageConversations: false,
        canViewAnalytics: true,
        canModerateContent: false,
        canViewAuditLogs: true,
        canManageNotifications: false,
        canManageTranslations: false,
    },
    [UserRoleEnum.ANALYST]: {
        canAccessAdmin: true,
        canManageUsers: false,
        canManageGroups: false,
        canManageConversations: false,
        canViewAnalytics: true,
        canModerateContent: false,
        canViewAuditLogs: false,
        canManageNotifications: false,
        canManageTranslations: false,
    },
    [UserRoleEnum.USER]: {
        canAccessAdmin: false,
        canManageUsers: false,
        canManageGroups: false,
        canManageConversations: false,
        canViewAnalytics: false,
        canModerateContent: false,
        canViewAuditLogs: false,
        canManageNotifications: false,
        canManageTranslations: false,
    },
    [UserRoleEnum.MEMBER]: {
        canAccessAdmin: false,
        canManageUsers: false,
        canManageGroups: false,
        canManageConversations: false,
        canViewAnalytics: false,
        canModerateContent: false,
        canViewAuditLogs: false,
        canManageNotifications: false,
        canManageTranslations: false,
    },
};
// ===== CONSTANTES =====
// Langues supportées avec définition complète
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
exports.TRANSLATION_MODELS = ['basic', 'medium', 'premium'];
exports.MESSAGE_TYPES = ['text', 'image', 'file', 'system'];
//# sourceMappingURL=index.js.map