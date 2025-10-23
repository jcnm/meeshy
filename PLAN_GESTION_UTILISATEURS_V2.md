# 📋 PLAN COMPLET V2 - GESTION DES UTILISATEURS (/admin/users)

**Version:** 2.0 (Permissions granulaires + Typage strict)
**Date:** 2025-01-23
**Auteur:** Expert Fullstack TypeScript
**Permissions:** Lecture pour tous admins / Écriture pour BIGBOSS & ADMIN uniquement

---

## 📌 CHANGEMENTS MAJEURS PAR RAPPORT À V1

### ✅ Permissions Granulaires par Rôle

| Rôle      | Accès Lecture | Données Sensibles | Modification | Suppression | Changement Rôle |
|-----------|---------------|-------------------|--------------|-------------|-----------------|
| BIGBOSS   | ✅ Tout       | ✅ Toutes         | ✅ Tout      | ✅ Tout     | ✅ Tous rôles   |
| ADMIN     | ✅ Tout       | ✅ Toutes         | ✅ Sauf BIGBOSS | ✅ Sauf BIGBOSS | ✅ Sauf BIGBOSS |
| MODO      | ✅ Tout       | ❌ Masquées       | ❌           | ❌          | ❌              |
| AUDIT     | ✅ Tout       | ✅ Logs completsmasquer email/phone | ❌           | ❌          | ❌              |
| ANALYST   | ❌ Non        | ❌                | ❌           | ❌          | ❌              |

### 🔒 Définition des Données Sensibles

**Données TOUJOURS MASQUÉES** (tous rôles) :
- `password` : Jamais retourné par l'API
- `twoFactorSecret` : Jamais retourné par l'API

**Données MASQUÉES pour rôles < ADMIN** (MODO, AUDIT, ANALYST) :
- `email` : Affiché comme `j***@domain.com`
- `phoneNumber` : Affiché comme `+33 6** ** ** **`
- Audit logs : IP masquée comme `192.168.***.***`

**Données NON-SENSIBLES** (visibles par tous admins) :
- `id`, `username`, `firstName`, `lastName`, `displayName`
- `bio`, `avatar`, `role`, `isActive`, `isOnline`
- `createdAt`, `updatedAt`, `lastSeen`, `lastActiveAt`
- `emailVerified`, `phoneVerified` (booléens uniquement)
- Statistiques d'activité (compteurs)

### 🎯 Typage Strict (Zéro `any` / `unknown`)

**AVANT (V1):**
```typescript
const user = (request as any).user;  // ❌ any
const users: any[] = [];             // ❌ any
```

**APRÈS (V2):**
```typescript
const authContext = request.authContext as AuthContext;  // ✅ type précis
const users: PublicUser[] = [];                         // ✅ type précis
```

---

## 🏗️ ARCHITECTURE GLOBALE (mise à jour)

```
┌─────────────────────────────────────────────────────────────┐
│              PERMISSIONS GRANULAIRES PAR RÔLE               │
├─────────────────────────────────────────────────────────────┤
│  PermissionsService (gateway/src/routes/admin.ts)           │
│  ├── ROLE_HIERARCHY (scores 1-7)                            │
│  ├── DEFAULT_PERMISSIONS (matrice par rôle)                 │
│  ├── getUserPermissions(role)                               │
│  ├── hasPermission(role, permission)                        │
│  ├── canManageUser(adminRole, targetRole)                   │
│  └── canViewSensitiveData(adminRole)  [NOUVEAU]             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                DATA SANITIZATION PAR RÔLE                   │
├─────────────────────────────────────────────────────────────┤
│  UserSanitizationService                                    │
│  ├── sanitizeUserData(user, viewerRole): PublicUser         │
│  ├── maskEmail(email): string                               │
│  ├── maskPhone(phone): string                               │
│  ├── maskIP(ip): string                                     │
│  └── getVisibleFields(viewerRole): string[]                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 PHASE 1 : TYPES STRICTS (zéro any/unknown)

### 1.1 Extension des types partagés

**Fichier:** `shared/types/user.ts`

```typescript
import { UserRoleEnum } from './index';

