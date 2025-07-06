import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserPermissions, User } from '../shared/interfaces';
import { PermissionsService } from './permissions.service';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

/**
 * Décorateur pour spécifier les rôles requis
 */
export const RequireRoles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Décorateur pour spécifier les permissions requises
 */
export const RequirePermissions = (...permissions: (keyof UserPermissions)[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Guard pour vérifier les rôles et permissions
 */
@Injectable()
export class RolesPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupère les métadonnées des décorateurs
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<(keyof UserPermissions)[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucun rôle/permission requis, autorise l'accès
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Hiérarchie des rôles
    const roleHierarchy: Record<UserRole, number> = {
      BIGBOSS: 6,
      ADMIN: 5,
      MODO: 4,
      AUDIT: 3,
      ANALYST: 2,
      USER: 1,
    };

    // Vérification des rôles
    if (requiredRoles && requiredRoles.length > 0) {
      const userLevel = roleHierarchy[user.role];
      const hasRequiredRole = requiredRoles.some(role => {
        const requiredLevel = roleHierarchy[role];
        return userLevel >= requiredLevel;
      });

      if (!hasRequiredRole) {
        throw new ForbiddenException(`Rôle requis: ${requiredRoles.join(' ou ')}`);
      }
    }

    // Vérification des permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = user.permissions || this.permissionsService.getRolePermissions(user.role);
      const hasRequiredPermissions = requiredPermissions.every(permission => 
        userPermissions[permission] === true
      );

      if (!hasRequiredPermissions) {
        throw new ForbiddenException(`Permissions insuffisantes: ${requiredPermissions.join(', ')}`);
      }
    }

    return true;
  }
}

/**
 * Guard spécialisé pour l'accès administration
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private permissionsService: PermissionsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Obtenir les permissions de l'utilisateur
    const userPermissions = user.permissions || this.permissionsService.getRolePermissions(user.role);
    
    if (!userPermissions.canAccessAdmin) {
      throw new ForbiddenException('Accès administration requis');
    }

    return true;
  }
}

/**
 * Guard pour vérifier que l'utilisateur peut gérer d'autres utilisateurs
 */
@Injectable()
export class UserManagementGuard implements CanActivate {
  constructor(private permissionsService: PermissionsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Obtenir les permissions de l'utilisateur
    const userPermissions = user.permissions || this.permissionsService.getRolePermissions(user.role);
    
    if (!userPermissions.canManageUsers) {
      throw new ForbiddenException('Permission de gestion des utilisateurs requise');
    }

    // Vérification additionnelle pour la hiérarchie des rôles
    const targetUserId = request.params.id || request.body.userId;
    if (targetUserId && targetUserId === user.id) {
      throw new ForbiddenException('Impossible de se gérer soi-même');
    }

    return true;
  }
}
