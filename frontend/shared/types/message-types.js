"use strict";
/**
* Types de messages unifiés pour Meeshy
* Architecture simplifiée avec 2 types principaux :
* 1. GatewayMessage - Messages retournés par la Gateway
* 2. UIMessage - Messages avec détails visuels pour BubbleMessage
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatewayToUIMessage = gatewayToUIMessage;
exports.addTranslatingState = addTranslatingState;
exports.updateTranslationResult = updateTranslationResult;
exports.getDisplayContent = getDisplayContent;
exports.isTranslating = isTranslating;
exports.hasTranslation = hasTranslation;
// ===== UTILITAIRES DE CONVERSION =====
/**
 * Convertit un GatewayMessage en UIMessage
 */
function gatewayToUIMessage(gatewayMessage, userLanguage, userPermissions) {
    // Convertir les traductions Gateway en états UI
    const uiTranslations = gatewayMessage.translations.map(t => ({
        language: t.targetLanguage,
        content: t.translatedContent,
        status: 'completed',
        timestamp: t.createdAt,
        confidence: t.confidenceScore,
        model: t.translationModel,
        fromCache: t.cached
    }));
    return {
        ...gatewayMessage,
        uiTranslations,
        translatingLanguages: new Set(),
        currentDisplayLanguage: userLanguage,
        showingOriginal: gatewayMessage.originalLanguage === userLanguage,
        originalContent: gatewayMessage.content,
        canEdit: userPermissions?.canEdit ?? false,
        canDelete: userPermissions?.canDelete ?? false,
        canTranslate: userPermissions?.canTranslate ?? true,
        canReply: userPermissions?.canReply ?? true
    };
}
/**
 * Ajoute un état de traduction en cours à un UIMessage
 */
function addTranslatingState(message, targetLanguage) {
    const translatingLanguages = new Set(message.translatingLanguages);
    translatingLanguages.add(targetLanguage);
    // Ajouter ou mettre à jour l'état UI
    const uiTranslations = [...message.uiTranslations];
    const existingIndex = uiTranslations.findIndex(t => t.language === targetLanguage);
    if (existingIndex >= 0) {
        uiTranslations[existingIndex] = {
            ...uiTranslations[existingIndex],
            status: 'translating'
        };
    }
    else {
        uiTranslations.push({
            language: targetLanguage,
            content: '',
            status: 'translating',
            timestamp: new Date(),
            fromCache: false
        });
    }
    return {
        ...message,
        translatingLanguages,
        uiTranslations
    };
}
/**
 * Met à jour le résultat d'une traduction dans un UIMessage
 */
function updateTranslationResult(message, targetLanguage, result) {
    const translatingLanguages = new Set(message.translatingLanguages);
    translatingLanguages.delete(targetLanguage);
    const uiTranslations = message.uiTranslations.map(t => t.language === targetLanguage
        ? {
            ...t,
            content: result.content || t.content,
            status: result.status,
            error: result.error,
            confidence: result.confidence,
            model: result.model,
            fromCache: result.fromCache ?? false,
            timestamp: new Date()
        }
        : t);
    return {
        ...message,
        translatingLanguages,
        uiTranslations
    };
}
/**
 * Obtient le contenu à afficher selon la langue
 */
function getDisplayContent(message) {
    if (message.showingOriginal) {
        return message.originalContent;
    }
    const translation = message.uiTranslations.find(t => t.language === message.currentDisplayLanguage && t.status === 'completed');
    return translation?.content || message.originalContent;
}
/**
 * Vérifie si une traduction est en cours pour une langue
 */
function isTranslating(message, targetLanguage) {
    return message.translatingLanguages.has(targetLanguage);
}
/**
 * Vérifie si une traduction est disponible pour une langue
 */
function hasTranslation(message, targetLanguage) {
    return message.uiTranslations.some(t => t.language === targetLanguage && t.status === 'completed');
}
//# sourceMappingURL=message-types.js.map