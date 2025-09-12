/**
 * Utilitaires de migration pour les types unifiés
 * Facilite la transition vers les nouveaux types Phase 1
 */
import type { Message, Conversation } from './conversation';
import type { SocketIOUser as User } from './socketio-events';
import type { AnonymousParticipant } from './anonymous';
import type { ApiResponse } from './api-responses';
import type { SocketIOUser } from './socketio-events';
/**
 * Convertit un SocketIOUser vers User unifié
 */
export declare function socketIOUserToUser(socketUser: SocketIOUser): User;
/**
 * Vérifie si un ID est un ObjectId MongoDB valide
 */
export declare function isValidObjectId(id: string): boolean;
/**
 * Extrait l'ObjectId d'un objet conversation pour les API
 */
export declare function getApiConversationId(conversation: any): string;
/**
 * Extrait l'identifier d'affichage d'une conversation
 */
export declare function getDisplayConversationId(conversation: any): string;
/**
 * Crée une réponse API de succès
 */
export declare function createApiSuccessResponse<T>(data: T, meta?: any): ApiResponse<T>;
/**
 * Crée une réponse API d'erreur
 */
export declare function createApiErrorResponse(error: string, code?: string): ApiResponse<never>;
/**
 * Type guard pour vérifier si c'est un utilisateur authentifié
 */
export declare function isAuthenticatedUser(sender: User | AnonymousParticipant | undefined): sender is User;
/**
 * Type guard pour vérifier si c'est un participant anonyme
 */
export declare function isAnonymousParticipant(sender: User | AnonymousParticipant | undefined): sender is AnonymousParticipant;
/**
 * Normalise un message depuis différentes sources
 * Assure la synchronisation entre createdAt et timestamp
 */
export declare function normalizeMessage(rawMessage: any): Message;
/**
 * Normalise une conversation depuis différentes sources
 * Assure la synchronisation entre les alias de champs
 */
export declare function normalizeConversation(rawConversation: any): Conversation;
//# sourceMappingURL=migration-utils.d.ts.map