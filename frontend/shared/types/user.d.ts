/**
 * Types unifiés pour les utilisateurs Meeshy
 * Harmonisation Gateway ↔ Frontend
 */
/**
 * Rôles utilisateur
 */
export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR' | 'BIGBOSS' | 'CREATOR' | 'AUDIT' | 'ANALYST' | 'MEMBER';
/**
 * Permissions utilisateur
 */
export interface UserPermissions {
    canAccessAdmin: boolean;
    canManageUsers: boolean;
    canManageGroups: boolean;
    canManageConversations: boolean;
    canViewAnalytics: boolean;
    canModerateContent: boolean;
    canViewAuditLogs: boolean;
    canManageNotifications: boolean;
    canManageTranslations: boolean;
}
/**
 * DÉPRÉCIÉ : L'interface User a été supprimée
 * Utilisez SocketIOUser depuis socketio-events.ts à la place
 * @deprecated Utilisez SocketIOUser pour éviter la redondance
 */
/**
 * Alias pour SocketIOUser - Type principal recommandé
 * Utilisez ce type pour tous les nouveaux développements
 */
export type { SocketIOUser as UserUnified, SocketIOUser as User } from './socketio-events';
/**
 * Configuration des langues utilisateur
 */
export interface UserLanguageConfig {
    systemLanguage: string;
    regionalLanguage: string;
    customDestinationLanguage?: string;
    autoTranslateEnabled: boolean;
    translateToSystemLanguage: boolean;
    translateToRegionalLanguage: boolean;
    useCustomDestination: boolean;
}
/**
 * Statistiques utilisateur
 */
export interface UserStats {
    id: string;
    userId: string;
    messagesSent: number;
    messagesReceived: number;
    charactersTyped: number;
    imageMessagesSent: number;
    filesShared: number;
    conversationsJoined: number;
    communitiesCreated: number;
    friendsAdded: number;
    friendRequestsSent: number;
    translationsUsed: number;
    languagesDetected: number;
    autoTranslateTimeMinutes: number;
    totalOnlineTimeMinutes: number;
    sessionCount: number;
    lastActiveAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Préférences utilisateur
 */
export interface UserPreference {
    id: string;
    userId: string;
    key: string;
    value: string;
    valueType: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=user.d.ts.map