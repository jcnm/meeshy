# 📋 PLAN COMPLET - GESTION DES UTILISATEURS (/admin/users)

**Version:** 1.0
**Date:** 2025-01-23
**Auteur:** Expert Fullstack TypeScript
**Niveau de permission:** BIGBOSS & ADMIN uniquement

---

## 📌 OBJECTIF

Implémenter une interface complète de gestion des utilisateurs dans `/admin/users` permettant aux administrateurs (BIGBOSS et ADMIN) de :
- Visualiser tous les utilisateurs avec pagination et filtres avancés
- Modifier les données utilisateur (profil, rôle, permissions)
- Gérer les avatars (upload, changement, suppression)
- Désactiver/Activer des comptes
- Réinitialiser des mots de passe
- Supprimer des utilisateurs (soft delete)
- Audit trail complet de toutes les modifications

---

## 🏗️ ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                    │
├─────────────────────────────────────────────────────────────┤
│  /app/admin/users/                                          │
│  ├── page.tsx                  (Liste utilisateurs)         │
│  ├── [userId]/                                              │
│  │   ├── page.tsx             (Détail utilisateur)          │
│  │   └── edit/page.tsx        (Édition utilisateur)         │
│  └── create/page.tsx           (Création utilisateur)       │
├─────────────────────────────────────────────────────────────┤
│  /components/admin/users/                                   │
│  ├── UserTable.tsx            (Tableau utilisateurs)        │
│  ├── UserFilters.tsx          (Filtres avancés)             │
│  ├── UserDetailView.tsx       (Vue détaillée)               │
│  ├── UserEditForm.tsx         (Formulaire édition)          │
│  ├── UserCreateForm.tsx       (Formulaire création)         │
│  ├── UserAvatarManager.tsx    (Gestion avatar)              │
│  ├── UserRoleSelector.tsx     (Sélecteur de rôle)           │
│  ├── UserPermissionsEditor.tsx (Éditeur permissions)        │
│  └── UserActivityLog.tsx      (Journal d'activité)          │
├─────────────────────────────────────────────────────────────┤
│  /hooks/admin/                                              │
│  ├── useUserManagement.ts     (Hook principal gestion)      │
│  ├── useUserFilters.ts        (Hook filtres)                │
│  ├── useUserPermissions.ts    (Hook permissions)            │
│  └── useAvatarUpload.ts       (Hook upload avatar)          │
├─────────────────────────────────────────────────────────────┤
│  /services/admin/                                           │
│  ├── user-management.service.ts (Service API users)        │
│  └── avatar.service.ts         (Service gestion avatars)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Fastify + Prisma)                │
├─────────────────────────────────────────────────────────────┤
│  /gateway/src/routes/admin/                                 │
│  └── users.ts                  (Routes CRUD users)          │
├─────────────────────────────────────────────────────────────┤
│  /gateway/src/services/admin/                               │
│  ├── user-management.service.ts                             │
│  ├── user-validation.service.ts                             │
│  ├── user-avatar.service.ts                                 │
│  └── user-audit.service.ts                                  │
├─────────────────────────────────────────────────────────────┤
│  /gateway/src/middleware/                                   │
│  ├── admin-auth.middleware.ts  (Auth admin)                 │
│  └── role-check.middleware.ts  (Vérif rôles)                │
├─────────────────────────────────────────────────────────────┤
│  /shared/types/                                             │
│  ├── user.types.ts            (Types utilisateur)           │
│  ├── admin.types.ts           (Types admin)                 │
│  └── validation-schemas.ts     (Schémas Zod)                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   BASE DE DONNÉES (MongoDB)                 │
├─────────────────────────────────────────────────────────────┤
│  Models:                                                    │
│  ├── User (existant - à enrichir)                          │
│  ├── UserAuditLog (nouveau)                                │
│  └── UserSession (existant)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 PHASE 1 : BACKEND - MODÈLES & TYPES

### 1.1 Extension du modèle Prisma User

**Fichier:** `shared/prisma/schema.prisma`

