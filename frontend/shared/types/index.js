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
// ===== NOUVEAUX TYPES UNIFIÉS =====
// Export des types unifiés Phase 1
__exportStar(require("./conversation"), exports);
__exportStar(require("./user"), exports);
__exportStar(require("./anonymous"), exports);
__exportStar(require("./api-responses"), exports);
__exportStar(require("./migration-utils"), exports);
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
exports.SUPPORTED_LANGUAGES = [
    { code: 'auto', name: 'Détection automatique', flag: '🔍' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
];
exports.TRANSLATION_MODELS = ['basic', 'medium', 'premium'];
exports.MESSAGE_TYPES = ['text', 'image', 'file', 'system'];
//# sourceMappingURL=index.js.map