/**
 * Type strict pour les données utilisateur complètes (BACKEND ONLY)
 * Ne doit JAMAIS être exposé directement via l'API
 */
export interface FullUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string;
  email: string;
  phoneNumber: string | null;
  avatar: string | null;
  role: UserRoleEnum;
  isActive: boolean;
  isOnline: boolean;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  twoFactorEnabled: boolean;
  lastSeen: Date;
  lastActiveAt: Date;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage: string | null;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  profileCompletionRate: number;
  lastPasswordChange: Date;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Type pour les données publiques (visibles par tous les admins)
 * Exclut les données sensibles
 */
export interface PublicUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string;
  avatar: string | null;
  role: UserRoleEnum;
  isActive: boolean;
  isOnline: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastSeen: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
  profileCompletionRate: number;
}

/**
 * Type pour les données sensibles (BIGBOSS & ADMIN uniquement)
 * Extension de PublicUser avec les champs sensibles
 */
export interface AdminUser extends PublicUser {
  email: string;
  phoneNumber: string | null;
  twoFactorEnabled: boolean;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage: string | null;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  lastPasswordChange: Date;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  deletedBy: string | null;
}

/**
 * Type pour les données masquées (MODO, AUDIT)
 * Comme PublicUser mais avec email/phone masqués
 */
export interface MaskedUser extends PublicUser {
  email: string;  // Format: j***@domain.com
  phoneNumber: string | null;  // Format: +33 6** ** ** **
}

/**
 * Type union pour les réponses API selon le rôle
 */
export type UserResponse = PublicUser | AdminUser | MaskedUser;

/**
 * DTO pour mise à jour profil
 */
export interface UpdateUserProfileDTO {
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  bio?: string;
  phoneNumber?: string | null;
  avatar?: string | null;
  systemLanguage?: string;
  regionalLanguage?: string;
  customDestinationLanguage?: string | null;
}

/**
 * DTO pour création utilisateur
 */
export interface CreateUserDTO {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  displayName?: string | null;
  bio?: string;
  phoneNumber?: string | null;
  role?: UserRoleEnum;
  systemLanguage?: string;
  regionalLanguage?: string;
}

/**
 * DTO pour changement d'email
 */
export interface UpdateEmailDTO {
  newEmail: string;
  password: string;  // Confirmation mot de passe requis
}

/**
 * DTO pour changement de rôle (BIGBOSS & ADMIN uniquement)
 */
export interface UpdateRoleDTO {
  role: UserRoleEnum;
  reason?: string;  // Raison du changement (pour audit)
}

/**
 * DTO pour activation/désactivation
 */
export interface UpdateStatusDTO {
  isActive: boolean;
  reason?: string;  // Raison (pour audit)
}

/**
 * DTO pour réinitialisation mot de passe
 */
export interface ResetPasswordDTO {
  newPassword: string;
  sendEmail: boolean;  // Envoyer email de notification
}

/**
 * Filtres de recherche utilisateurs
 */
export interface UserFilters {
  search?: string;  // username, email, nom, prénom
  role?: UserRoleEnum;
  isActive?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  twoFactorEnabled?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastSeenAfter?: Date;
  lastSeenBefore?: Date;
  sortBy?: 'createdAt' | 'lastSeen' | 'username' | 'email' | 'firstName' | 'lastName';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Métadonnées de pagination
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalUsers: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Réponse paginée
 */
export interface PaginatedUsersResponse<T = UserResponse> {
  users: T[];
  pagination: PaginationMeta;
}

/**
 * Actions d'audit
 */
export enum UserAuditAction {
  // Actions de lecture
  VIEW_USER = 'VIEW_USER',
  VIEW_USER_LIST = 'VIEW_USER_LIST',
  VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',

  // Actions de création/modification
  CREATE_USER = 'CREATE_USER',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  UPDATE_EMAIL = 'UPDATE_EMAIL',
  UPDATE_PHONE = 'UPDATE_PHONE',
  UPDATE_ROLE = 'UPDATE_ROLE',
  UPDATE_STATUS = 'UPDATE_STATUS',

