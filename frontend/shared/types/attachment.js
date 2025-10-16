"use strict";
/**
 * Types pour le système d'attachements de messages
 * Partagés entre frontend et backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCEPTED_MIME_TYPES = exports.UPLOAD_LIMITS = void 0;
exports.getAttachmentType = getAttachmentType;
exports.getSizeLimit = getSizeLimit;
exports.formatFileSize = formatFileSize;
// Constantes pour les limites de taille
exports.UPLOAD_LIMITS = {
    IMAGE: 52428800, // 50MB
    DOCUMENT: 104857600, // 100MB
    AUDIO: 104857600, // 100MB
    VIDEO: 104857600, // 100MB
    TEXT: 10485760, // 10MB
};
// Types MIME acceptés
exports.ACCEPTED_MIME_TYPES = {
    IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT: [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    AUDIO: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
    VIDEO: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    TEXT: ['text/plain'],
};
/**
 * Détermine le type d'attachement basé sur le MIME type
 */
function getAttachmentType(mimeType) {
    if (exports.ACCEPTED_MIME_TYPES.IMAGE.includes(mimeType)) {
        return 'image';
    }
    if (exports.ACCEPTED_MIME_TYPES.AUDIO.includes(mimeType)) {
        return 'audio';
    }
    if (exports.ACCEPTED_MIME_TYPES.VIDEO.includes(mimeType)) {
        return 'video';
    }
    if (exports.ACCEPTED_MIME_TYPES.TEXT.includes(mimeType)) {
        return 'text';
    }
    return 'document';
}
/**
 * Obtient la limite de taille pour un type d'attachement
 */
function getSizeLimit(type) {
    switch (type) {
        case 'image':
            return exports.UPLOAD_LIMITS.IMAGE;
        case 'text':
            return exports.UPLOAD_LIMITS.TEXT;
        default:
            return exports.UPLOAD_LIMITS.DOCUMENT;
    }
}
/**
 * Formate une taille de fichier pour l'affichage
 */
function formatFileSize(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
//# sourceMappingURL=attachment.js.map