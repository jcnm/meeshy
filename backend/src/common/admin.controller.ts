import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, UserManagementGuard, RequireRoles, RequirePermissions } from '../common/roles-permissions.guard';
import { PermissionsService } from '../common/permissions.service';
import { UserService } from '../modules/user.service';
import { UpdateUserDto } from '../shared/dto';
import { UserRole, User } from '../shared/interfaces';
import { mapPrismaUser } from './user-mapper';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * Tableau de bord administration avec statistiques
   */
  @Get('dashboard')
  @RequirePermissions('canAccessAdmin')
  async getDashboard(@Request() req: { user: User }) {
    const user = req.user;

    // Statistiques générales
    const totalUsers = await this.userService.countUsers();
    const totalActiveUsers = await this.userService.countActiveUsers();
    const totalAdmins = await this.userService.countUsersByRole(['ADMIN', 'BIGBOSS']);

    // Permissions utilisateur
    const userCapabilities = this.permissionsService.getUserCapabilities(user);

    return {
      statistics: {
        totalUsers,
        totalActiveUsers,
        totalAdmins,
        activePercentage: totalUsers > 0 ? Math.round((totalActiveUsers / totalUsers) * 100) : 0,
      },
      userInfo: {
        role: user.role,
        capabilities: userCapabilities,
        assignableRoles: this.permissionsService.getAssignableRoles(user),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Liste des utilisateurs avec filtres et pagination
   */
  @Get('users')
  @RequirePermissions('canManageUsers')
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('active') active?: boolean,
  ) {
    const offset = (page - 1) * limit;

    const filters = {
      role,
      search,
      active,
    };

    const { users, total } = await this.userService.findUsersWithFilters(filters, limit, offset);

    return {
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Détails d'un utilisateur spécifique
   */
  @Get('users/:id')
  @RequirePermissions('canManageUsers')
  async getUserDetails(@Param('id') userId: string, @Request() req: { user: User }) {
    const manager = req.user;
    const prismaUser = await this.userService.findById(userId);

    if (!prismaUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const user = mapPrismaUser(prismaUser);

    // Vérifier si le manager peut gérer cet utilisateur
    if (!this.permissionsService.canManageUser(manager, user)) {
      throw new ForbiddenException('Permissions insuffisantes pour gérer cet utilisateur');
    }

    const capabilities = this.permissionsService.getUserCapabilities(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        systemLanguage: user.systemLanguage,
        regionalLanguage: user.regionalLanguage,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      },
      capabilities,
      canEdit: this.permissionsService.canManageUser(manager, user),
    };
  }

  /**
   * Mettre à jour le rôle d'un utilisateur
   */
  @Put('users/:id/role')
  @UseGuards(UserManagementGuard)
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') newRole: UserRole,
    @Request() req: { user: User },
  ) {
    const manager = req.user;
    const prismaTargetUser = await this.userService.findById(userId);

    if (!prismaTargetUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const targetUser = mapPrismaUser(prismaTargetUser);

    // Vérifications de sécurité
    if (manager.id === targetUser.id) {
      throw new BadRequestException('Impossible de modifier son propre rôle');
    }

    if (!this.permissionsService.canManageUser(manager, targetUser)) {
      throw new ForbiddenException('Permissions insuffisantes pour gérer cet utilisateur');
    }

    if (!this.permissionsService.canAssignRole(manager, newRole)) {
      throw new ForbiddenException(`Vous ne pouvez pas assigner le rôle ${newRole}`);
    }

    // Mettre à jour l'utilisateur avec le nouveau rôle
    const updatedUser = await this.userService.updateUserRole(userId, newRole);

    return {
      message: `Rôle mis à jour vers ${newRole}`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
      },
    };
  }

  /**
   * Mettre à jour les informations d'un utilisateur
   */
  @Put('users/:id')
  @UseGuards(UserManagementGuard)
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: { user: User },
  ) {
    const manager = req.user;
    const prismaTargetUser = await this.userService.findById(userId);

    if (!prismaTargetUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const targetUser = mapPrismaUser(prismaTargetUser);

    if (!this.permissionsService.canManageUser(manager, targetUser)) {
      throw new ForbiddenException('Permissions insuffisantes pour gérer cet utilisateur');
    }

    // Si le rôle est modifié, vérifier les permissions
    if (updateUserDto.role && updateUserDto.role !== targetUser.role) {
      if (!this.permissionsService.canAssignRole(manager, updateUserDto.role)) {
        throw new ForbiddenException(`Vous ne pouvez pas assigner le rôle ${updateUserDto.role}`);
      }
    }

    const updatedUser = await this.userService.update(userId, updateUserDto);

    return {
      message: 'Utilisateur mis à jour avec succès',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        role: updatedUser.role,
      },
    };
  }

  /**
   * Désactiver un utilisateur
   */
  @Delete('users/:id')
  @RequireRoles('ADMIN', 'BIGBOSS')
  async deactivateUser(@Param('id') userId: string, @Request() req: { user: User }) {
    const manager = req.user;
    const prismaTargetUser = await this.userService.findById(userId);

    if (!prismaTargetUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const targetUser = mapPrismaUser(prismaTargetUser);

    if (manager.id === targetUser.id) {
      throw new BadRequestException('Impossible de se désactiver soi-même');
    }

    if (!this.permissionsService.canManageUser(manager, targetUser)) {
      throw new ForbiddenException('Permissions insuffisantes pour désactiver cet utilisateur');
    }

    await this.userService.deactivateUser(userId);

    return {
      message: 'Utilisateur désactivé avec succès',
      userId,
    };
  }

  /**
   * Obtenir les logs d'audit
   */
  @Get('audit-logs')
  @RequirePermissions('canViewAuditLogs')
  async getAuditLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    // Système de logs d'audit basique utilisant les données de la base
    const offset = (page - 1) * limit;
    
    // Utiliser findUsersWithFilters pour obtenir les utilisateurs avec pagination
    const { users, total } = await this.userService.findUsersWithFilters(
      {}, // pas de filtres spécifiques
      limit,
      offset
    );

    // Transformer en logs d'audit
    const logs = users.map((user: any) => ({
      id: `audit-${user.id}`,
      timestamp: user.lastActiveAt,
      action: user.isActive ? 'USER_ACTIVITY' : 'USER_INACTIVE',
      userId: user.id,
      username: user.username,
      details: {
        role: user.role,
        email: user.email,
        lastActive: user.lastActiveAt,
        accountCreated: user.createdAt,
        lastUpdated: user.updatedAt,
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
      },
    }));

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      message: 'Logs d\'audit basés sur l\'activité des utilisateurs',
    };
  }

  /**
   * Obtenir les statistiques analytiques
   */
  @Get('analytics')
  @RequirePermissions('canViewAnalytics')
  async getAnalytics(@Request() req: { user: User }) {
    const user = req.user;

    // Statistiques de base autorisées selon le rôle
    const stats = {
      userStats: await this.getUserStats(),
      systemStats: this.permissionsService.hasRoleOrHigher(user, 'ADMIN') 
        ? await this.getSystemStats()
        : null,
    };

    return stats;
  }

  /**
   * Obtenir les rôles disponibles pour attribution
   */
  @Get('roles')
  @RequirePermissions('canManageUsers')
  async getAvailableRoles(@Request() req: { user: User }) {
    const manager = req.user;
    const assignableRoles = this.permissionsService.getAssignableRoles(manager);

    return {
      assignableRoles: assignableRoles.map(role => ({
        value: role,
        label: this.getRoleDisplayName(role),
        level: this.getRoleLevel(role),
      })),
      currentUserRole: manager.role,
    };
  }

  // Méthodes privées pour les statistiques

  private async getUserStats() {
    const totalUsers = await this.userService.countUsers();
    const activeUsers = await this.userService.countActiveUsers();
    const usersByRole = await this.userService.getUsersByRole();

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: usersByRole,
    };
  }

  private async getSystemStats() {
    // Statistiques système complètes
    const memory = process.memoryUsage();
    const startTime = Date.now() - (process.uptime() * 1000);
    
    // Statistiques de base de données
    const [totalUsers, totalMessages, totalConversations] = await Promise.all([
      this.userService.countUsers(),
      // Approximation du nombre de messages (à adapter selon le schéma)
      this.userService.countUsers(), // placeholder
      this.userService.countUsers(), // placeholder
    ]);

    return {
      uptime: process.uptime(),
      uptimeFormatted: this.formatUptime(process.uptime()),
      startTime: new Date(startTime),
      memory: {
        rss: this.formatBytes(memory.rss),
        heapTotal: this.formatBytes(memory.heapTotal),
        heapUsed: this.formatBytes(memory.heapUsed),
        external: this.formatBytes(memory.external),
        raw: memory,
      },
      platform: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      database: {
        totalUsers,
        totalMessages,
        totalConversations,
      },
      timestamp: new Date(),
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${days}j ${hours}h ${minutes}m ${secs}s`;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

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

  private getRoleLevel(role: UserRole): number {
    const hierarchy: Record<UserRole, number> = {
      BIGBOSS: 6,
      ADMIN: 5,
      MODO: 4,
      AUDIT: 3,
      ANALYST: 2,
      USER: 1,
    };
    return hierarchy[role];
  }
}
