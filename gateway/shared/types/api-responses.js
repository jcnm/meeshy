"use strict";
/**
 * Types unifiés pour les réponses API Meeshy
 * Harmonisation Gateway ↔ Frontend - WebSocket et REST
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSuccessResponse = isSuccessResponse;
exports.isErrorResponse = isErrorResponse;
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
/**
 * Type guard pour vérifier si une réponse est un succès
 */
function isSuccessResponse(response) {
    return response.success === true && response.data !== undefined;
}
/**
 * Type guard pour vérifier si une réponse est une erreur
 */
function isErrorResponse(response) {
    return response.success === false && response.error !== undefined;
}
/**
 * Utilitaire pour créer une réponse de succès
 */
function createSuccessResponse(data, meta) {
    return {
        success: true,
        data,
        meta
    };
}
/**
 * Utilitaire pour créer une réponse d'erreur
 */
function createErrorResponse(error, code, meta) {
    return {
        success: false,
        error,
        code,
        meta
    };
}
//# sourceMappingURL=api-responses.js.map