```prisma
model User {
  // ... champs existants ...

  // Nouveaux champs pour gestion admin
  profileCompletionRate  Int      @default(0)  // 0-100%
  emailVerified          Boolean  @default(false)
  emailVerifiedAt        DateTime?
  phoneVerified          Boolean  @default(false)
  phoneVerifiedAt        DateTime?
  twoFactorEnabled       Boolean  @default(false)
  twoFactorSecret        String?
  lastPasswordChange     DateTime @default(now())
  passwordExpiresAt      DateTime?
  failedLoginAttempts    Int      @default(0)
  lockedUntil            DateTime?
  deletedAt              DateTime?  // Soft delete
  deletedBy              String?    @db.ObjectId

  // Relations
  auditLogs              UserAuditLog[]
}

// Nouveau modèle : Journal d'audit
model UserAuditLog {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  userId        String   @db.ObjectId
  adminId       String   @db.ObjectId  // Qui a fait l'action
  action        String   // 'UPDATE_PROFILE', 'CHANGE_ROLE', 'RESET_PASSWORD', etc.
  entity        String   // 'User'
  entityId      String   // ID de l'entité modifiée
  changes       Json?    // Détails des changements (avant/après)
  metadata      Json?    // Métadonnées supplémentaires
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id])
}
```

### 1.2 Types TypeScript partagés

**Fichier:** `shared/types/user.types.ts`

```typescript
// Rôles utilisateur
export enum UserRole {
  USER = 'USER',
  ANALYST = 'ANALYST',
  AUDIT = 'AUDIT',
  MODO = 'MODO',
  ADMIN = 'ADMIN',
  BIGBOSS = 'BIGBOSS'
}

// Permissions granulaires
export interface UserPermissions {
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canManageCommunities: boolean;
  canManageConversations: boolean;
  canViewAnalytics: boolean;
  canModerateContent: boolean;
  canViewAuditLogs: boolean;
  canManageNotifications: boolean;
  canManageTranslations: boolean;
}

// Données utilisateur complètes
export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string;
  email: string;
  phoneNumber: string | null;
  avatar: string | null;
  role: UserRole;
  isActive: boolean;
  isOnline: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastSeen: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
  deletedAt: Date | null;
}

// DTO pour mise à jour utilisateur
export interface UpdateUserDTO {
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  bio?: string;
  email?: string;
  phoneNumber?: string | null;
  avatar?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

// DTO pour création utilisateur
export interface CreateUserDTO {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  displayName?: string;
  bio?: string;
  phoneNumber?: string | null;
  role?: UserRole;
}

// Filtres de recherche
export interface UserFilters {
  search?: string;  // Recherche dans username, email, nom, prénom
  role?: UserRole;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastSeenAfter?: Date;
  sortBy?: 'createdAt' | 'lastSeen' | 'username' | 'email';
  sortOrder?: 'asc' | 'desc';
}

// Réponse paginée
export interface PaginatedUsers {
  users: User[];
  pagination: {
    page: number;
    pageSize: number;
    totalUsers: number;
    totalPages: number;
  };
}

// Actions d'audit
export enum UserAuditAction {
  CREATE_USER = 'CREATE_USER',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  UPDATE_ROLE = 'UPDATE_ROLE',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  RESET_PASSWORD = 'RESET_PASSWORD',
  UPLOAD_AVATAR = 'UPLOAD_AVATAR',
  DELETE_AVATAR = 'DELETE_AVATAR',
  ACTIVATE_USER = 'ACTIVATE_USER',
  DEACTIVATE_USER = 'DEACTIVATE_USER',
  DELETE_USER = 'DELETE_USER',
  RESTORE_USER = 'RESTORE_USER',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  ENABLE_2FA = 'ENABLE_2FA',
  DISABLE_2FA = 'DISABLE_2FA'
}

// Log d'audit
export interface UserAuditLog {
  id: string;
  userId: string;
  adminId: string;
  action: UserAuditAction;
  entity: string;
  entityId: string;
  changes: Record<string, { before: any; after: any }> | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

### 1.3 Schémas de validation Zod

**Fichier:** `shared/validation-schemas/user.schemas.ts`

```typescript
import { z } from 'zod';
import { UserRole } from '../types/user.types';

// Validation username (alphanumérique + underscore, 3-30 chars)
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores');

// Validation email
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must be at most 255 characters');

// Validation password (min 8 chars, 1 majuscule, 1 minuscule, 1 chiffre)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Validation téléphone (format international)
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional()
  .nullable();

