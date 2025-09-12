/**
 * Types unifiés pour les participants anonymes Meeshy
 * Harmonisation Gateway ↔ Frontend
 */
import type { ConversationShareLink } from './conversation';
/**
 * Participant anonyme via lien de partage
 */
export interface AnonymousParticipant {
    id: string;
    conversationId: string;
    shareLinkId: string;
    firstName: string;
    lastName: string;
    username: string;
    email?: string;
    sessionToken: string;
    ipAddress?: string;
    country?: string;
    language: string;
    deviceFingerprint?: string;
    isActive: boolean;
    isOnline: boolean;
    lastActiveAt: Date;
    canSendMessages: boolean;
    canSendFiles: boolean;
    canSendImages: boolean;
    joinedAt: Date;
    lastSeenAt: Date;
    leftAt?: Date;
    shareLink?: ConversationShareLink;
}
//# sourceMappingURL=anonymous.d.ts.map