import { Injectable } from '@nestjs/common';
import { UserRole, UserPermissions, User } from '../shared/interfaces';

@Injectable()
export class PermissionsService {
  private readonly ROLE_HIERARCHY: Record<UserRole, number> = {
    BIGBOSS: 6,
    ADMIN: 5,
    MODO: 4,
    AUDIT: 3,
    ANALYST: 2,
    USER: 1,
  };

  private readonly DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
    BIGBOSS: {
      canAccessAdmin: true,
      canManageUsers: true,
      canManageGroups: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canViewAuditLogs: true,
      canManageNotifications: true,
      canManageTranslations: true,
    },
    ADMIN: {
      canAccessAdmin: true,
      canManageUsers: true,
      canManageGroups: true,
      canManageConversations: true,
      canViewAnalytics: true,
      canModerateContent: true,
      canViewAuditLogs: true,
      canManageNotifications: true,
      canManageTranslations: false,
    },
    MODO: {
      canAccessAdmin: true,
      canManageUsers: false,
      canManageGroups: true,
      canManageConversations: true,
      canViewAnalytics: false,
      canModerateContent: true,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    AUDIT: {
      canAccessAdmin: true,
      canManageUsers: false,
      canManageGroups: false,
      canManageConversations: false,
      canViewAnalytics: true,
      canModerateContent: false,
      canViewAuditLogs: true,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    ANALYST: {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageGroups: false,
      canManageConversations: false,
      canViewAnalytics: true,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
    USER: {
      canAccessAdmin: false,
      canManageUsers: false,
      canManageGroups: false,
      canManageConversations: false,
      canViewAnalytics: false,
      canModerateContent: false,
      canViewAuditLogs: false,
      canManageNotifications: false,
      canManageTranslations: false,
    },
  };

  /**
   * Obtient les permissions par défaut pour un rôle
   */
  getDefaultPermissions(role: UserRole): UserPermissions {
    return { ...this.DEFAULT_PERMISSIONS[role] };
  }

  /**
   * Vérifie si un utilisateur a une permission spécifique
   */
  hasPermission(user: User, permission: keyof UserPermissions): boolean {
    const permissions = user.permissions || this.getRolePermissions(user.role);
    return permissions[permission] === true;
  }

  /**
   * Vérifie si un utilisateur peut accéder à l'administration
   */
  canAccessAdmin(user: User): boolean {
    return this.hasPermission(user, 'canAccessAdmin');
  }

  /**
   * Vérifie si un utilisateur a un rôle spécifique ou supérieur
   */
  hasRoleOrHigher(user: User, requiredRole: UserRole): boolean {
    const userLevel = this.ROLE_HIERARCHY[user.role];
    const requiredLevel = this.ROLE_HIERARCHY[requiredRole];
    return userLevel >= requiredLevel;
  }

  /**
   * Vérifie si un utilisateur peut gérer un autre utilisateur
   */
  canManageUser(manager: User, target: User): boolean {
    // Ne peut pas se gérer soi-même pour certaines actions critiques
    if (manager.id === target.id) return false;

    // Vérifie les permissions de base
    if (!this.hasPermission(manager, 'canManageUsers')) return false;

    // Vérifie la hiérarchie des rôles
    const managerLevel = this.ROLE_HIERARCHY[manager.role];
    const targetLevel = this.ROLE_HIERARCHY[target.role];
    
    return managerLevel > targetLevel;
  }

  /**
   * Vérifie si un rôle peut être assigné par un utilisateur
   */
  canAssignRole(manager: User, targetRole: UserRole): boolean {
    if (!this.hasPermission(manager, 'canManageUsers')) return false;

    const managerLevel = this.ROLE_HIERARCHY[manager.role];
    const targetLevel = this.ROLE_HIERARCHY[targetRole];

    // Ne peut assigner que des rôles inférieurs au sien
    return managerLevel > targetLevel;
  }

  /**
   * Obtient la liste des rôles qu'un utilisateur peut assigner
   */
  getAssignableRoles(manager: User): UserRole[] {
    if (!this.hasPermission(manager, 'canManageUsers')) return [];

    const managerLevel = this.ROLE_HIERARCHY[manager.role];
    
    return Object.entries(this.ROLE_HIERARCHY)
      .filter(([, level]) => level < managerLevel)
      .map(([role]) => role as UserRole)
      .sort((a, b) => this.ROLE_HIERARCHY[b] - this.ROLE_HIERARCHY[a]);
  }

  /**
   * Valide si des permissions sont cohérentes avec un rôle
   */
  validatePermissions(role: UserRole, permissions: UserPermissions): boolean {
    const defaultPermissions = this.getDefaultPermissions(role);
    
    // Vérifie qu'aucune permission accordée ne dépasse celles du rôle
    for (const [key, value] of Object.entries(permissions)) {
      if (value && !defaultPermissions[key as keyof UserPermissions]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Met à jour les permissions d'un utilisateur selon son nouveau rôle
   */
  updateUserPermissions(user: User, newRole: UserRole): User {
    const newPermissions = this.getDefaultPermissions(newRole);
    
    return {
      ...user,
      role: newRole,
      permissions: newPermissions,
    };
  }

  /**
   * Vérifie si un utilisateur peut effectuer une action spécifique
   */
  canPerformAction(
    user: User, 
    action: string, 
    context?: { 
      targetUserId?: string; 
      groupId?: string; 
      conversationId?: string; 
    }
  ): boolean {
    switch (action) {
      case 'access_admin':
        return this.canAccessAdmin(user);
      
      case 'manage_user':
        if (!context?.targetUserId) return false;
        return this.hasPermission(user, 'canManageUsers');
      
      case 'delete_conversation':
        return this.hasPermission(user, 'canManageConversations') || 
               this.hasRoleOrHigher(user, 'MODO');
      
      case 'ban_user':
        return this.hasPermission(user, 'canModerateContent') && 
               this.hasRoleOrHigher(user, 'MODO');
      
      case 'view_analytics':
        return this.hasPermission(user, 'canViewAnalytics');
      
      case 'view_audit_logs':
        return this.hasPermission(user, 'canViewAuditLogs');
      
      default:
        return false;
    }
  }

  /**
   * Obtient un résumé des capacités d'un utilisateur
   */
  getUserCapabilities(user: User): {
    role: string;
    level: number;
    permissions: string[];
    restrictions: string[];
  } {
    const permissions: string[] = [];
    const restrictions: string[] = [];
    const userPermissions = user.permissions || this.getRolePermissions(user.role);

    // Analyse des permissions
    if (userPermissions.canAccessAdmin) permissions.push('Accès administration');
    if (userPermissions.canManageUsers) permissions.push('Gestion utilisateurs');
    if (userPermissions.canManageGroups) permissions.push('Gestion groupes');
    if (userPermissions.canModerateContent) permissions.push('Modération contenu');
    if (userPermissions.canViewAnalytics) permissions.push('Accès analyses');
    if (userPermissions.canViewAuditLogs) permissions.push('Logs d\'audit');

    // Restrictions
    if (!userPermissions.canManageUsers) restrictions.push('Gestion utilisateurs interdite');
    if (!userPermissions.canAccessAdmin) restrictions.push('Administration interdite');
    if (!userPermissions.canViewAnalytics) restrictions.push('Analyses interdites');

    return {
      role: this.getRoleDisplayName(user.role),
      level: this.ROLE_HIERARCHY[user.role],
      permissions,
      restrictions,
    };
  }

  /**
   * Obtient le nom d'affichage d'un rôle
   */
  private getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      BIGBOSS: 'Super Administrateur',
      ADMIN: 'Administrateur',
      MODO: 'Modérateur',
      AUDIT: 'Auditeur',
      ANALYST: 'Analyste',
      USER: 'Utilisateur',
    };

    return roleNames[role];
  }

  /**
   * Obtient les permissions pour un rôle donné
   */
  getRolePermissions(role: UserRole): UserPermissions {
    const level = this.ROLE_HIERARCHY[role];

    return {
      canAccessAdmin: level >= this.ROLE_HIERARCHY['AUDIT'],
      canManageUsers: level >= this.ROLE_HIERARCHY['ADMIN'],
      canManageGroups: level >= this.ROLE_HIERARCHY['MODO'],
      canManageConversations: level >= this.ROLE_HIERARCHY['MODO'],
      canViewAnalytics: level >= this.ROLE_HIERARCHY['ANALYST'],
      canModerateContent: level >= this.ROLE_HIERARCHY['MODO'],
      canViewAuditLogs: level >= this.ROLE_HIERARCHY['AUDIT'],
      canManageNotifications: level >= this.ROLE_HIERARCHY['ADMIN'],
      canManageTranslations: level >= this.ROLE_HIERARCHY['ADMIN'],
    };
  }
}
