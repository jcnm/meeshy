import { UserRole, UserPermissions, User, DEFAULT_PERMISSIONS, ROLE_HIERARCHY } from '@/types';

/**
 * Service pour gérer les rôles et permissions utilisateur
 */
export class PermissionsService {
  /**
   * Vérifie si un utilisateur a une permission spécifique
   */
  static hasPermission(user: User, permission: keyof UserPermissions): boolean {
    return user.permissions[permission] === true;
  }

  /**
   * Vérifie si un utilisateur peut accéder à l'administration
   */
  static canAccessAdmin(user: User): boolean {
    return this.hasPermission(user, 'canAccessAdmin');
  }

  /**
   * Vérifie si un utilisateur a un rôle spécifique ou supérieur
   */
  static hasRoleOrHigher(user: User, requiredRole: UserRole): boolean {
    const userLevel = ROLE_HIERARCHY[user.role];
    const requiredLevel = ROLE_HIERARCHY[requiredRole];
    return userLevel >= requiredLevel;
  }

  /**
   * Vérifie si un utilisateur peut gérer un autre utilisateur
   */
  static canManageUser(manager: User, target: User): boolean {
    // Ne peut pas se gérer soi-même pour certaines actions critiques
    if (manager.id === target.id) return false;

    // Vérifie les permissions de base
    if (!this.hasPermission(manager, 'canManageUsers')) return false;

    // Vérifie la hiérarchie des rôles
    const managerLevel = ROLE_HIERARCHY[manager.role];
    const targetLevel = ROLE_HIERARCHY[target.role];
    
    return managerLevel > targetLevel;
  }

  /**
   * Obtient les permissions par défaut pour un rôle
   */
  static getDefaultPermissions(role: UserRole): UserPermissions {
    return { ...DEFAULT_PERMISSIONS[role] };
  }

  /**
   * Vérifie si un rôle peut être assigné par un utilisateur
   */
  static canAssignRole(manager: User, targetRole: UserRole): boolean {
    if (!this.hasPermission(manager, 'canManageUsers')) return false;

    const managerLevel = ROLE_HIERARCHY[manager.role];
    const targetLevel = ROLE_HIERARCHY[targetRole];

    // Ne peut assigner que des rôles inférieurs au sien
    return managerLevel > targetLevel;
  }

  /**
   * Obtient la liste des rôles qu'un utilisateur peut assigner
   */
  static getAssignableRoles(manager: User): UserRole[] {
    if (!this.hasPermission(manager, 'canManageUsers')) return [];

    const managerLevel = ROLE_HIERARCHY[manager.role];
    
    return Object.entries(ROLE_HIERARCHY)
      .filter(([, level]) => level < managerLevel)
      .map(([role]) => role as UserRole)
      .sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);
  }

  /**
   * Obtient le nom d'affichage d'un rôle
   */
  static getRoleDisplayName(role: UserRole): string {
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
   * Obtient la couleur associée à un rôle
   */
  static getRoleColor(role: UserRole): string {
    const roleColors: Record<UserRole, string> = {
      BIGBOSS: 'bg-purple-600 text-white',
      ADMIN: 'bg-red-600 text-white',
      MODO: 'bg-orange-600 text-white',
      AUDIT: 'bg-blue-600 text-white',
      ANALYST: 'bg-green-600 text-white',
      USER: 'bg-gray-600 text-white',
    };

    return roleColors[role];
  }

  /**
   * Obtient l'icône associée à un rôle
   */
  static getRoleIcon(role: UserRole): string {
    const roleIcons: Record<UserRole, string> = {
      BIGBOSS: '👑',
      ADMIN: '⚡',
      MODO: '🛡️',
      AUDIT: '📊',
      ANALYST: '📈',
      USER: '👤',
    };

    return roleIcons[role];
  }

  /**
   * Valide si des permissions sont cohérentes avec un rôle
   */
  static validatePermissions(role: UserRole, permissions: UserPermissions): boolean {
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
   * Obtient une description des permissions d'un rôle
   */
  static getRoleDescription(role: UserRole): string {
    const descriptions: Record<UserRole, string> = {
      BIGBOSS: 'Accès complet à toutes les fonctionnalités, y compris la gestion des traductions et configuration système.',
      ADMIN: 'Gestion des utilisateurs, groupes, conversations et accès aux analyses. Peut modérer le contenu.',
      MODO: 'Modération du contenu, gestion des groupes et conversations. Accès limité à l\'administration.',
      AUDIT: 'Accès en lecture aux logs d\'audit et analyses. Peut surveiller l\'activité système.',
      ANALYST: 'Accès aux analyses et statistiques pour le reporting et l\'optimisation.',
      USER: 'Utilisateur standard avec accès aux fonctionnalités de messagerie et traduction.',
    };

    return descriptions[role];
  }

  /**
   * Vérifie si un utilisateur peut effectuer une action spécifique
   */
  static canPerformAction(user: User, action: string, context?: { targetUserId?: string; groupId?: string; conversationId?: string }): boolean {
    switch (action) {
      case 'access_admin':
        return this.canAccessAdmin(user);
      
      case 'manage_user':
        if (!context?.targetUserId) return false;
        // Simulation - en réalité il faudrait récupérer l'utilisateur cible
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
  static getUserCapabilities(user: User): {
    role: string;
    level: number;
    permissions: string[];
    restrictions: string[];
  } {
    const permissions: string[] = [];
    const restrictions: string[] = [];

    // Analyse des permissions
    if (user.permissions.canAccessAdmin) permissions.push('Accès administration');
    if (user.permissions.canManageUsers) permissions.push('Gestion utilisateurs');
    if (user.permissions.canManageGroups) permissions.push('Gestion groupes');
    if (user.permissions.canModerateContent) permissions.push('Modération contenu');
    if (user.permissions.canViewAnalytics) permissions.push('Accès analyses');
    if (user.permissions.canViewAuditLogs) permissions.push('Logs d\'audit');

    // Restrictions
    if (!user.permissions.canManageUsers) restrictions.push('Gestion utilisateurs interdite');
    if (!user.permissions.canAccessAdmin) restrictions.push('Administration interdite');
    if (!user.permissions.canViewAnalytics) restrictions.push('Analyses interdites');

    return {
      role: this.getRoleDisplayName(user.role),
      level: ROLE_HIERARCHY[user.role],
      permissions,
      restrictions,
    };
  }
}

export default PermissionsService;
