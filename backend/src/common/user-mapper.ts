import { User, UserRole } from '../shared/interfaces';
import { PermissionsService } from './permissions.service';

/**
 * Type représentant un utilisateur tel que retourné par Prisma
 */
export interface PrismaUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string;
  phoneNumber: string | null;
  avatar: string | null;
  systemLanguage: string;
  regionalLanguage: string;
  customDestinationLanguage: string | null;
  autoTranslateEnabled: boolean;
  translateToSystemLanguage: boolean;
  translateToRegionalLanguage: boolean;
  useCustomDestination: boolean;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  lastActiveAt: Date;
  role: string;
  isActive: boolean;
  deactivatedAt: Date | null;
  updatedAt?: Date;
}

/**
 * Convertit un utilisateur Prisma en interface User
 * Gère la conversion des types null vers undefined
 */
export function mapPrismaUser(prismaUser: PrismaUser, permissionsService?: PermissionsService): User {
  const user: User = {
    id: prismaUser.id,
    username: prismaUser.username,
    firstName: prismaUser.firstName,
    lastName: prismaUser.lastName,
    displayName: prismaUser.displayName || undefined,
    email: prismaUser.email,
    phoneNumber: prismaUser.phoneNumber || undefined,
    avatar: prismaUser.avatar || undefined,
    systemLanguage: prismaUser.systemLanguage,
    regionalLanguage: prismaUser.regionalLanguage,
    customDestinationLanguage: prismaUser.customDestinationLanguage || undefined,
    autoTranslateEnabled: prismaUser.autoTranslateEnabled,
    translateToSystemLanguage: prismaUser.translateToSystemLanguage,
    translateToRegionalLanguage: prismaUser.translateToRegionalLanguage,
    useCustomDestination: prismaUser.useCustomDestination,
    isOnline: prismaUser.isOnline,
    lastSeen: prismaUser.lastSeen || undefined,
    createdAt: prismaUser.createdAt,
    lastActiveAt: prismaUser.lastActiveAt,
    role: prismaUser.role as UserRole, // Cast nécessaire car UserRole est un type strict
    isActive: prismaUser.isActive,
    deactivatedAt: prismaUser.deactivatedAt || undefined,
  };

  // Ajouter les permissions si le service est fourni
  if (permissionsService) {
    user.permissions = permissionsService.getRolePermissions(user.role);
  }

  return user;
}
