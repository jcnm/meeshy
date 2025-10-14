"use strict";
/**
 * Types pour le système de tracking de liens
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.URL_REGEX = exports.TRACKING_LINK_REGEX = exports.TRACKING_LINK_BASE_URL = exports.TRACKING_LINK_TOKEN_LENGTH = void 0;
// ============================================================================
// Constantes
// ============================================================================
exports.TRACKING_LINK_TOKEN_LENGTH = 6;
exports.TRACKING_LINK_BASE_URL = 'meeshy.me/l/';
exports.TRACKING_LINK_REGEX = /https?:\/\/(?:www\.)?meeshy\.me\/l\/([a-zA-Z0-9]{6})/g;
exports.URL_REGEX = /(https?:\/\/[^\s]+)/g;
//# sourceMappingURL=tracking-link.js.map