// Schéma création utilisateur
export const createUserSchema = z.object({
  username: usernameSchema,
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).default(''),
  phoneNumber: phoneSchema,
  role: z.nativeEnum(UserRole).default(UserRole.USER)
});

// Schéma mise à jour profil utilisateur
export const updateUserProfileSchema = z.object({
  username: usernameSchema.optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().max(100).nullable().optional(),
  bio: z.string().max(500).optional(),
  email: emailSchema.optional(),
  phoneNumber: phoneSchema.optional(),
  avatar: z.string().url().nullable().optional()
});

// Schéma mise à jour rôle (BIGBOSS & ADMIN seulement)
export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole)
});

// Schéma mise à jour statut
export const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});

// Schéma réinitialisation mot de passe
export const resetPasswordSchema = z.object({
  newPassword: passwordSchema
});

// Schéma filtres
export const userFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  lastSeenAfter: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'lastSeen', 'username', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Schéma pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
```

---

## 🎯 PHASE 2 : BACKEND - SERVICES & MIDDLEWARE

### 2.1 Service de gestion des utilisateurs

**Fichier:** `gateway/src/services/admin/user-management.service.ts`

```typescript
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  CreateUserDTO,
  UpdateUserDTO,
  UserFilters,
  PaginatedUsers,
  UserRole,
  UserAuditAction
} from '../../../shared/types/user.types';
import { UserAuditService } from './user-audit.service';

export class UserManagementService {
  constructor(
    private prisma: PrismaClient,
    private auditService: UserAuditService
  ) {}

