"use strict";
/**
 * Types unifiés pour les événements Socket.IO Meeshy
 * Remplace les anciens types WebSocket pour correspondre à la nouvelle architecture Socket.IO
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_EVENTS = exports.SERVER_EVENTS = void 0;
// ===== CONSTANTES D'ÉVÉNEMENTS =====
// Événements du serveur vers le client
exports.SERVER_EVENTS = {
    MESSAGE_NEW: 'message:new',
    MESSAGE_EDITED: 'message:edited',
    MESSAGE_DELETED: 'message:deleted',
    MESSAGE_TRANSLATION: 'message:translation',
    MESSAGE_TRANSLATED: 'message_translated',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    USER_STATUS: 'user:status',
    CONVERSATION_JOINED: 'conversation:joined',
    CONVERSATION_LEFT: 'conversation:left',
    AUTHENTICATED: 'authenticated',
    MESSAGE_SENT: 'message_sent',
    ERROR: 'error',
    TRANSLATION_RECEIVED: 'translation_received',
    TRANSLATION_ERROR: 'translation_error',
    NOTIFICATION: 'notification',
    SYSTEM_MESSAGE: 'system_message',
    CONVERSATION_STATS: 'conversation:stats',
    CONVERSATION_ONLINE_STATS: 'conversation:online_stats'
};
// Événements du client vers le serveur
exports.CLIENT_EVENTS = {
    MESSAGE_SEND: 'message:send',
    MESSAGE_EDIT: 'message:edit',
    MESSAGE_DELETE: 'message:delete',
    CONVERSATION_JOIN: 'conversation:join',
    CONVERSATION_LEAVE: 'conversation:leave',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    USER_STATUS: 'user:status',
    AUTHENTICATE: 'authenticate',
    REQUEST_TRANSLATION: 'request_translation'
};
//# sourceMappingURL=socketio-events.js.map