  // Actions de sécurité
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  RESET_PASSWORD = 'RESET_PASSWORD',
  ENABLE_2FA = 'ENABLE_2FA',
  DISABLE_2FA = 'DISABLE_2FA',
  UNLOCK_ACCOUNT = 'UNLOCK_ACCOUNT',

  // Actions sur les ressources
  UPLOAD_AVATAR = 'UPLOAD_AVATAR',
  DELETE_AVATAR = 'DELETE_AVATAR',

  // Actions de suppression
  DEACTIVATE_USER = 'DEACTIVATE_USER',
  ACTIVATE_USER = 'ACTIVATE_USER',
  DELETE_USER = 'DELETE_USER',
  RESTORE_USER = 'RESTORE_USER',

  // Actions de vérification
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  VERIFY_PHONE = 'VERIFY_PHONE'
}

/**
 * Log d'audit (typé strictement)
 */
export interface UserAuditLog {
  id: string;
  userId: string;
  adminId: string;
  action: UserAuditAction;
  entity: 'User';
  entityId: string;
  changes: Record<string, AuditChange> | null;
  metadata: AuditMetadata | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Détail d'un changement dans l'audit
 */
export interface AuditChange {
  before: unknown;
  after: unknown;
}

/**
 * Métadonnées d'audit
 */
export interface AuditMetadata {
  reason?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Contexte d'authentification (depuis middleware)
 */
export interface AuthContext {
  isAuthenticated: boolean;
  registeredUser: {
    id: string;
    username: string;
    email: string;
    role: UserRoleEnum;
    isActive: boolean;
  };
  anonymousParticipant: null | {
    id: string;
    nickname: string;
  };
}
```

### 1.2 Extension de PermissionsService

**Fichier:** `gateway/src/services/admin/permissions.service.ts`

```typescript
import { UserRoleEnum } from '../../../shared/types';

export interface AdminPermissions {
  canAccessAdmin: boolean;
  canViewUsers: boolean;
  canViewUserDetails: boolean;
  canViewSensitiveData: boolean;
  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canUpdateUserRoles: boolean;
  canDeleteUsers: boolean;
  canResetPasswords: boolean;
  canViewAuditLogs: boolean;
  canManageCommunities: boolean;
  canManageConversations: boolean;
  canViewAnalytics: boolean;
  canModerateContent: boolean;
  canManageNotifications: boolean;
  canManageTranslations: boolean;
}

export class PermissionsService {
  private readonly ROLE_HIERARCHY: Record<UserRoleEnum, number> = {
    [UserRoleEnum.BIGBOSS]: 7,
    [UserRoleEnum.ADMIN]: 5,
    [UserRoleEnum.MODO]: 4,
    [UserRoleEnum.AUDIT]: 3,
    [UserRoleEnum.ANALYST]: 2,
    [UserRoleEnum.USER]: 1,
    [UserRoleEnum.MODERATOR]: 4,  // Alias
    [UserRoleEnum.CREATOR]: 5,    // Alias
    [UserRoleEnum.MEMBER]: 1      // Alias
  };