  /**
   * Récupère tous les utilisateurs avec filtres et pagination
   */
  async getUsers(
    filters: UserFilters,
    page: number,
    pageSize: number
  ): Promise<PaginatedUsers> {
    // Construction de la requête Prisma
    const where: any = {
      deletedAt: null  // Exclure les utilisateurs supprimés
    };

    // Filtres
    if (filters.search) {
      where.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.emailVerified !== undefined) where.emailVerified = filters.emailVerified;
    if (filters.createdAfter) where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
    if (filters.createdBefore) where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
    if (filters.lastSeenAfter) where.lastSeen = { gte: filters.lastSeenAfter };

    // Comptage total
    const totalUsers = await this.prisma.user.count({ where });

    // Récupération paginée
    const users = await this.prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc'
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        displayName: true,
        bio: true,
        email: true,
        phoneNumber: true,
        avatar: true,
        role: true,
        isActive: true,
        isOnline: true,
        emailVerified: true,
        phoneVerified: true,
        twoFactorEnabled: true,
        lastSeen: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
        deactivatedAt: true,
        password: false  // NEVER return password
      }
    });

    return {
      users: users as any,
      pagination: {
        page,
        pageSize,
        totalUsers,
        totalPages: Math.ceil(totalUsers / pageSize)
      }
    };
  }

  /**
   * Récupère un utilisateur par ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: false,  // NEVER return password
        // ... autres champs
      }
    }) as any;
  }

  /**
   * Crée un nouvel utilisateur
   */
  async createUser(data: CreateUserDTO, adminId: string): Promise<User> {
    // Vérifier unicité username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: data.username }
    });
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    // Vérifier unicité email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Création de l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName || `${data.firstName} ${data.lastName}`,
        bio: data.bio || '',
        email: data.email,
        phoneNumber: data.phoneNumber || null,
        password: hashedPassword,
        role: data.role || UserRole.USER,
        isActive: true
      }
    });

    // Audit
    await this.auditService.logAction({
      userId: user.id,
      adminId,
      action: UserAuditAction.CREATE_USER,
      entity: 'User',
      entityId: user.id,
      changes: { created: user }
    });

    return user;
  }

  /**
   * Met à jour un utilisateur
   */
  async updateUser(
    userId: string,
    data: UpdateUserDTO,
    adminId: string
  ): Promise<User> {
    // Récupérer l'utilisateur actuel pour audit
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Vérifier unicité username si changé
    if (data.username && data.username !== currentUser.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: data.username }
      });
      if (existing) {
        throw new Error('Username already exists');
      }
    }

    // Vérifier unicité email si changé
    if (data.email && data.email !== currentUser.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email }
      });
      if (existing) {
        throw new Error('Email already exists');
      }
    }

    // Mise à jour
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    // Audit - calculer les changements
    const changes = this.calculateChanges(currentUser, updatedUser);

    await this.auditService.logAction({
      userId,
      adminId,
      action: UserAuditAction.UPDATE_PROFILE,
      entity: 'User',
      entityId: userId,
      changes
    });

    return updatedUser;
  }

  /**
   * Change le rôle d'un utilisateur (BIGBOSS & ADMIN seulement)
   */
  async changeUserRole(
    userId: string,
    newRole: UserRole,
    adminId: string,
    adminRole: UserRole
  ): Promise<User> {
    // Vérifier permissions admin
    if (adminRole !== UserRole.BIGBOSS && adminRole !== UserRole.ADMIN) {
      throw new Error('Insufficient permissions to change user role');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    // BIGBOSS peut tout changer, ADMIN ne peut pas toucher BIGBOSS
    if (adminRole === UserRole.ADMIN && currentUser.role === UserRole.BIGBOSS) {
      throw new Error('Cannot modify BIGBOSS user role');
    }

    // ADMIN ne peut pas promouvoir en BIGBOSS
    if (adminRole === UserRole.ADMIN && newRole === UserRole.BIGBOSS) {
      throw new Error('Cannot promote user to BIGBOSS');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole }
    });

    await this.auditService.logAction({
      userId,
      adminId,
      action: UserAuditAction.UPDATE_ROLE,
      entity: 'User',
      entityId: userId,
      changes: {
        role: { before: currentUser.role, after: newRole }
      }
    });

    return updatedUser;
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur
   */
  async resetPassword(
    userId: string,
    newPassword: string,
    adminId: string
  ): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        lastPasswordChange: new Date()
      }
    });

    await this.auditService.logAction({
      userId,
      adminId,
      action: UserAuditAction.RESET_PASSWORD,
      entity: 'User',
      entityId: userId,
      changes: null  // Ne pas logger le mot de passe
    });
  }

  /**
   * Active/Désactive un utilisateur
   */
  async toggleUserStatus(
    userId: string,
    isActive: boolean,
    adminId: string
  ): Promise<User> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        deactivatedAt: isActive ? null : new Date()
      }
    });

    await this.auditService.logAction({
      userId,
      adminId,
      action: isActive ? UserAuditAction.ACTIVATE_USER : UserAuditAction.DEACTIVATE_USER,
      entity: 'User',
      entityId: userId,
      changes: {
        isActive: { before: !isActive, after: isActive }
      }
    });

    return updatedUser;
  }

  /**
   * Supprime un utilisateur (soft delete)
   */
  async deleteUser(userId: string, adminId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        deletedBy: adminId,
        isActive: false
      }
    });

    await this.auditService.logAction({
      userId,
      adminId,
      action: UserAuditAction.DELETE_USER,
      entity: 'User',
      entityId: userId,
      changes: null
    });
  }

  /**
   * Calcule les différences entre deux objets utilisateur
   */
  private calculateChanges(before: any, after: any): Record<string, { before: any; after: any }> {
    const changes: Record<string, { before: any; after: any }> = {};
    const keys = Object.keys(after);

    for (const key of keys) {
      if (before[key] !== after[key] && key !== 'password') {
        changes[key] = {
          before: before[key],
          after: after[key]
        };
      }
    }

    return changes;
  }
}
```

### 2.2 Service d'audit

**Fichier:** `gateway/src/services/admin/user-audit.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { UserAuditAction, UserAuditLog } from '../../../shared/types/user.types';

export class UserAuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Enregistre une action d'audit
   */
  async logAction(params: {
    userId: string;
    adminId: string;
    action: UserAuditAction;
    entity: string;
    entityId: string;
    changes: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserAuditLog> {
    const log = await this.prisma.userAuditLog.create({
      data: {
        userId: params.userId,
        adminId: params.adminId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        changes: params.changes || null,
        metadata: null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null
      }
    });

    return log as any;
  }

  /**
   * Récupère l'historique d'audit d'un utilisateur
   */
  async getUserAuditHistory(
    userId: string,
    limit: number = 50
  ): Promise<UserAuditLog[]> {
    const logs = await this.prisma.userAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return logs as any;
  }
}
```

### 2.3 Middleware d'authentification admin

**Fichier:** `gateway/src/middleware/admin-auth.middleware.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '../../shared/types/user.types';

export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = (request as any).user;

  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required'
    });
  }

  // Vérifier si l'utilisateur a un rôle admin
  const allowedRoles = [
    UserRole.BIGBOSS,
    UserRole.ADMIN,
    UserRole.MODO,
    UserRole.AUDIT,
    UserRole.ANALYST
  ];

  if (!allowedRoles.includes(user.role as UserRole)) {
    return reply.status(403).send({
      success: false,
      error: 'Admin access required'
    });
  }
}

