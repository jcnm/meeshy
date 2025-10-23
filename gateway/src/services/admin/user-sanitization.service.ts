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