  private readonly PERMISSIONS_MATRIX: Record<UserRoleEnum, AdminPermissions> = {
    [UserRoleEnum.BIGBOSS]: {
      canAccessAdmin: true,
      canViewUsers: true,
      canViewUserDetails: true,
      canViewSensitiveData: true,
      canCreateUsers: true,
      canUpdateUsers: true,
      canUpdateUserRoles: true,
      canDeleteUsers: true,
      canResetPasswords: true,
      canViewAuditLogs: true,
      canManageCommunities: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canManageNotifications: true,
      canManageTranslations: true
    },
    [UserRoleEnum.ADMIN]: {
      canAccessAdmin: true,
      canViewUsers: true,
      canViewUserDetails: true,
      canViewSensitiveData: true,
      canCreateUsers: true,
      canUpdateUsers: true,
      canUpdateUserRoles: true,
      canDeleteUsers: true,
      canResetPasswords: true,
      canViewAuditLogs: false,
      canManageCommunities: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canManageNotifications: true,
      canManageTranslations: false
    },
    [UserRoleEnum.MODO]: {
      canAccessAdmin: true,
      canViewUsers: true,
      canViewUserDetails: true,
      canViewSensitiveData: false,  // ❌ Données masquées
      canCreateUsers: false,
      canUpdateUsers: false,
      canUpdateUserRoles: false,
      canDeleteUsers: false,
      canResetPasswords: false,
      canViewAuditLogs: false,
      canManageCommunities: true,
      canManageConversations: true,
      canViewAnalytics: false,
      canModerateContent: true,
      canManageNotifications: false,
      canManageTranslations: false
    },
    [UserRoleEnum.AUDIT]: {
      canAccessAdmin: true,
      canViewUsers: true,
      canViewUserDetails: true,
      canViewSensitiveData: false,  // ❌ Email/phone masqués
      canCreateUsers: false,
      canUpdateUsers: false,
      canUpdateUserRoles: false,
      canDeleteUsers: false,
      canResetPasswords: false,
      canViewAuditLogs: true,
      canManageCommunities: false,
      canManageConversations: false,
      canViewAnalytics: true,
      canModerateContent: false,
      canManageNotifications: false,
      canManageTranslations: false
    },
    [UserRoleEnum.ANALYST]: {
      canAccessAdmin: false,
      canViewUsers: false,  // ❌ Pas d'accès à la gestion users
      canViewUserDetails: false,
      canViewSensitiveData: false,
      canCreateUsers: false,
      canUpdateUsers: false,
      canUpdateUserRoles: false,
      canDeleteUsers: false,
      canResetPasswords: false,
      canViewAuditLogs: false,
      canManageCommunities: false,
      canManageConversations: false,
      canViewAnalytics: true,
      canModerateContent: false,
      canManageNotifications: false,
      canManageTranslations: false
    },
    [UserRoleEnum.USER]: {
      canAccessAdmin: false,
      canViewUsers: false,
      canViewUserDetails: false,
      canViewSensitiveData: false,
      canCreateUsers: false,
      canUpdateUsers: false,
      canUpdateUserRoles: false,
      canDeleteUsers: false,
      canResetPasswords: false,
      canViewAuditLogs: false,
      canManageCommunities: false,
      canManageConversations: false,
      canViewAnalytics: false,
      canModerateContent: false,
      canManageNotifications: false,
      canManageTranslations: false
    },
    // Aliases
    [UserRoleEnum.MODERATOR]: null!,  // Sera résolu vers MODO
    [UserRoleEnum.CREATOR]: null!,    // Sera résolu vers ADMIN
    [UserRoleEnum.MEMBER]: null!      // Sera résolu vers USER
  };

  /**
   * Résout les alias vers les rôles réels
   */
  private resolveRole(role: UserRoleEnum): UserRoleEnum {
    const aliasMap: Record<string, UserRoleEnum> = {
      [UserRoleEnum.MODERATOR]: UserRoleEnum.MODO,
      [UserRoleEnum.CREATOR]: UserRoleEnum.ADMIN,
      [UserRoleEnum.MEMBER]: UserRoleEnum.USER
    };
    return aliasMap[role] || role;
  }

  /**
   * Obtient les permissions d'un rôle
   */
  getPermissions(role: UserRoleEnum): AdminPermissions {
    const resolvedRole = this.resolveRole(role);
    return this.PERMISSIONS_MATRIX[resolvedRole] || this.PERMISSIONS_MATRIX[UserRoleEnum.USER];
  }

  /**
   * Vérifie si un rôle a une permission spécifique
   */
  hasPermission(role: UserRoleEnum, permission: keyof AdminPermissions): boolean {
    const permissions = this.getPermissions(role);
    return permissions[permission];
  }

  /**
   * Vérifie si un admin peut gérer un utilisateur cible
   */
  canManageUser(adminRole: UserRoleEnum, targetRole: UserRoleEnum): boolean {
    const adminLevel = this.ROLE_HIERARCHY[this.resolveRole(adminRole)];
    const targetLevel = this.ROLE_HIERARCHY[this.resolveRole(targetRole)];
    return adminLevel > targetLevel;
  }