export async function requireUserManagementPermission(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = (request as any).user;

  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required'
    });
  }

  // Seuls BIGBOSS et ADMIN peuvent gérer les utilisateurs
  if (user.role !== UserRole.BIGBOSS && user.role !== UserRole.ADMIN) {
    return reply.status(403).send({
      success: false,
      error: 'Insufficient permissions to manage users'
    });
  }
}
```

---

## 🎯 PHASE 3 : BACKEND - ROUTES API

### 3.1 Routes CRUD utilisateurs

**Fichier:** `gateway/src/routes/admin/users.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createUserSchema,
  updateUserProfileSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  resetPasswordSchema,
  userFiltersSchema,
  paginationSchema
} from '../../../shared/validation-schemas/user.schemas';
import { UserManagementService } from '../../services/admin/user-management.service';
import { UserAuditService } from '../../services/admin/user-audit.service';
import { requireUserManagementPermission } from '../../middleware/admin-auth.middleware';

export async function userManagementRoutes(fastify: FastifyInstance) {
  const auditService = new UserAuditService(fastify.prisma);
  const userService = new UserManagementService(fastify.prisma, auditService);

  // GET /admin/users - Liste tous les utilisateurs
  fastify.get('/admin/users', {
    preHandler: [requireUserManagementPermission]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = userFiltersSchema.parse(request.query);
      const pagination = paginationSchema.parse(request.query);

      const result = await userService.getUsers(
        filters,
        pagination.page,
        pagination.pageSize
      );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /admin/users/:userId - Détails d'un utilisateur
  fastify.get<{ Params: { userId: string } }>('/admin/users/:userId', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const user = await userService.getUserById(request.params.userId);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      return reply.send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /admin/users - Créer un utilisateur
  fastify.post('/admin/users', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const data = createUserSchema.parse(request.body);
      const adminId = (request as any).user.id;

      const user = await userService.createUser(data, adminId);

      return reply.status(201).send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PATCH /admin/users/:userId - Mettre à jour un utilisateur
  fastify.patch<{ Params: { userId: string } }>('/admin/users/:userId', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const data = updateUserProfileSchema.parse(request.body);
      const adminId = (request as any).user.id;

      const user = await userService.updateUser(
        request.params.userId,
        data,
        adminId
      );

      return reply.send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PATCH /admin/users/:userId/role - Changer le rôle
  fastify.patch<{ Params: { userId: string } }>('/admin/users/:userId/role', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const { role } = updateUserRoleSchema.parse(request.body);
      const adminId = (request as any).user.id;
      const adminRole = (request as any).user.role;

      const user = await userService.changeUserRole(
        request.params.userId,
        role,
        adminId,
        adminRole
      );

      return reply.send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.status(403).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PATCH /admin/users/:userId/status - Activer/Désactiver
  fastify.patch<{ Params: { userId: string } }>('/admin/users/:userId/status', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const { isActive } = updateUserStatusSchema.parse(request.body);
      const adminId = (request as any).user.id;

      const user = await userService.toggleUserStatus(
        request.params.userId,
        isActive,
        adminId
      );

      return reply.send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /admin/users/:userId/reset-password - Réinitialiser mot de passe
  fastify.post<{ Params: { userId: string } }>('/admin/users/:userId/reset-password', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const { newPassword } = resetPasswordSchema.parse(request.body);
      const adminId = (request as any).user.id;

      await userService.resetPassword(
        request.params.userId,
        newPassword,
        adminId
      );

      return reply.send({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DELETE /admin/users/:userId - Supprimer un utilisateur (soft)
  fastify.delete<{ Params: { userId: string } }>('/admin/users/:userId', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const adminId = (request as any).user.id;

      await userService.deleteUser(request.params.userId, adminId);

      return reply.send({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /admin/users/:userId/audit - Historique d'audit
  fastify.get<{ Params: { userId: string } }>('/admin/users/:userId/audit', {
    preHandler: [requireUserManagementPermission]
  }, async (request, reply) => {
    try {
      const logs = await auditService.getUserAuditHistory(request.params.userId);

      return reply.send({
        success: true,
        data: logs
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
```

---

## 🎯 PHASE 4 : FRONTEND - SERVICES

### 4.1 Service API utilisateurs

**Fichier:** `frontend/services/admin/user-management.service.ts`

```typescript
import { apiClient } from '@/lib/api-client';
import {
  User,
  CreateUserDTO,
  UpdateUserDTO,
  UserFilters,
  PaginatedUsers,
  UserRole,
  UserAuditLog
} from '@/types/user.types';

export class UserManagementService {
  /**
   * Récupère la liste des utilisateurs
   */
  static async getUsers(
    filters: UserFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedUsers> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...filters
    } as any);

    const response = await apiClient.get(`/admin/users?${params}`);
    return response.data;
  }

  /**
   * Récupère un utilisateur par ID
   */
  static async getUserById(userId: string): Promise<User> {
    const response = await apiClient.get(`/admin/users/${userId}`);
    return response.data;
  }

  /**
   * Crée un nouvel utilisateur
   */
  static async createUser(data: CreateUserDTO): Promise<User> {
    const response = await apiClient.post('/admin/users', data);
    return response.data;
  }

  /**
   * Met à jour un utilisateur
   */
  static async updateUser(userId: string, data: UpdateUserDTO): Promise<User> {
    const response = await apiClient.patch(`/admin/users/${userId}`, data);
    return response.data;
  }

  /**
   * Change le rôle d'un utilisateur
   */
  static async changeUserRole(userId: string, role: UserRole): Promise<User> {
    const response = await apiClient.patch(`/admin/users/${userId}/role`, { role });
    return response.data;
  }

  /**
   * Active/Désactive un utilisateur
   */
  static async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    const response = await apiClient.patch(`/admin/users/${userId}/status`, { isActive });
    return response.data;
  }

  /**
   * Réinitialise le mot de passe
   */
  static async resetPassword(userId: string, newPassword: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/reset-password`, { newPassword });
  }

  /**
   * Supprime un utilisateur
   */
  static async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}`);
  }

  /**
   * Récupère l'historique d'audit
   */
  static async getUserAuditHistory(userId: string): Promise<UserAuditLog[]> {
    const response = await apiClient.get(`/admin/users/${userId}/audit`);
    return response.data;
  }

  /**
   * Upload un avatar
   */
  static async uploadAvatar(userId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await apiClient.post(
      `/admin/users/${userId}/avatar`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return response.data.avatarUrl;
  }

  /**
   * Supprime un avatar
   */
  static async deleteAvatar(userId: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}/avatar`);
  }
}
```

---

## 🎯 PHASE 5 : FRONTEND - HOOKS

### 5.1 Hook principal de gestion utilisateurs

**Fichier:** `frontend/hooks/admin/useUserManagement.ts`

```typescript
import { useState, useCallback } from 'react';
import { UserManagementService } from '@/services/admin/user-management.service';
import {
  User,
  CreateUserDTO,
  UpdateUserDTO,
  UserFilters,
  PaginatedUsers,
  UserRole
} from '@/types/user.types';
import { toast } from 'sonner';

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalUsers: 0,
    totalPages: 0
  });

  /**
   * Charge les utilisateurs
   */
  const loadUsers = useCallback(async (
    filters: UserFilters,
    page: number = 1
  ) => {
    try {
      setLoading(true);
      const result = await UserManagementService.getUsers(filters, page, pagination.pageSize);
      setUsers(result.users);
      setPagination(result.pagination);
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize]);

  /**
   * Crée un utilisateur
   */
  const createUser = useCallback(async (data: CreateUserDTO) => {
    try {
      const newUser = await UserManagementService.createUser(data);
      toast.success('Utilisateur créé avec succès');
      return newUser;
    } catch (error) {
      toast.error('Erreur lors de la création');
      throw error;
    }
  }, []);

  /**
   * Met à jour un utilisateur
   */
  const updateUser = useCallback(async (userId: string, data: UpdateUserDTO) => {
    try {
      const updatedUser = await UserManagementService.updateUser(userId, data);
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      toast.success('Utilisateur mis à jour');
      return updatedUser;
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
      throw error;
    }
  }, []);

  /**
   * Change le rôle
   */
  const changeRole = useCallback(async (userId: string, role: UserRole) => {
    try {
      const updatedUser = await UserManagementService.changeUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      toast.success('Rôle modifié');
      return updatedUser;
    } catch (error) {
      toast.error('Erreur lors du changement de rôle');
      throw error;
    }
  }, []);

  /**
   * Active/Désactive
   */
  const toggleStatus = useCallback(async (userId: string, isActive: boolean) => {
    try {
      const updatedUser = await UserManagementService.toggleUserStatus(userId, isActive);
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      toast.success(isActive ? 'Utilisateur activé' : 'Utilisateur désactivé');
      return updatedUser;
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
      throw error;
    }
  }, []);

  /**
   * Réinitialise le mot de passe
   */
  const resetPassword = useCallback(async (userId: string, newPassword: string) => {
    try {
      await UserManagementService.resetPassword(userId, newPassword);
      toast.success('Mot de passe réinitialisé');
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation');
      throw error;
    }
  }, []);

  /**
   * Supprime un utilisateur
   */
  const deleteUser = useCallback(async (userId: string) => {
    try {
      await UserManagementService.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('Utilisateur supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      throw error;
    }
  }, []);

  return {
    users,
    loading,
    pagination,
    loadUsers,
    createUser,
    updateUser,
    changeRole,
    toggleStatus,
    resetPassword,
    deleteUser
  };
}
```

---

## 🎯 PHASE 6 : FRONTEND - COMPOSANTS

### 6.1 Tableau des utilisateurs

**Fichier:** `frontend/components/admin/users/UserTable.tsx`

```typescript
'use client';

import React from 'react';
import { User, UserRole } from '@/types/user.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Edit,
  Trash2,
  UserX,
  UserCheck,
  Key
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserTableProps {
  users: User[];
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onResetPassword: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UserTable({
  users,
  onView,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete
}: UserTableProps) {
  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.BIGBOSS: return 'destructive';
      case UserRole.ADMIN: return 'default';
      case UserRole.MODO: return 'secondary';
      case UserRole.AUDIT: return 'outline';
      case UserRole.ANALYST: return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Utilisateur
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Rôle
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Statut
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Dernière activité
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              {/* Utilisateur */}
              <td className="px-4 py-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.displayName || user.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {(user.displayName || user.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {user.displayName || `${user.firstName} ${user.lastName}`}
                    </div>
                    <div className="text-sm text-gray-500">@{user.username}</div>
                  </div>
                </div>
              </td>

              {/* Email */}
              <td className="px-4 py-4">
                <div className="text-sm text-gray-900">{user.email}</div>
                {user.emailVerified && (
                  <Badge variant="outline" className="mt-1 text-xs text-green-600">
                    Vérifié
                  </Badge>
                )}
              </td>

              {/* Rôle */}
              <td className="px-4 py-4">
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role}
                </Badge>
              </td>

              {/* Statut */}
              <td className="px-4 py-4">
                <div className="flex items-center space-x-2">
                  <Badge variant={user.isActive ? 'default' : 'secondary'}>
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                  {user.isOnline && (
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  )}
                </div>
              </td>

              {/* Dernière activité */}
              <td className="px-4 py-4 text-sm text-gray-600">
                {formatDistanceToNow(new Date(user.lastSeen), {
                  addSuffix: true,
                  locale: fr
                })}
              </td>

              {/* Actions */}
              <td className="px-4 py-4">
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(user)}
                    title="Voir détails"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(user)}
                    title="Modifier"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleStatus(user)}
                    title={user.isActive ? 'Désactiver' : 'Activer'}
                  >
                    {user.isActive ? (
                      <UserX className="h-4 w-4 text-orange-600" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onResetPassword(user)}
                    title="Réinitialiser mot de passe"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(user)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 🎯 PHASES SUIVANTES (Résumé)

### Phase 7 : Composants de filtres et recherche
### Phase 8 : Formulaires de création/édition
### Phase 9 : Gestion des avatars
### Phase 10 : Vues détaillées et audit
### Phase 11 : Tests unitaires et E2E
### Phase 12 : Documentation et déploiement

---

## 📊 RÉCAPITULATIF DES FICHIERS À CRÉER/MODIFIER

### Backend (Gateway)
- ✅ `shared/prisma/schema.prisma` (extension modèle User + UserAuditLog)
- ✅ `shared/types/user.types.ts` (types complets)
- ✅ `shared/validation-schemas/user.schemas.ts` (schémas Zod)
- ✅ `gateway/src/services/admin/user-management.service.ts`
- ✅ `gateway/src/services/admin/user-audit.service.ts`
- ✅ `gateway/src/middleware/admin-auth.middleware.ts`
- ✅ `gateway/src/routes/admin/users.ts`

### Frontend
- ✅ `frontend/services/admin/user-management.service.ts`
- ✅ `frontend/hooks/admin/useUserManagement.ts`
- ✅ `frontend/components/admin/users/UserTable.tsx`
- 🔄 `frontend/components/admin/users/UserFilters.tsx` (à créer)
- 🔄 `frontend/components/admin/users/UserEditForm.tsx` (à créer)
- 🔄 `frontend/components/admin/users/UserCreateForm.tsx` (à créer)
- 🔄 `frontend/app/admin/users/page.tsx` (à compléter)
- 🔄 `frontend/app/admin/users/[userId]/page.tsx` (à créer)
- 🔄 `frontend/app/admin/users/[userId]/edit/page.tsx` (à créer)
- 🔄 `frontend/app/admin/users/create/page.tsx` (à créer)

---

## 🔒 SÉCURITÉ & BONNES PRATIQUES

1. **Authentication & Authorization**
   - Middleware strict sur toutes les routes admin
   - Vérification des permissions par rôle
   - BIGBOSS a tous les droits
   - ADMIN ne peut pas toucher BIGBOSS

2. **Validation des données**
   - Schémas Zod côté backend ET frontend
   - Validation stricte des emails, usernames, passwords
   - Sanitization des entrées utilisateur

3. **Audit Trail**
   - Toutes les actions sont loggées
   - Informations IP et User-Agent
   - Historique avant/après pour chaque modification

4. **Protection des données sensibles**
   - Le mot de passe n'est JAMAIS retourné dans les réponses API
   - Hash bcrypt avec salt rounds = 12
   - Soft delete pour conserver l'historique

5. **Rate Limiting** (à implémenter)
   - Limiter les tentatives de création/modification
   - Protection contre les abus

---

## 📝 PROCHAINES ÉTAPES

**Pour commencer l'implémentation :**

1. **Créer la branche de travail**
   ```bash
   git checkout -b feature/admin-user-management
   ```

2. **Appliquer les migrations Prisma**
   ```bash
   cd shared/prisma
   npx prisma migrate dev --name add_user_audit
   npx prisma generate
   ```

3. **Implémenter phase par phase** dans l'ordre suivant :
   - Phase 1 : Types et schémas
   - Phase 2 : Services backend
   - Phase 3 : Routes API
   - Phase 4 : Services frontend
   - Phase 5 : Hooks
   - Phase 6 : Composants

4. **Tester au fur et à mesure** :
   - Tests unitaires pour chaque service
   - Tests d'intégration pour les routes API
   - Tests E2E pour l'interface admin

---

## ✅ CRITÈRES DE SUCCÈS

- [ ] BIGBOSS et ADMIN peuvent gérer tous les utilisateurs
- [ ] Les autres rôles ne peuvent pas accéder à la gestion
- [ ] Tous les champs sont éditables (sauf ID)
- [ ] Les avatars peuvent être uploadés, changés, supprimés
- [ ] Les mots de passe peuvent être réinitialisés
- [ ] Les comptes peuvent être activés/désactivés
- [ ] Les utilisateurs peuvent être supprimés (soft delete)
- [ ] Tout est audité et tracé
- [ ] L'interface est responsive et intuitive
- [ ] Les performances sont optimales (pagination, cache)
- [ ] La sécurité est maximale (auth, validation, sanitization)
- [ ] Le code est typé à 100% (TypeScript strict)
- [ ] Les tests couvrent > 80% du code
- [ ] La documentation est complète

---

**FIN DU PLAN - Version 1.0**
