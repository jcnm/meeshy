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
exports.MESSAGE_TYPES = exports.TRANSLATION_MODELS = exports.SUPPORTED_LANGUAGES = void 0;
// ===== ÉVÉNEMENTS SOCKET.IO =====
__exportStar(require("./socketio-events"), exports);
// ===== CONSTANTES =====
exports.SUPPORTED_LANGUAGES = [
    'fr', 'en', 'es', 'de', 'pt', 'zh', 'ja', 'ar', 'it', 'ru'
];
exports.TRANSLATION_MODELS = ['basic', 'medium', 'premium'];
exports.MESSAGE_TYPES = ['text', 'image', 'file', 'system'];
//# sourceMappingURL=index.js.map