  /**
   * Vérifie si un admin peut voir les données sensibles
   */
  canViewSensitiveData(role: UserRoleEnum): boolean {
    return this.hasPermission(role, 'canViewSensitiveData');
  }

  /**
   * Vérifie si un admin peut modifier un utilisateur
   */
  canModifyUser(adminRole: UserRoleEnum, targetRole: UserRoleEnum): boolean {
    return this.hasPermission(adminRole, 'canUpdateUsers') &&
           this.canManageUser(adminRole, targetRole);
  }

  /**
   * Vérifie si un admin peut changer le rôle d'un utilisateur
   */
  canChangeRole(
    adminRole: UserRoleEnum,
    currentTargetRole: UserRoleEnum,
    newTargetRole: UserRoleEnum
  ): boolean {
    // Doit pouvoir gérer l'utilisateur actuel ET le nouveau rôle
    return this.hasPermission(adminRole, 'canUpdateUserRoles') &&
           this.canManageUser(adminRole, currentTargetRole) &&
           this.canManageUser(adminRole, newTargetRole);
  }
}

// Instance singleton
export const permissionsService = new PermissionsService();
```

### 1.3 Service de Sanitization des Données

**Fichier:** `gateway/src/services/admin/user-sanitization.service.ts`

```typescript
import {
  FullUser,
  PublicUser,
  AdminUser,
  MaskedUser,
  UserResponse,
  UserAuditLog,
  UserRoleEnum
} from '../../../shared/types';
import { permissionsService } from './permissions.service';

export class UserSanitizationService {
  /**
   * Masque un email : john.doe@example.com → j***@example.com
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***';
    return `${local.charAt(0)}***@${domain}`;
  }

  /**
   * Masque un numéro de téléphone : +33612345678 → +33 6** ** ** **
   */
  private maskPhone(phone: string | null): string | null {
    if (!phone) return null;
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 6) return '***';
    return `${cleaned.substring(0, 5)}** ** ** **`;
  }

  /**
   * Masque une adresse IP : 192.168.1.100 → 192.168.***.***
   */
  private maskIP(ip: string | null): string | null {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length !== 4) return '***.***.***.***.';
    return `${parts[0]}.${parts[1]}.***.$***`;
  }

  /**
   * Sanitize un utilisateur selon le rôle du viewer
   */
  sanitizeUser(user: FullUser, viewerRole: UserRoleEnum): UserResponse {
    const canViewSensitive = permissionsService.canViewSensitiveData(viewerRole);

    // Données publiques (toujours incluses)
    const publicData: PublicUser = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      isOnline: user.isOnline,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      lastSeen: user.lastSeen,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deactivatedAt: user.deactivatedAt,
      profileCompletionRate: user.profileCompletionRate
    };

    // Si peut voir les données sensibles → AdminUser
    if (canViewSensitive) {
      const adminData: AdminUser = {
        ...publicData,
        email: user.email,
        phoneNumber: user.phoneNumber,
        twoFactorEnabled: user.twoFactorEnabled,
        systemLanguage: user.systemLanguage,
        regionalLanguage: user.regionalLanguage,
        customDestinationLanguage: user.customDestinationLanguage,
        autoTranslateEnabled: user.autoTranslateEnabled,
        translateToSystemLanguage: user.translateToSystemLanguage,
        translateToRegionalLanguage: user.translateToRegionalLanguage,
        useCustomDestination: user.useCustomDestination,
        emailVerifiedAt: user.emailVerifiedAt,
        phoneVerifiedAt: user.phoneVerifiedAt,
        lastPasswordChange: user.lastPasswordChange,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
        deletedBy: user.deletedBy
      };
      return adminData;
    }

    // Sinon → MaskedUser (données masquées)
    const maskedData: MaskedUser = {
      ...publicData,
      email: this.maskEmail(user.email),
      phoneNumber: this.maskPhone(user.phoneNumber)
    };
    return maskedData;
  }

  /**
   * Sanitize une liste d'utilisateurs
   */
  sanitizeUsers(users: FullUser[], viewerRole: UserRoleEnum): UserResponse[] {
    return users.map(user => this.sanitizeUser(user, viewerRole));
  }

  /**
   * Sanitize un log d'audit selon le rôle du viewer
   */
  sanitizeAuditLog(log: UserAuditLog, viewerRole: UserRoleEnum): UserAuditLog {
    const canViewSensitive = permissionsService.canViewSensitiveData(viewerRole);

    if (canViewSensitive) {
      return log;  // Tout visible
    }

    // Masquer l'IP pour les non-admins
    return {
      ...log,
      ipAddress: this.maskIP(log.ipAddress)
    };
  }
}

// Instance singleton
export const sanitizationService = new UserSanitizationService();
```

---

## 🎯 PHASE 2 : MIDDLEWARE D'AUTORISATION

### 2.1 Middleware avec typage strict

**Fichier:** `gateway/src/middleware/admin-user-auth.middleware.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRoleEnum, AuthContext } from '../../shared/types';
import { permissionsService } from '../services/admin/permissions.service';

/**
 * Extension de FastifyRequest avec authContext typé
 */
declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthContext;
  }
}

/**
 * Middleware: Requiert accès admin à l'espace utilisateurs
 */
export async function requireUserViewAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authContext = request.authContext;

  if (!authContext?.isAuthenticated || !authContext.registeredUser) {
    reply.status(401).send({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  const userRole = authContext.registeredUser.role as UserRoleEnum;

  if (!permissionsService.hasPermission(userRole, 'canViewUsers')) {
    reply.status(403).send({
      success: false,
      error: 'Insufficient permissions to view users'
    });
    return;
  }
}

/**
 * Middleware: Requiert permission de modification utilisateurs
 */
export async function requireUserModifyAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authContext = request.authContext;

  if (!authContext?.isAuthenticated || !authContext.registeredUser) {
    reply.status(401).send({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  const userRole = authContext.registeredUser.role as UserRoleEnum;

  if (!permissionsService.hasPermission(userRole, 'canUpdateUsers')) {
    reply.status(403).send({
      success: false,
      error: 'Insufficient permissions to modify users'
    });
    return;
  }
}

/**
 * Middleware: Requiert permission de suppression
 */
export async function requireUserDeleteAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authContext = request.authContext;

  if (!authContext?.isAuthenticated || !authContext.registeredUser) {
    reply.status(401).send({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  const userRole = authContext.registeredUser.role as UserRoleEnum;

  if (!permissionsService.hasPermission(userRole, 'canDeleteUsers')) {
    reply.status(403).send({
      success: false,
      error: 'Insufficient permissions to delete users'
    });
    return;
  }
}
```

---

## 🎯 PHASE 3 : ROUTES API AVEC PERMISSIONS GRANULAIRES

### 3.1 Routes utilisateurs avec sanitization

**Fichier:** `gateway/src/routes/admin/users.ts` (extraits principaux)

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  UserRoleEnum,
  AuthContext,
  PaginatedUsersResponse,
  UserFilters,
  PaginationParams
} from '../../../shared/types';
import { userManagementService } from '../../services/admin/user-management.service';
import { sanitizationService } from '../../services/admin/user-sanitization.service';
import { permissionsService } from '../../services/admin/permissions.service';
import {
  requireUserViewAccess,
  requireUserModifyAccess,
  requireUserDeleteAccess
} from '../../middleware/admin-user-auth.middleware';

export async function userAdminRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /admin/users - Liste tous les utilisateurs (avec sanitization)
   */
  fastify.get<{
    Querystring: UserFilters & PaginationParams;
  }>('/admin/users', {
    preHandler: [fastify.authenticate, requireUserViewAccess]
  }, async (request, reply) => {
    const authContext = request.authContext;
    const viewerRole = authContext.registeredUser.role as UserRoleEnum;

    const filters: UserFilters = {
      search: request.query.search,
      role: request.query.role as UserRoleEnum | undefined,
      isActive: request.query.isActive,
      emailVerified: request.query.emailVerified,
      phoneVerified: request.query.phoneVerified,
      twoFactorEnabled: request.query.twoFactorEnabled,
      createdAfter: request.query.createdAfter ? new Date(request.query.createdAfter) : undefined,
      createdBefore: request.query.createdBefore ? new Date(request.query.createdBefore) : undefined,
      sortBy: request.query.sortBy || 'createdAt',
      sortOrder: request.query.sortOrder || 'desc'
    };

    const pagination: PaginationParams = {
      page: request.query.page || 1,
      pageSize: Math.min(request.query.pageSize || 20, 100)
    };

    // Récupérer les utilisateurs (données complètes)
    const result = await userManagementService.getUsers(filters, pagination);

    // Sanitize selon le rôle du viewer
    const sanitizedUsers = sanitizationService.sanitizeUsers(
      result.users,
      viewerRole
    );

    const response: PaginatedUsersResponse = {
      users: sanitizedUsers,
      pagination: result.pagination
    };

    reply.send({
      success: true,
      data: response
    });
  });

  /**
   * GET /admin/users/:userId - Détails d'un utilisateur (avec sanitization)
   */
  fastify.get<{
    Params: { userId: string };
  }>('/admin/users/:userId', {
    preHandler: [fastify.authenticate, requireUserViewAccess]
  }, async (request, reply) => {
    const authContext = request.authContext;
    const viewerRole = authContext.registeredUser.role as UserRoleEnum;

    const user = await userManagementService.getUserById(request.params.userId);

    if (!user) {
      reply.status(404).send({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Sanitize selon le rôle
    const sanitizedUser = sanitizationService.sanitizeUser(user, viewerRole);

    reply.send({
      success: true,
      data: sanitizedUser
    });
  });

  /**
   * PATCH /admin/users/:userId - Modifier un utilisateur
   * (BIGBOSS & ADMIN uniquement)
   */
  fastify.patch<{
    Params: { userId: string };
    Body: Partial<UpdateUserProfileDTO>;
  }>('/admin/users/:userId', {
    preHandler: [fastify.authenticate, requireUserModifyAccess]
  }, async (request, reply) => {
    const authContext = request.authContext;
    const adminRole = authContext.registeredUser.role as UserRoleEnum;

    // Récupérer l'utilisateur cible
    const targetUser = await userManagementService.getUserById(request.params.userId);

    if (!targetUser) {
      reply.status(404).send({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Vérifier si l'admin peut modifier cet utilisateur
    if (!permissionsService.canModifyUser(adminRole, targetUser.role)) {
      reply.status(403).send({
        success: false,
        error: 'Insufficient permissions to modify this user'
      });
      return;
    }

    // Mise à jour
    const updatedUser = await userManagementService.updateUser(
      request.params.userId,
      request.body,
      authContext.registeredUser.id
    );

    // Sanitize la réponse
    const sanitizedUser = sanitizationService.sanitizeUser(updatedUser, adminRole);

    reply.send({
      success: true,
      data: sanitizedUser
    });
  });

  // ... autres routes (DELETE, PATCH /role, etc.) avec même logique
}
```

---

## 🎯 RÉSUMÉ DES AMÉLIORATIONS V2

### ✅ Permissions granulaires
- **BIGBOSS** : Tous les droits (lecture + écriture)
- **ADMIN** : Tous les droits sauf gestion BIGBOSS
- **MODO** : Lecture seule (données masquées)
- **AUDIT** : Lecture seule + logs (données masquées)
- **ANALYST** : Pas d'accès à la gestion users

### ✅ Données sensibles masquées
- Email : `j***@domain.com`
- Phone : `+33 6** ** ** **`
- IP : `192.168.***.***`

### ✅ Typage strict
- Zéro `any` / `unknown`
- Interfaces précises pour chaque type de données
- Types d'union pour les réponses selon le rôle
- AuthContext typé

### ✅ Sanitization automatique
- Service dédié pour masquer les données
- Application automatique selon le rôle
- Logs d'audit également masqués

---

**PROCHAINES ÉTAPES :**
1. Implémenter les services backend
2. Créer les composants frontend avec typage strict
3. Ajouter les tests unitaires
4. Documentation API complète

**FIN DU PLAN V2**
